package service

import (
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
	ldapv3 "github.com/go-ldap/ldap/v3"
)

// dingTalkUserIDAttribute 是 LDAP 中存放钉钉 userid 的属性名。
const dingTalkUserIDAttribute = "extensionAttribute12"

// LDAPUserInfo 保存 LDAP 认证成功后从目录中解析出的用户信息。
type LDAPUserInfo struct {
	Username       string
	Email          string
	DisplayName    string
	DN             string
	Company        string
	DingTalkUserID string // 来自 extensionAttribute12，用于钉钉同步的 dingding_id
}

func dialLDAP(settings *system_setting.LDAPSettings) (*ldapv3.Conn, error) {
	tlsConfig := &tls.Config{
		InsecureSkipVerify: settings.SkipTLSVerify,
	}

	var conn *ldapv3.Conn
	var err error

	if strings.HasPrefix(settings.ServerURL, "ldaps://") {
		conn, err = ldapv3.DialURL(settings.ServerURL, ldapv3.DialWithTLSConfig(tlsConfig))
	} else {
		conn, err = ldapv3.DialURL(settings.ServerURL)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to LDAP server: %w", err)
	}

	conn.SetTimeout(10 * time.Second)

	if settings.StartTLS && !strings.HasPrefix(settings.ServerURL, "ldaps://") {
		if err := conn.StartTLS(tlsConfig); err != nil {
			conn.Close()
			return nil, fmt.Errorf("failed to start TLS: %w", err)
		}
	}

	return conn, nil
}

// buildSearchFilter 将过滤器模板中的 {{username}} 替换为经过 RFC4515 转义的用户名。
func buildSearchFilter(template, username string) string {
	return strings.ReplaceAll(template, "{{username}}", ldapv3.EscapeFilter(username))
}

// AuthenticateLDAP 执行经典的两步 bind-search-bind 流程：服务账号 bind 搜索用户，
// 再用用户 DN + 密码 bind 验证凭据。
func AuthenticateLDAP(username, password string) (*LDAPUserInfo, error) {
	settings := system_setting.GetLDAPSettings()
	if !settings.Enabled {
		return nil, fmt.Errorf("LDAP is not enabled")
	}

	if username == "" || password == "" {
		return nil, fmt.Errorf("username and password are required")
	}

	conn, err := dialLDAP(settings)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	// Bind with service account to search for the user
	if err := conn.Bind(settings.BindDN, settings.BindPassword); err != nil {
		return nil, fmt.Errorf("service account bind failed: %w", err)
	}

	filter := buildSearchFilter(settings.SearchFilter, username)
	// 始终请求钉钉 userid 属性，钉钉同步流程从这里读取 dingding_id。
	attrs := []string{"dn", dingTalkUserIDAttribute}
	if settings.UsernameAttribute != "" {
		attrs = append(attrs, settings.UsernameAttribute)
	}
	if settings.EmailAttribute != "" {
		attrs = append(attrs, settings.EmailAttribute)
	}
	if settings.DisplayNameAttribute != "" {
		attrs = append(attrs, settings.DisplayNameAttribute)
	}

	searchReq := ldapv3.NewSearchRequest(
		settings.SearchBase,
		ldapv3.ScopeWholeSubtree,
		ldapv3.NeverDerefAliases,
		2, // SizeLimit: username is expected to be unique; fetch two to detect violations
		10,
		false,
		filter,
		attrs,
		nil,
	)

	sr, err := conn.Search(searchReq)
	if err != nil {
		return nil, fmt.Errorf("LDAP search failed: %w", err)
	}

	if len(sr.Entries) == 0 {
		return nil, fmt.Errorf("user not found in LDAP")
	}
	if len(sr.Entries) > 1 {
		return nil, fmt.Errorf("multiple LDAP users found for username %s", username)
	}

	entry := sr.Entries[0]

	// Authenticate by binding with the user's DN and password
	if err := conn.Bind(entry.DN, password); err != nil {
		return nil, fmt.Errorf("LDAP authentication failed")
	}

	info := &LDAPUserInfo{DN: entry.DN}

	info.Username, err = getLDAPUsername(entry, settings.UsernameAttribute)
	if err != nil {
		return nil, err
	}
	if settings.EmailAttribute != "" {
		info.Email = entry.GetAttributeValue(settings.EmailAttribute)
	}
	if settings.DisplayNameAttribute != "" {
		info.DisplayName = entry.GetAttributeValue(settings.DisplayNameAttribute)
	}
	info.DingTalkUserID = strings.TrimSpace(entry.GetAttributeValue(dingTalkUserIDAttribute))

	company, err := ExtractLDAPCompanyFromDN(entry.DN, settings.SearchBase)
	if err != nil {
		return nil, err
	}
	info.Company = company

	return info, nil
}

// getLDAPUsername returns the canonical local username from the configured LDAP attribute.
func getLDAPUsername(entry *ldapv3.Entry, attribute string) (string, error) {
	attribute = strings.TrimSpace(attribute)
	if attribute == "" {
		return "", fmt.Errorf("LDAP username attribute is not configured")
	}

	username := strings.TrimSpace(entry.GetEqualFoldAttributeValue(attribute))
	if username == "" {
		return "", fmt.Errorf("LDAP username attribute %q is empty", attribute)
	}
	return strings.ToLower(username), nil
}

// ExtractLDAPCompanyFromDN returns the OU directly under the configured LDAP search base.
func ExtractLDAPCompanyFromDN(userDN, searchBase string) (string, error) {
	userDN = strings.TrimSpace(userDN)
	searchBase = strings.TrimSpace(searchBase)
	if userDN == "" || searchBase == "" {
		return "", fmt.Errorf("LDAP user DN or search base is empty")
	}

	parsedUserDN, err := ldapv3.ParseDN(userDN)
	if err != nil {
		return "", fmt.Errorf("parse LDAP user DN: %w", err)
	}
	parsedSearchBase, err := ldapv3.ParseDN(searchBase)
	if err != nil {
		return "", fmt.Errorf("parse LDAP search base DN: %w", err)
	}

	userRDNs := parsedUserDN.RDNs
	baseRDNs := parsedSearchBase.RDNs
	if len(userRDNs) <= len(baseRDNs) {
		return "", fmt.Errorf("LDAP user DN is not under search base")
	}

	baseOffset := len(userRDNs) - len(baseRDNs)
	for i := range baseRDNs {
		if !sameRDN(userRDNs[baseOffset+i], baseRDNs[i]) {
			return "", fmt.Errorf("LDAP user DN is not under search base")
		}
	}

	companyRDN := userRDNs[baseOffset-1]
	if len(companyRDN.Attributes) != 1 {
		return "", fmt.Errorf("LDAP company RDN is not a single OU")
	}
	attr := companyRDN.Attributes[0]
	if !strings.EqualFold(attr.Type, "OU") || strings.TrimSpace(attr.Value) == "" {
		return "", fmt.Errorf("LDAP company RDN is not an OU")
	}
	return strings.TrimSpace(attr.Value), nil
}

func sameRDN(a, b *ldapv3.RelativeDN) bool {
	if len(a.Attributes) != len(b.Attributes) {
		return false
	}
	for i := range a.Attributes {
		left := a.Attributes[i]
		right := b.Attributes[i]
		if !strings.EqualFold(left.Type, right.Type) || !strings.EqualFold(strings.TrimSpace(left.Value), strings.TrimSpace(right.Value)) {
			return false
		}
	}
	return true
}

// TestLDAPConnection 用服务账号 bind 并对 SearchBase 做一次 base-object 搜索，用于后台连通性测试。
func TestLDAPConnection() error {
	settings := system_setting.GetLDAPSettings()

	if settings.ServerURL == "" {
		return fmt.Errorf("LDAP server URL is not configured")
	}

	conn, err := dialLDAP(settings)
	if err != nil {
		return err
	}
	defer conn.Close()

	if settings.BindDN != "" {
		if err := conn.Bind(settings.BindDN, settings.BindPassword); err != nil {
			return fmt.Errorf("bind failed: %w", err)
		}
	}

	if settings.SearchBase != "" {
		searchReq := ldapv3.NewSearchRequest(
			settings.SearchBase,
			ldapv3.ScopeBaseObject,
			ldapv3.NeverDerefAliases,
			1,
			5,
			false,
			"(objectClass=*)",
			[]string{"dn"},
			nil,
		)
		_, err = conn.Search(searchReq)
		if err != nil {
			return fmt.Errorf("search base test failed: %w", err)
		}
	}

	return nil
}
