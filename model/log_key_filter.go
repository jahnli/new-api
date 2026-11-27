package model

import (
	"context"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// KeyNameFilter matches names as recorded when a request was logged. A selected
// suggestion identifies an owner and name, including all of their duplicate keys.
type KeyNameFilter struct {
	KeyKeyword string `form:"key_keyword"`
	KeyName    string `form:"key_name"`
	KeyOwnerID int    `form:"key_owner_id" binding:"min=0"`
}

func (f KeyNameFilter) apply(tx *gorm.DB) (*gorm.DB, error) {
	if f.KeyName != "" || f.KeyOwnerID != 0 {
		if f.KeyOwnerID <= 0 || f.KeyName == "" {
			return nil, common.NewMessage("Invalid parameters")
		}
		column := "logs.token_name"
		if tx.Dialector.Name() == string(common.DatabaseTypeMySQL) {
			column = "BINARY logs.token_name"
		}
		tx = tx.Where("logs.token_id > 0 AND logs.user_id = ?", f.KeyOwnerID).Where(column+" = ?", f.KeyName)
	}
	if keyword := strings.TrimSpace(f.KeyKeyword); keyword != "" {
		condition, pattern, err := buildLogContainsCondition("LOWER(logs.token_name)", strings.ToLower(keyword), common.DatabaseType(tx.Dialector.Name()))
		if err != nil {
			return nil, err
		}
		tx = tx.Where("logs.token_id > 0").Where(condition, pattern)
	}
	return tx, nil
}

type LogKeySuggestion struct {
	Name     string `json:"name"`
	UserID   int    `json:"user_id"`
	Username string `json:"username,omitempty"`
}

func GetLogKeySuggestions(ctx context.Context, userID int, keyword string) ([]LogKeySuggestion, error) {
	items := []LogKeySuggestion{}
	keyword = strings.TrimSpace(keyword)
	if userID == 0 && keyword == "" {
		return items, nil
	}
	tx := DB.WithContext(ctx).Model(&Token{}).Where("tokens.name <> ''")
	limit := 20
	if userID > 0 {
		tx = tx.Where("tokens.user_id = ?", userID)
	}
	if keyword == "" {
		limit = 10
	} else {
		condition, pattern, err := buildLogContainsCondition("LOWER(tokens.name)", strings.ToLower(keyword), common.MainDatabaseType())
		if err != nil {
			return nil, err
		}
		tx = tx.Where(condition, pattern)
	}
	tx = tx.Select("tokens.name, tokens.user_id").Group("tokens.user_id, tokens.name")
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		tx = tx.Group("BINARY tokens.name")
	}
	if userID == 0 {
		tx = tx.Joins("JOIN users ON users.id = tokens.user_id").Select("tokens.name, tokens.user_id, users.username").Group("users.username")
	}
	err := tx.Order("MAX(tokens.accessed_time) DESC, tokens.user_id, tokens.name").Limit(limit).Scan(&items).Error
	return items, err
}
