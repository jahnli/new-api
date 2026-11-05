package oauth

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// The original ID token is used only as an OP logout hint, never to authorize
// a local request. Its normal expiry does not prevent RP-initiated logout.
type oidcLogoutHint struct {
	IDToken      string `json:"id_token"`
	Issuer       string `json:"issuer"`
	ClientID     string `json:"client_id"`
	DiscoveryURL string `json:"discovery_url"`
}

func BuildOIDCLogoutURL(ctx context.Context, encryptedHint, subjectKey string) (string, error) {
	if encryptedHint == "" || subjectKey == "" {
		return "", errors.New("OIDC logout hint is unavailable")
	}
	data, err := common.DecryptAESGCM(encryptedHint, common.SessionSecret, []byte("oidc-logout:"+subjectKey))
	if err != nil {
		return "", errors.New("OIDC logout hint could not be decrypted")
	}
	var hint oidcLogoutHint
	if err := common.Unmarshal(data, &hint); err != nil {
		return "", errors.New("invalid OIDC logout hint")
	}
	settings := *system_setting.GetOIDCSettings()
	if hint.ClientID != settings.ClientId || hint.DiscoveryURL != settings.WellKnown || hint.IDToken == "" {
		return "", errors.New("OIDC provider configuration has changed")
	}
	metadata, err := loadOIDCMetadata(ctx, hint.DiscoveryURL, false)
	if err != nil {
		return "", err
	}
	if metadata.Issuer != hint.Issuer {
		return "", errors.New("OIDC logout issuer mismatch")
	}
	endpoint, err := url.Parse(metadata.EndSessionEndpoint)
	if err != nil || endpoint.Host == "" || endpoint.User != nil || endpoint.Fragment != "" {
		return "", errors.New("invalid OIDC logout endpoint URL")
	}
	// Match discovery's HTTP exception for local development; other hosts require TLS.
	loopback := endpoint.Hostname() == "localhost"
	if ip := net.ParseIP(endpoint.Hostname()); ip != nil {
		loopback = ip.IsLoopback()
	}
	if endpoint.Scheme != "https" && !(endpoint.Scheme == "http" && loopback) {
		return "", errors.New("OIDC logout endpoint requires HTTPS except for loopback HTTP URLs")
	}
	// Only server configuration determines the return address; request headers,
	// query parameters and browser-provided URLs cannot become redirect targets.
	// Reuse the registered sign-in URL; the browser handles the logout landing page.
	returnURL, err := url.Parse(strings.TrimRight(system_setting.ServerAddress, "/") + "/sign-in")
	if err != nil || (returnURL.Scheme != "https" && returnURL.Scheme != "http") || returnURL.Host == "" || returnURL.User != nil || returnURL.RawQuery != "" || returnURL.Fragment != "" {
		return "", errors.New("invalid OIDC post-logout return address")
	}
	query := endpoint.Query()
	query.Set("client_id", hint.ClientID)
	query.Set("id_token_hint", hint.IDToken)
	query.Set("post_logout_redirect_uri", returnURL.String())
	endpoint.RawQuery = query.Encode()
	return endpoint.String(), nil
}
