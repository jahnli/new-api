package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// SetUserDisableTime records the time consumed by the external disable job.
func SetUserDisableTime(id, actorID int, action string, disableAt int64) (*int64, error) {
	var scheduled *int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var target, actor User
		if err := lockForUpdate(tx).Select("id", "role", "status").First(&target, id).Error; err != nil {
			return err
		}
		if err := lockForUpdate(tx).Select("role", "status").First(&actor, actorID).Error; err != nil {
			return err
		}
		activeAdmin := actor.Status == common.UserStatusEnabled && actor.Role >= common.RoleAdminUser
		canManage := actor.Role == common.RoleRootUser || actor.Role > target.Role
		if !activeAdmin || !canManage || target.Role == common.RoleRootUser {
			return common.NewMessage("No permission to update users of same or higher permission level")
		}
		if action == "cancel_disable" {
			return tx.Model(&target).UpdateColumn("disable_at", nil).Error
		}
		if target.Status != common.UserStatusEnabled {
			return common.NewMessage("Invalid parameters")
		}
		now := time.Now().Unix()
		switch action {
		case "disable":
			disableAt = now
		case "schedule_disable":
			if disableAt <= now {
				return common.NewMessage("Select a future date")
			}
		default:
			return common.NewMessage("Invalid parameters")
		}
		scheduled = &disableAt
		return tx.Model(&target).UpdateColumn("disable_at", disableAt).Error
	})
	return scheduled, err
}
