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

// GetSalesUserIDs preserves legacy assignments until they are explicitly edited.
// An empty, non-nil list represents an explicitly cleared assignment.
func (user *User) GetSalesUserIDs() []int {
	if user.SalesUserIDs != nil {
		return user.SalesUserIDs
	}
	if user.SalesUserID > 0 {
		return []int{user.SalesUserID}
	}
	return []int{}
}

// LoadUserSales batches lookups and omits missing/deleted/non-sales contacts.
// Original IDs remain available so administrators can remove invalid contacts.
func LoadUserSales(users []*User) error {
	if !operation_setting.ExternalModeEnabled {
		return nil
	}
	ids := make([]int, 0)
	seen := make(map[int]bool)
	for _, user := range users {
		user.SalesUser = nil
		user.SalesUsers = nil
		user.SalesUserIDs = user.GetSalesUserIDs()
		for _, id := range user.SalesUserIDs {
			if id > 0 && !seen[id] {
				ids = append(ids, id)
				seen[id] = true
			}
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
		for _, id := range user.SalesUserIDs {
			if contact, ok := contacts[id]; ok {
				user.SalesUsers = append(user.SalesUsers, contact)
			}
		}
		if len(user.SalesUsers) > 0 {
			user.SalesUser = &user.SalesUsers[0]
		}
	}
	return nil
}
