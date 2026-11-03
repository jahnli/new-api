package oauth

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"errors"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/golang-jwt/jwt/v5"
)

const (
	oidcLogoutEvent = "http://schemas.openid.net/event/backchannel-logout"
	oidcClockSkew   = 30 * time.Second
	oidcLogoutAge   = 5 * time.Minute
)

var ErrOIDCTokenInvalid = errors.New("invalid OIDC token")

type oidcSigningKey struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type oidcMetadata struct {
	Issuer             string `json:"issuer"`
	JWKSURI            string `json:"jwks_uri"`
	EndSessionEndpoint string `json:"end_session_endpoint"`
	Keys               []oidcSigningKey
}

var oidcDiscoveryCache struct {
	sync.Mutex
	URL       string
	Metadata  oidcMetadata
	FetchedAt time.Time
}

// Only administrator-configured discovery and its advertised JWKS are fetched.
// Never follow jku/x5u or derive a URL from an unverified token's issuer.
func readOIDCDocument(ctx context.Context, address string, target any) error {
	u, err := url.Parse(address)
	if err != nil || u.Host == "" || u.User != nil || u.Fragment != "" {
		return ErrOIDCTokenInvalid
	}
	loopback := u.Hostname() == "localhost"
	if ip := net.ParseIP(u.Hostname()); ip != nil {
		loopback = ip.IsLoopback()
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback) {
		return errors.New("OIDC discovery and JWKS require HTTPS")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return err
	}
	client := &http.Client{
		Timeout:       5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return errors.New("OIDC metadata request failed")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	if err != nil || len(data) > 1<<20 {
		return errors.New("invalid OIDC metadata response")
	}
	return common.Unmarshal(data, target)
}

func loadOIDCMetadata(ctx context.Context, discoveryURL string, refresh bool) (oidcMetadata, error) {
	oidcDiscoveryCache.Lock()
	defer oidcDiscoveryCache.Unlock()
	age := time.Since(oidcDiscoveryCache.FetchedAt)
	if oidcDiscoveryCache.URL == discoveryURL && age < 5*time.Minute && (!refresh || age < 30*time.Second) {
		return oidcDiscoveryCache.Metadata, nil
	}
	var metadata oidcMetadata
	if err := readOIDCDocument(ctx, discoveryURL, &metadata); err != nil {
		return metadata, err
	}
	issuer, err := url.Parse(metadata.Issuer)
	if err != nil || issuer.Host == "" || issuer.User != nil || issuer.RawQuery != "" || issuer.Fragment != "" || (issuer.Scheme != "https" && issuer.Scheme != "http") {
		return metadata, ErrOIDCTokenInvalid
	}
	var jwks struct {
		Keys []oidcSigningKey `json:"keys"`
	}
	if err := readOIDCDocument(ctx, metadata.JWKSURI, &jwks); err != nil {
		return metadata, err
	}
	if len(jwks.Keys) == 0 || len(jwks.Keys) > 100 {
		return metadata, ErrOIDCTokenInvalid
	}
	metadata.Keys = jwks.Keys
	oidcDiscoveryCache.URL = discoveryURL
	oidcDiscoveryCache.Metadata = metadata
	oidcDiscoveryCache.FetchedAt = time.Now()
	return metadata, nil
}

func (metadata oidcMetadata) signingKey(token *jwt.Token) (any, error) {
	// No unsupported critical extensions, token-supplied keys, symmetric
	// algorithms or "none". The parser also enforces an asymmetric allowlist.
	if _, present := token.Header["crit"]; present {
		return nil, ErrOIDCTokenInvalid
	}
	kid, _ := token.Header["kid"].(string)
	if _, present := token.Header["kid"]; present && kid == "" {
		return nil, ErrOIDCTokenInvalid
	}
	var selected any
	for _, key := range metadata.Keys {
		if (kid != "" && kid != key.Kid) || (key.Use != "" && key.Use != "sig") || (key.Alg != "" && key.Alg != token.Method.Alg()) {
			continue
		}
		publicKey, err := key.publicKey(token.Method)
		if err != nil {
			continue
		}
		if selected != nil {
			return nil, ErrOIDCTokenInvalid // Ambiguous kid or omitted kid with multiple keys.
		}
		selected = publicKey
	}
	if selected == nil {
		return nil, ErrOIDCTokenInvalid
	}
	return selected, nil
}

func (key oidcSigningKey) publicKey(method jwt.SigningMethod) (any, error) {
	switch method := method.(type) {
	case *jwt.SigningMethodRSA, *jwt.SigningMethodRSAPSS:
		if key.Kty != "RSA" {
			return nil, ErrOIDCTokenInvalid
		}
		n, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil || len(n) > 1024 {
			return nil, ErrOIDCTokenInvalid
		}
		e, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil || len(e) == 0 || len(e) > 4 {
			return nil, ErrOIDCTokenInvalid
		}
		exponent := new(big.Int).SetBytes(e).Int64()
		modulus := new(big.Int).SetBytes(n)
		if modulus.BitLen() < 2048 || exponent < 3 || exponent > 2147483647 || exponent%2 == 0 {
			return nil, ErrOIDCTokenInvalid
		}
		return &rsa.PublicKey{N: modulus, E: int(exponent)}, nil
	case *jwt.SigningMethodECDSA:
		if key.Kty != "EC" {
			return nil, ErrOIDCTokenInvalid
		}
		var curve elliptic.Curve
		switch {
		case key.Crv == "P-256" && method.Alg() == "ES256":
			curve = elliptic.P256()
		case key.Crv == "P-384" && method.Alg() == "ES384":
			curve = elliptic.P384()
		case key.Crv == "P-521" && method.Alg() == "ES512":
			curve = elliptic.P521()
		default:
			return nil, ErrOIDCTokenInvalid
		}
		x, xErr := base64.RawURLEncoding.DecodeString(key.X)
		y, yErr := base64.RawURLEncoding.DecodeString(key.Y)
		size := (curve.Params().BitSize + 7) / 8
		if xErr != nil || yErr != nil || len(x) != size || len(y) != size {
			return nil, ErrOIDCTokenInvalid
		}
		publicKey := &ecdsa.PublicKey{Curve: curve, X: new(big.Int).SetBytes(x), Y: new(big.Int).SetBytes(y)}
		if !curve.IsOnCurve(publicKey.X, publicKey.Y) {
			return nil, ErrOIDCTokenInvalid
		}
		return publicKey, nil
	case *jwt.SigningMethodEd25519:
		x, err := base64.RawURLEncoding.DecodeString(key.X)
		if err != nil || key.Kty != "OKP" || key.Crv != "Ed25519" || len(x) != ed25519.PublicKeySize {
			return nil, ErrOIDCTokenInvalid
		}
		return ed25519.PublicKey(x), nil
	default:
		return nil, ErrOIDCTokenInvalid
	}
}

func verifyOIDCToken(ctx context.Context, raw, discoveryURL, clientID string, logout bool) (jwt.MapClaims, error) {
	if raw == "" || len(raw) > 32*1024 || discoveryURL == "" || clientID == "" {
		return nil, ErrOIDCTokenInvalid
	}
	metadata, err := loadOIDCMetadata(ctx, discoveryURL, false)
	if err != nil {
		return nil, err
	}
	options := []jwt.ParserOption{
		jwt.WithValidMethods([]string{"RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"}),
		jwt.WithIssuer(metadata.Issuer), jwt.WithAudience(clientID), jwt.WithIssuedAt(), jwt.WithLeeway(oidcClockSkew),
	}
	if !logout {
		options = append(options, jwt.WithExpirationRequired())
	}
	parsed, err := jwt.Parse(raw, metadata.signingKey, options...)
	if errors.Is(err, jwt.ErrTokenUnverifiable) || errors.Is(err, jwt.ErrTokenSignatureInvalid) {
		// Refresh once for key rotation; the cache rate-limits unknown-kid traffic.
		refreshed, refreshErr := loadOIDCMetadata(ctx, discoveryURL, true)
		if refreshErr == nil && refreshed.Issuer == metadata.Issuer {
			parsed, err = jwt.Parse(raw, refreshed.signingKey, options...)
		}
	}
	if err != nil || !parsed.Valid {
		return nil, ErrOIDCTokenInvalid
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrOIDCTokenInvalid
	}
	iat, err := claims.GetIssuedAt()
	if err != nil || iat == nil || iat.Unix() <= 0 {
		return nil, ErrOIDCTokenInvalid
	}
	if _, present := claims["exp"]; present {
		exp, err := claims.GetExpirationTime()
		if err != nil || exp == nil || !exp.After(iat.Time) {
			return nil, ErrOIDCTokenInvalid
		}
	}
	if logout {
		if time.Since(iat.Time) > oidcLogoutAge {
			return nil, ErrOIDCTokenInvalid
		}
		if _, present := claims["nonce"]; present {
			return nil, ErrOIDCTokenInvalid
		}
		events, ok := claims["events"].(map[string]any)
		if !ok {
			return nil, ErrOIDCTokenInvalid
		}
		event, ok := events[oidcLogoutEvent].(map[string]any)
		if !ok || len(event) != 0 {
			return nil, ErrOIDCTokenInvalid
		}
		if typ, present := parsed.Header["typ"]; present && typ != "JWT" && typ != "logout+jwt" {
			return nil, ErrOIDCTokenInvalid
		}
	} else if _, present := claims["events"]; present {
		return nil, ErrOIDCTokenInvalid // A logout token must never authenticate a user.
	}
	return claims, nil
}

func VerifyOIDCLogoutToken(ctx context.Context, raw, discoveryURL, clientID string) (*model.OIDCLogout, error) {
	claims, err := verifyOIDCToken(ctx, raw, discoveryURL, clientID, true)
	if err != nil {
		return nil, err
	}
	subject, _ := claims["sub"].(string)
	sid, _ := claims["sid"].(string)
	jti, _ := claims["jti"].(string)
	if (subject == "" && sid == "") || jti == "" || len(subject) > 2048 || len(sid) > 2048 || len(jti) > 2048 {
		return nil, ErrOIDCTokenInvalid
	}
	// Present-but-invalid identifiers must not broaden a targeted logout.
	if value, present := claims["sub"]; present && (subject == "" || value != subject) {
		return nil, ErrOIDCTokenInvalid
	}
	if value, present := claims["sid"]; present && (sid == "" || value != sid) {
		return nil, ErrOIDCTokenInvalid
	}
	issuer, _ := claims.GetIssuer()
	iat, _ := claims.GetIssuedAt()
	return &model.OIDCLogout{
		AssertionKey: model.OIDCIdentityKey(issuer, clientID, "jti", jti),
		SubjectKey:   model.OIDCIdentityKey(issuer, clientID, "sub", subject),
		SessionKey:   model.OIDCIdentityKey(issuer, clientID, "sid", sid),
		IssuedAt:     iat.Unix(),
	}, nil
}
