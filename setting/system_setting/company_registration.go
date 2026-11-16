package system_setting

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const CompanyRegistrationOptionKey = "company_registration.configs"

type CompanyRegistrationConfig struct {
	Company             string `json:"company"`
	DisplayName         string `json:"display_name"`
	AutoSubscribePlanId int    `json:"auto_subscribe_plan_id"`
}

type CompanyRegistrationSettings struct {
	Configs []CompanyRegistrationConfig `json:"configs"`
}

var companyRegistrationSettings = CompanyRegistrationSettings{Configs: []CompanyRegistrationConfig{}}

func init() {
	config.GlobalConfig.Register("company_registration", &companyRegistrationSettings)
}

func GetCompanyRegistrationSettings() *CompanyRegistrationSettings {
	return &companyRegistrationSettings
}

// ResolveRegistrationCompany matches Casdoor affiliation first, then the stored display name.
func ResolveRegistrationCompany(company string) (string, CompanyRegistrationConfig, bool) {
	company = strings.TrimSpace(company)
	if company == "" {
		return company, CompanyRegistrationConfig{}, false
	}
	for _, cfg := range companyRegistrationSettings.Configs {
		if cfg.Company == company {
			return cfg.DisplayName, cfg, true
		}
	}
	for _, cfg := range companyRegistrationSettings.Configs {
		if cfg.DisplayName == company {
			return cfg.DisplayName, cfg, true
		}
	}
	return company, CompanyRegistrationConfig{}, false
}

func NormalizeCompanyRegistrationConfigsJSON(value string) (string, error) {
	var configs []CompanyRegistrationConfig
	if err := common.UnmarshalJsonStr(value, &configs); err != nil {
		return "", errors.New("Invalid company registration configuration")
	}
	if configs == nil {
		configs = []CompanyRegistrationConfig{}
	}
	for i := range configs {
		cfg := &configs[i]
		cfg.Company = strings.TrimSpace(cfg.Company)
		cfg.DisplayName = strings.TrimSpace(cfg.DisplayName)
		if cfg.Company == "" {
			return "", errors.New("Company name is required")
		}
		if cfg.DisplayName == "" {
			cfg.DisplayName = cfg.Company
		}
		for _, name := range []string{cfg.Company, cfg.DisplayName} {
			if !utf8.ValidString(name) || strings.ContainsRune(name, '\x00') || utf8.RuneCountInString(name) > 128 {
				return "", errors.New("Invalid company registration configuration")
			}
		}
		if cfg.AutoSubscribePlanId < 0 {
			return "", errors.New("Invalid company registration configuration")
		}
	}
	normalized, err := common.Marshal(configs)
	return string(normalized), err
}
