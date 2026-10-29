package system_setting

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// LDAPSettings 维护 LDAP 登录所需的全部配置。
// 字段通过 config.GlobalConfig 以 "ldap.<field>" 的键形式持久化到数据库。
type LDAPSettings struct {
	Enabled               bool                    `json:"enabled"`
	ServerURL             string                  `json:"server_url"` // ldap://host:port 或 ldaps://host:port
	BindDN                string                  `json:"bind_dn"`    // 服务账号 DN，用于搜索目录
	BindPassword          string                  `json:"bind_password"`
	SearchBase            string                  `json:"search_base"`            // 搜索起始 DN
	SearchFilter          string                  `json:"search_filter"`          // 占位符 {{username}} 会被转义后替换
	UsernameAttribute     string                  `json:"username_attribute"`     // 用户名属性
	EmailAttribute        string                  `json:"email_attribute"`        // 邮箱属性
	DisplayNameAttribute  string                  `json:"display_name_attribute"` // 显示名属性
	StartTLS              bool                    `json:"start_tls"`              // 对 ldap:// 启用 StartTLS 升级
	SkipTLSVerify         bool                    `json:"skip_tls_verify"`        // 跳过 TLS 证书校验
	LoginLabel            string                  `json:"login_label"`            // 前端登录入口展示文案
	UsernameFilterEnabled bool                    `json:"username_filter_enabled"`
	AllowedUsernames      string                  `json:"allowed_usernames"`    // One canonical LDAP username per line; empty denies all when filtering is enabled.
	CompanySyncConfigs    []LDAPCompanySyncConfig `json:"company_sync_configs"` // 按 LDAP OU 公司名配置同步平台和套餐
}

// LDAPCompanySyncConfig defines company-specific behavior after LDAP login.
type LDAPCompanySyncConfig struct {
	Company              string `json:"company"`
	DisplayName          string `json:"display_name"`
	SyncPlatform         string `json:"sync_platform"`
	AutoSubscribePlanId  int    `json:"auto_subscribe_plan_id"`
	FeishuAppID          string `json:"feishu_app_id"`
	FeishuAppSecret      string `json:"feishu_app_secret"`
	FeishuEmailSuffix    string `json:"feishu_email_suffix"`
	DingTalkClientID     string `json:"dingtalk_client_id"`
	DingTalkClientSecret string `json:"dingtalk_client_secret"`
}

const (
	LDAPSyncPlatformNone     = "none"
	LDAPSyncPlatformFeishu   = "feishu"
	LDAPSyncPlatformDingTalk = "dingtalk"
)

var defaultLDAPSettings = LDAPSettings{
	UsernameFilterEnabled: false,
	SearchFilter:          "(uid={{username}})",
	UsernameAttribute:     "uid",
	EmailAttribute:        "mail",
	DisplayNameAttribute:  "cn",
}

func init() {
	config.GlobalConfig.Register("ldap", &defaultLDAPSettings)
}

func GetLDAPSettings() *LDAPSettings {
	return &defaultLDAPSettings
}

// IsLDAPUsernameAllowed matches directory usernames exactly, ignoring case and
// surrounding whitespace. An empty list denies access when filtering is enabled.
func IsLDAPUsernameAllowed(username string) bool {
	username = strings.TrimSpace(username)
	if username == "" {
		return false
	}
	settings := GetLDAPSettings()
	if !settings.UsernameFilterEnabled {
		return true
	}
	for allowed := range strings.SplitSeq(settings.AllowedUsernames, "\n") {
		if strings.EqualFold(strings.TrimSpace(allowed), username) {
			return true
		}
	}
	return false
}

func GetLDAPCompanySyncConfig(company string) (LDAPCompanySyncConfig, bool) {
	company = strings.TrimSpace(company)
	if company == "" {
		return LDAPCompanySyncConfig{}, false
	}
	for _, cfg := range defaultLDAPSettings.CompanySyncConfigs {
		cfg = normalizeLDAPCompanySyncConfig(cfg)
		if cfg.Company == company {
			return cfg, true
		}
	}
	for _, cfg := range defaultLDAPSettings.CompanySyncConfigs {
		cfg = normalizeLDAPCompanySyncConfig(cfg)
		if cfg.DisplayName != "" && cfg.DisplayName == company {
			return cfg, true
		}
	}
	return LDAPCompanySyncConfig{}, false
}

// ResolveLDAPCompany maps an LDAP OU company name to the name stored on users.
// The matching sync configuration is returned so callers can continue using
// the OU-specific provider settings after the display name has been applied.
func ResolveLDAPCompany(company string) (string, LDAPCompanySyncConfig, bool) {
	company = strings.TrimSpace(company)
	cfg, ok := GetLDAPCompanySyncConfig(company)
	if !ok {
		return company, LDAPCompanySyncConfig{}, false
	}
	return cfg.DisplayName, cfg, true
}

func NormalizeLDAPCompanySyncConfigsJSON(value string) (string, error) {
	var configs []LDAPCompanySyncConfig
	if err := common.UnmarshalJsonStr(value, &configs); err != nil {
		return "", err
	}
	for i := range configs {
		configs[i] = normalizeLDAPCompanySyncConfig(configs[i])
		if configs[i].Company == "" {
			return "", errors.New("LDAP company name is required")
		}
	}
	normalized, err := common.Marshal(configs)
	if err != nil {
		return "", err
	}
	return string(normalized), nil
}

func GetLDAPAutoSubscribePlanId(company string) int {
	cfg, ok := GetLDAPCompanySyncConfig(company)
	if !ok {
		return 0
	}
	return cfg.AutoSubscribePlanId
}

func normalizeLDAPCompanySyncConfig(cfg LDAPCompanySyncConfig) LDAPCompanySyncConfig {
	cfg.Company = strings.TrimSpace(cfg.Company)
	cfg.DisplayName = strings.TrimSpace(cfg.DisplayName)
	if cfg.DisplayName == "" {
		cfg.DisplayName = cfg.Company
	}
	if cfg.SyncPlatform == "" {
		cfg.SyncPlatform = LDAPSyncPlatformNone
	}
	return cfg
}
