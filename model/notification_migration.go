package model

import (
	"bytes"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Run during startup, with all old application instances stopped. Each copy and
// source-row removal commits together; DDL stays outside transactions for MySQL.
// A failed migration stops startup and can be resumed without duplicate data.
func migrateNotificationStorage(db *gorm.DB) error {
	if db.Migrator().HasTable("notification_records") {
		if db.Migrator().HasTable("notification_messages") {
			return errors.New("both notification_records and notification_messages exist; refusing an ambiguous notification migration")
		}
		var active int64
		if err := db.Table("notification_records").Where("status = ? AND lease_until > ?", NotificationSending, time.Now().Unix()).Count(&active).Error; err != nil {
			return err
		}
		if active > 0 {
			return errors.New("notification deliveries are still active; stop old instances and wait for their leases to expire before upgrading")
		}
		// Renaming preserves record IDs, delivery/payload references, indexes and
		// the database-managed primary-key sequence, including PostgreSQL's.
		if err := db.Migrator().RenameTable("notification_records", "notification_messages"); err != nil {
			return err
		}
	}
	if err := db.AutoMigrate(&NotificationRecord{}, &NotificationDelivery{}, &NotificationPayload{}); err != nil {
		return err
	}
	if err := db.Model(&NotificationRecord{}).Where("kind IS NULL OR kind = ?", "").UpdateColumn("kind", "record").Error; err != nil {
		return err
	}
	if err := migrateNotificationSavedMessages(db); err != nil {
		return fmt.Errorf("migrate notification templates: %w", err)
	}
	if err := migrateNotificationAttempts(db); err != nil {
		return fmt.Errorf("migrate notification attempts: %w", err)
	}
	return nil
}

func migrateNotificationSavedMessages(db *gorm.DB) error {
	const legacyTable = "notification_saved_messages"
	if !db.Migrator().HasTable(legacyTable) {
		return nil
	}
	for {
		// Only one saved message is moved per transaction. Large images remain in
		// their original payload rows, so migration never builds a large SQL packet.
		err := db.Transaction(func(tx *gorm.DB) error {
			var item NotificationSavedMessage
			if err := lockForUpdate(tx).Table(legacyTable).Order("id asc").First(&item).Error; err != nil {
				return err
			}
			if item.Kind != "template" && item.Kind != "draft" {
				return fmt.Errorf("unsupported saved notification kind %q for ID %d", item.Kind, item.ID)
			}
			oldID := item.ID
			var parts []NotificationPayload
			if err := tx.Select("id", "part").Where("kind = ? AND owner_id = ?", "saved", oldID).Order("part asc").Find(&parts).Error; err != nil {
				return err
			}
			if len(parts) == 0 {
				return fmt.Errorf("saved notification %d has no payload", oldID)
			}
			for i, part := range parts {
				if part.Part != i {
					return fmt.Errorf("saved notification %d has an incomplete payload", oldID)
				}
			}
			item.ID = 0
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
			var copied NotificationSavedMessage
			if err := tx.First(&copied, item.ID).Error; err != nil {
				return err
			}
			if copied.OwnerID != item.OwnerID || copied.Kind != item.Kind || copied.Name != item.Name || copied.Channel != item.Channel || copied.Summary != item.Summary || copied.IsPublic != item.IsPublic || !copied.CreatedAt.Equal(item.CreatedAt) || !copied.UpdatedAt.Equal(item.UpdatedAt) {
				return fmt.Errorf("saved notification %d failed copy verification", oldID)
			}
			// A different namespace prevents collisions with unmigrated saved IDs.
			result := tx.Model(&NotificationPayload{}).Where("kind = ? AND owner_id = ?", "saved", oldID).
				Updates(map[string]any{"kind": "saved_message", "owner_id": item.ID})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != int64(len(parts)) {
				return fmt.Errorf("saved notification %d payload count changed during migration", oldID)
			}
			result = tx.Table(legacyTable).Where("id = ?", oldID).Delete(&NotificationSavedMessage{})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("saved notification changed during migration")
			}
			return nil
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			break
		}
		if err != nil {
			return err
		}
	}
	var remaining int64
	if err := db.Table(legacyTable).Count(&remaining).Error; err != nil {
		return err
	}
	if remaining != 0 {
		return errors.New("legacy saved notifications remain after migration")
	}
	return db.Migrator().DropTable(legacyTable)
}

func migrateNotificationAttempts(db *gorm.DB) error {
	const legacyTable = "notification_attempts"
	if !db.Migrator().HasTable(legacyTable) {
		return nil
	}
	for {
		err := db.Transaction(func(tx *gorm.DB) error {
			var first NotificationAttempt
			if err := tx.Table(legacyTable).Order("id asc").First(&first).Error; err != nil {
				return err
			}
			var delivery NotificationDelivery
			if err := lockForUpdate(tx).First(&delivery, first.DeliveryID).Error; err != nil {
				// An orphan must stop migration rather than silently discard history.
				return fmt.Errorf("attempt %d has no accessible delivery %d: %v", first.ID, first.DeliveryID, err)
			}
			var history []NotificationAttempt
			if len(delivery.History) > 0 {
				if err := common.Unmarshal(delivery.History, &history); err != nil {
					return err
				}
			}
			var attempts []NotificationAttempt
			if err := tx.Table(legacyTable).Where("delivery_id = ?", delivery.ID).Order("id asc").Find(&attempts).Error; err != nil {
				return err
			}
			history = append(history, attempts...)
			payload, err := common.Marshal(history)
			if err != nil {
				return err
			}
			if err := tx.Model(&delivery).UpdateColumn("history", NotificationBlob(payload)).Error; err != nil {
				return err
			}
			var copied NotificationDelivery
			if err := tx.Select("id", "history").First(&copied, delivery.ID).Error; err != nil {
				return err
			}
			if !bytes.Equal(copied.History, payload) {
				return fmt.Errorf("delivery %d failed history verification", delivery.ID)
			}
			result := tx.Table(legacyTable).Where("delivery_id = ?", delivery.ID).Delete(&NotificationAttempt{})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != int64(len(attempts)) {
				return fmt.Errorf("delivery %d history changed during migration", delivery.ID)
			}
			return nil
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			break
		}
		if err != nil {
			return err
		}
	}
	var remaining int64
	if err := db.Table(legacyTable).Count(&remaining).Error; err != nil {
		return err
	}
	if remaining != 0 {
		return errors.New("legacy notification attempts remain after migration")
	}
	return db.Migrator().DropTable(legacyTable)
}
