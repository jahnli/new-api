package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type SecurityAuditSetting struct {
	StartHour int `json:"start_hour"`
	EndHour   int `json:"end_hour"`
}

var securityAuditSetting = SecurityAuditSetting{
	StartHour: 3,
	EndHour:   7,
}

func init() {
	config.GlobalConfig.Register("security_audit_setting", &securityAuditSetting)
}

func GetSecurityAuditSetting() *SecurityAuditSetting {
	return &securityAuditSetting
}
