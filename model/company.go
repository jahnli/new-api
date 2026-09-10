package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	CompanyPlatformNone     = "none"
	CompanyPlatformFeishu   = "feishu"
	CompanyPlatformDingTalk = "dingtalk"

	CompanyStatusEnabled  = "enabled"
	CompanyStatusDisabled = "disabled"

	CompanyLoginMethodPassword = "password"
	CompanyLoginMethodLDAP     = "ldap"
	CompanyLoginMethodPlatform = "platform"
)

type Company struct {
	Id        int       `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"type:varchar(128);not null;uniqueIndex"`
	Alias     string    `json:"alias" gorm:"type:varchar(128);not null"`
	Platform  string    `json:"platform" gorm:"type:varchar(32);not null"`
	Status    string    `json:"status" gorm:"type:varchar(32);not null"`
	SortOrder int       `json:"sort_order" gorm:"type:int;not null"`
	Config    string    `json:"-" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CompanyConfig struct {
	LoginMethods []string              `json:"login_methods"`
	Feishu       CompanyFeishuConfig   `json:"feishu"`
	DingTalk     CompanyDingTalkConfig `json:"dingtalk"`
}

type CompanyFeishuConfig struct {
	AppID     string `json:"app_id"`
	AppSecret string `json:"app_secret"`
}

type CompanyDingTalkConfig struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	AgentID      int64  `json:"agent_id"`
}

func (Company) TableName() string {
	return "companies"
}

func (company *Company) NormalizeAndValidate() error {
	company.Name = NormalizeCompany(company.Name)
	company.Alias = strings.TrimSpace(company.Alias)
	company.Platform = strings.ToLower(strings.TrimSpace(company.Platform))
	company.Status = strings.ToLower(strings.TrimSpace(company.Status))

	if company.Name == "" {
		return errors.New("company name is required")
	}
	if len([]rune(company.Name)) > 128 {
		return errors.New("company name must not exceed 128 characters")
	}
	if len([]rune(company.Alias)) > 128 {
		return errors.New("company alias must not exceed 128 characters")
	}
	if company.Platform == "" {
		company.Platform = CompanyPlatformNone
	}
	switch company.Platform {
	case CompanyPlatformNone, CompanyPlatformFeishu, CompanyPlatformDingTalk:
	default:
		return errors.New("company platform must be none, feishu, or dingtalk")
	}
	if company.Status == "" {
		company.Status = CompanyStatusEnabled
	}
	if company.Status != CompanyStatusEnabled && company.Status != CompanyStatusDisabled {
		return errors.New("company status must be enabled or disabled")
	}

	config, err := company.GetConfig()
	if err != nil {
		return err
	}
	if err := company.SetConfig(config); err != nil {
		return err
	}
	config, err = company.GetConfig()
	if err != nil {
		return err
	}
	if company.Platform == CompanyPlatformNone {
		for _, method := range config.LoginMethods {
			if method == CompanyLoginMethodPlatform {
				return errors.New("platform login requires a company platform")
			}
		}
	}
	return nil
}

func (company *Company) GetConfig() (CompanyConfig, error) {
	var config CompanyConfig
	if strings.TrimSpace(company.Config) == "" {
		return config, nil
	}
	if err := common.UnmarshalJsonStr(company.Config, &config); err != nil {
		return CompanyConfig{}, errors.New("company config must be valid JSON")
	}
	return config, nil
}

func (company *Company) SetConfig(config CompanyConfig) error {
	seenLoginMethods := make(map[string]struct{}, len(config.LoginMethods))
	normalizedLoginMethods := make([]string, 0, len(config.LoginMethods))
	for _, method := range config.LoginMethods {
		method = strings.ToLower(strings.TrimSpace(method))
		if method == "" {
			continue
		}
		switch method {
		case CompanyLoginMethodPassword, CompanyLoginMethodLDAP, CompanyLoginMethodPlatform:
		default:
			return errors.New("company login method must be password, ldap, or platform")
		}
		if _, exists := seenLoginMethods[method]; exists {
			continue
		}
		seenLoginMethods[method] = struct{}{}
		normalizedLoginMethods = append(normalizedLoginMethods, method)
	}
	if len(normalizedLoginMethods) == 0 {
		normalizedLoginMethods = append(normalizedLoginMethods, CompanyLoginMethodPassword)
	}
	config.LoginMethods = normalizedLoginMethods
	config.Feishu.AppID = strings.TrimSpace(config.Feishu.AppID)
	config.Feishu.AppSecret = strings.TrimSpace(config.Feishu.AppSecret)
	config.DingTalk.ClientID = strings.TrimSpace(config.DingTalk.ClientID)
	config.DingTalk.ClientSecret = strings.TrimSpace(config.DingTalk.ClientSecret)

	data, err := common.Marshal(config)
	if err != nil {
		return err
	}
	company.Config = string(data)
	return nil
}

func ListCompanies(offset, limit int) ([]*Company, int64, error) {
	var total int64
	if err := DB.Model(&Company{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var companies []*Company
	if err := DB.Order("sort_order asc, id asc").Offset(offset).Limit(limit).Find(&companies).Error; err != nil {
		return nil, 0, err
	}
	return companies, total, nil
}

func ListEnabledCompanies() ([]*Company, error) {
	var companies []*Company
	if err := DB.Where("status = ?", CompanyStatusEnabled).
		Order("sort_order asc, id asc").
		Find(&companies).Error; err != nil {
		return nil, err
	}
	return companies, nil
}

func GetEnabledCompanyByID(id int) (*Company, error) {
	var company Company
	if err := DB.Where("id = ? AND status = ?", id, CompanyStatusEnabled).First(&company).Error; err != nil {
		return nil, err
	}
	return &company, nil
}

func GetCompanyByID(id int) (*Company, error) {
	var company Company
	if err := DB.First(&company, id).Error; err != nil {
		return nil, err
	}
	return &company, nil
}

func IsCompanyNameTaken(name string, excludeID int) (bool, error) {
	name = NormalizeCompany(name)
	if name == "" {
		return false, nil
	}
	var count int64
	query := DB.Model(&Company{}).Where("name = ?", name)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func CreateCompany(company *Company) error {
	if err := company.NormalizeAndValidate(); err != nil {
		return err
	}
	return DB.Create(company).Error
}

func UpdateCompany(company *Company) error {
	if company.Id <= 0 {
		return errors.New("company ID is required")
	}
	if err := company.NormalizeAndValidate(); err != nil {
		return err
	}
	result := DB.Model(&Company{}).
		Where("id = ?", company.Id).
		Select("name", "alias", "platform", "status", "sort_order", "config").
		Updates(company)
	if result.Error != nil {
		return result.Error
	}
	return DB.First(company, company.Id).Error
}

func UpdateCompanyStatus(id int, status string) (*Company, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	if status != CompanyStatusEnabled && status != CompanyStatusDisabled {
		return nil, errors.New("company status must be enabled or disabled")
	}
	result := DB.Model(&Company{}).Where("id = ?", id).Update("status", status)
	if result.Error != nil {
		return nil, result.Error
	}
	return GetCompanyByID(id)
}
