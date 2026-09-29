package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// SalesUser is the public identity needed to select or display a user's sales contact.
type SalesUser struct {
	ID              int    `json:"id"`
	Username        string `json:"username"`
	DisplayName     string `json:"display_name"`
	AvatarURL       string `json:"avatar_url"`
	Role            int    `json:"role"`
	Email           string `json:"email"`
	Mobile          string `json:"mobile"`
	JobNumber       string `json:"job_number"`
	Description     string `json:"description"`
	BackgroundImage string `json:"background_image"`
	Company         string `json:"company"`
	Gender          int    `json:"gender"`
	OpenID          string `json:"open_id"`
}

func GetSalesUsers() ([]SalesUser, error) {
	users := make([]SalesUser, 0)
	err := DB.Model(&User{}).Select("id", "username", "display_name").
		Where("role = ?", common.RoleBUBP).Order("id ASC").Find(&users).Error
	return users, err
}

// LoadUserSales batches lookups and leaves missing/deleted/non-sales contacts nil.
// The original ID remains available so administrators can reassign invalid contacts.
func LoadUserSales(users []*User) error {
	if !operation_setting.ExternalModeEnabled {
		return nil
	}
	ids := make([]int, 0)
	seen := make(map[int]bool)
	for _, user := range users {
		user.SalesUser = nil
		if user.SalesUserID > 0 && !seen[user.SalesUserID] {
			ids = append(ids, user.SalesUserID)
			seen[user.SalesUserID] = true
		}
	}
	contacts := make(map[int]SalesUser, len(ids))
	// Keep bind parameters below SQLite's limit, including computed-sort lists.
	for start := 0; start < len(ids); start += 500 {
		var batch []SalesUser
		if err := DB.Model(&User{}).Select("id", "username", "display_name", "avatar_url", "role", "email", "mobile", "job_number", "description", "background_image", "company", "gender", "open_id").
			Where("id IN ? AND role = ?", ids[start:min(start+500, len(ids))], common.RoleBUBP).
			Find(&batch).Error; err != nil {
			return err
		}
		for _, contact := range batch {
			contacts[contact.ID] = contact
		}
	}
	for _, user := range users {
		if contact, ok := contacts[user.SalesUserID]; ok {
			user.SalesUser = &contact
		}
	}
	return nil
}
