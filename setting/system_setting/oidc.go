package system_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type OIDCSettings struct {
	Enabled               bool   `json:"enabled"`
	SilentLogin           bool   `json:"silent_login"`
	DisplayName           string `json:"display_name"`
	ClientId              string `json:"client_id"`
	ClientSecret          string `json:"client_secret"`
	WellKnown             string `json:"well_known"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserInfoEndpoint      string `json:"user_info_endpoint"`
	UsernameFilterEnabled bool   `json:"username_filter_enabled"`
	AllowedUsernames      string `json:"allowed_usernames"` // One preferred_username per line; empty denies all when filtering is enabled.
}

// 默认配置
var defaultOIDCSettings = OIDCSettings{}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("oidc", &defaultOIDCSettings)
}

func GetOIDCSettings() *OIDCSettings {
	return &defaultOIDCSettings
}

// IsOIDCUsernameAllowed matches provider usernames exactly, ignoring case and
// surrounding whitespace. Missing usernames fail closed only when filtering is enabled.
func IsOIDCUsernameAllowed(username string) bool {
	settings := GetOIDCSettings()
	if !settings.UsernameFilterEnabled {
		return true
	}
	username = strings.TrimSpace(username)
	if username == "" {
		return false
	}
	for allowed := range strings.SplitSeq(settings.AllowedUsernames, "\n") {
		if strings.EqualFold(strings.TrimSpace(allowed), username) {
			return true
		}
	}
	return false
}

// Silent login requires discovery so the ID token is verified against a trusted issuer.
func (s *OIDCSettings) IsSilentLoginEnabled() bool {
	return s.Enabled && s.SilentLogin && s.WellKnown != "" && s.ClientId != "" &&
		s.ClientSecret != "" && s.AuthorizationEndpoint != "" && s.TokenEndpoint != "" &&
		s.UserInfoEndpoint != "" && ServerAddress != ""
}

// GetEffectiveDisplayName returns the admin-configured display name, or the
// literal "OIDC" when none has been set. Centralizing this fallback keeps the
// default in one place for both the OAuth provider name and the public
// status payload.
func (s *OIDCSettings) GetEffectiveDisplayName() string {
	if trimmed := strings.TrimSpace(s.DisplayName); trimmed != "" {
		return trimmed
	}
	return "OIDC"
}
