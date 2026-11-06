package oauth

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// BuildOIDCLogoutURL requests logout of the provider's current browser session.
// Providers must support RP-initiated logout without an id_token_hint.
func BuildOIDCLogoutURL(ctx context.Context) (string, error) {
	settings := *system_setting.GetOIDCSettings()
	if !settings.Enabled || strings.TrimSpace(settings.ClientId) == "" {
		return "", errors.New("OIDC logout is not configured")
	}
	discoveryURL, err := parseOIDCLogoutURL(settings.WellKnown)
	if err != nil {
		return "", errors.New("OIDC logout requires a valid discovery URL")
	}
	returnURL, err := parseOIDCLogoutURL(system_setting.ServerAddress)
	if err != nil || returnURL.RawQuery != "" || returnURL.ForceQuery {
		return "", errors.New("invalid OIDC post-logout return address")
	}
	returnURL.Path = strings.TrimRight(returnURL.Path, "/") + "/sign-in"
	returnURL.RawPath = ""

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, discoveryURL.String(), nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Accept", "application/json")
	client := &http.Client{
		Timeout: 5 * time.Second,
		// Never follow discovery redirects to an unchecked host or protocol.
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Do(request)
	if err != nil {
		return "", errors.New("OIDC logout discovery request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", errors.New("OIDC logout discovery returned an unexpected status")
	}
	const maxDiscoverySize = 1 << 20
	body, err := io.ReadAll(io.LimitReader(response.Body, maxDiscoverySize+1))
	if err != nil || len(body) > maxDiscoverySize {
		return "", errors.New("invalid OIDC logout discovery response")
	}
	var metadata struct {
		EndSessionEndpoint string `json:"end_session_endpoint"`
	}
	if err := common.Unmarshal(body, &metadata); err != nil {
		return "", errors.New("invalid OIDC logout discovery document")
	}
	endpoint, err := parseOIDCLogoutURL(metadata.EndSessionEndpoint)
	if err != nil {
		return "", errors.New("OIDC discovery has no valid end-session endpoint")
	}
	query := endpoint.Query()
	query.Set("client_id", settings.ClientId)
	query.Set("post_logout_redirect_uri", returnURL.String())
	endpoint.RawQuery = query.Encode()
	return endpoint.String(), nil
}

// Logout URLs come only from administrator configuration or its discovery
// document. Require TLS, except for local loopback development addresses.
func parseOIDCLogoutURL(address string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(address))
	if err != nil || parsed.Hostname() == "" || parsed.User != nil || parsed.Fragment != "" || parsed.Opaque != "" {
		return nil, errors.New("invalid OIDC logout URL")
	}
	loopback := strings.EqualFold(parsed.Hostname(), "localhost")
	if ip := net.ParseIP(parsed.Hostname()); ip != nil {
		loopback = ip.IsLoopback()
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && loopback) {
		return nil, errors.New("OIDC logout requires HTTPS except on loopback hosts")
	}
	return parsed, nil
}
