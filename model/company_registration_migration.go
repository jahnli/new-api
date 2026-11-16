package model

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MigrateLegacyLDAPSettings retains registration rules before removing directory credentials.
// All changes commit together; malformed legacy data is left intact for recovery.
func MigrateLegacyLDAPSettings() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var legacyOptions []Option
		if err := tx.Where(commonKeyCol+" LIKE ?", "ldap.%").Find(&legacyOptions).Error; err != nil {
			return err
		}
		if len(legacyOptions) > 0 {
			var existing Option
			err := tx.Where(commonKeyCol+" = ?", system_setting.CompanyRegistrationOptionKey).First(&existing).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if errors.Is(err, gorm.ErrRecordNotFound) {
				for _, option := range legacyOptions {
					if option.Key != "ldap.company_sync_configs" {
						continue
					}
					value := option.Value
					if strings.TrimSpace(value) == "" {
						value = "[]"
					}
					normalized, err := system_setting.NormalizeCompanyRegistrationConfigsJSON(value)
					if err != nil {
						return err
					}
					// A concurrently saved new configuration always takes precedence.
					if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{
						Key: system_setting.CompanyRegistrationOptionKey, Value: normalized,
					}).Error; err != nil {
						return err
					}
				}
			}
			if err := tx.Where(commonKeyCol+" LIKE ?", "ldap.%").Delete(&Option{}).Error; err != nil {
				return err
			}
		}

		var companies []Company
		if err := lockForUpdate(tx).Select("id", "config").Find(&companies).Error; err != nil {
			return err
		}
		for _, company := range companies {
			if strings.TrimSpace(company.Config) == "" {
				continue
			}
			var config map[string]json.RawMessage
			if err := common.UnmarshalJsonStr(company.Config, &config); err != nil {
				return errors.New("invalid legacy company configuration")
			}
			if len(config["login_methods"]) == 0 {
				continue
			}
			var methods []string
			if err := common.Unmarshal(config["login_methods"], &methods); err != nil {
				return errors.New("invalid legacy company login methods")
			}
			retained := make([]string, 0, len(methods))
			for _, method := range methods {
				if strings.EqualFold(strings.TrimSpace(method), "ldap") {
					continue
				}
				retained = append(retained, method)
			}
			if len(retained) == len(methods) {
				continue
			}
			// Do not enable a different authentication method as a migration fallback.
			methodsJSON, err := common.Marshal(retained)
			if err != nil {
				return err
			}
			config["login_methods"] = methodsJSON
			value, err := common.Marshal(config)
			if err != nil {
				return err
			}
			result := tx.Model(&Company{}).Where("id = ?", company.Id).Update("config", string(value))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("company configuration changed during migration")
			}
		}
		return nil
	})
}
