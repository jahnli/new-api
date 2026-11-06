package controller

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

type silentOIDCFlow struct {
	CodeChallenge string `json:"code_challenge"`
	ClientID      string `json:"client_id"`
	DiscoveryURL  string `json:"discovery_url"`
}

type oauthCallbackRequest struct {
	State            string `json:"state"`
	Code             string `json:"code"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	CodeVerifier     string `json:"code_verifier"`
	silent           bool
}

// CompleteSilentOIDCLogin receives the code from the top-level application, not
// from the iframe. The verifier stays in that page's memory throughout the flow.
func CompleteSilentOIDCLogin(c *gin.Context) {
	var request oauthCallbackRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	request.silent = true
	handleOAuthCallback(c, "oidc", request)
}

func validOIDCCodeChallenge(value string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return err == nil && len(decoded) == sha256.Size && base64.RawURLEncoding.EncodeToString(decoded) == value
}

func silentOIDCAuthorizationURL(state, challenge string) (string, error) {
	settings := system_setting.GetOIDCSettings()
	u, err := url.Parse(settings.AuthorizationEndpoint)
	if err != nil || u.Host == "" || u.User != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return "", model.ErrAuthFlowInvalid
	}
	query := u.Query()
	query.Set("client_id", settings.ClientId)
	query.Set("redirect_uri", system_setting.ServerAddress+"/oauth/oidc")
	query.Set("response_type", "code")
	query.Set("response_mode", "query")
	query.Set("scope", "openid profile email")
	query.Set("state", state)
	query.Set("nonce", state)
	query.Set("prompt", "none")
	query.Set("code_challenge", challenge)
	query.Set("code_challenge_method", "S256")
	u.RawQuery = query.Encode()
	u.Fragment = ""
	return u.String(), nil
}

func validateSilentOIDCCallback(c *gin.Context, provider, intent string, flow *silentOIDCFlow, request oauthCallbackRequest) bool {
	if flow == nil && !request.silent {
		return true
	}
	settings := system_setting.GetOIDCSettings()
	if flow == nil || !request.silent || provider != "oidc" || intent != model.AuthFlowIntentLogin ||
		!settings.IsSilentLoginEnabled() || flow.ClientID != settings.ClientId || flow.DiscoveryURL != settings.WellKnown ||
		!validOIDCCodeChallenge(request.CodeVerifier) {
		writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
		return false
	}
	digest := sha256.Sum256([]byte(request.CodeVerifier))
	challenge := base64.RawURLEncoding.EncodeToString(digest[:])
	if subtle.ConstantTimeCompare([]byte(challenge), []byte(flow.CodeChallenge)) != 1 {
		writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
		return false
	}
	c.Set("oidc_silent_login", true)
	c.Set("login_method", "oauth:oidc")
	c.Set("oidc_code_verifier", request.CodeVerifier)
	c.Set("oidc_nonce", request.State)
	return true
}
