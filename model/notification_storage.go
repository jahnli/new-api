package model

import (
	"context"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/notificationstore"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const notificationStoragePending = "storage_pending"
const notificationStorageCleanup = "storage_cleanup"

// Pending uploads and deferred deletions use internal rows in the existing
// messages table. This durable ledger avoids a third table and never scans or
// deletes directories belonging to another database sharing the bucket.
func stageNotificationSnapshot(ctx context.Context, db *gorm.DB, payload []byte) (*NotificationRecord, error) {
	stage := &NotificationRecord{Kind: notificationStoragePending, StorageKey: notificationstore.NewKey()}
	if err := db.WithContext(ctx).Create(stage).Error; err != nil {
		return nil, err
	}
	uploadCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	if err := notificationstore.Write(uploadCtx, stage.StorageKey, payload); err != nil {
		return nil, err
	}
	return stage, nil
}

// Commit the new reference and consume its upload reservation in the same DB
// transaction. Old snapshots stay readable for a grace period before cleanup.
func commitNotificationSnapshot(tx *gorm.DB, stage *NotificationRecord, oldKey string) error {
	var pending NotificationRecord
	if err := lockForUpdate(tx).Where("id = ? AND kind = ? AND storage_key = ?", stage.ID, notificationStoragePending, stage.StorageKey).First(&pending).Error; err != nil {
		return err
	}
	if time.Since(pending.CreatedAt) > 10*time.Minute {
		return errors.New("notification upload reservation expired")
	}
	if oldKey == "" {
		return tx.Delete(&pending).Error
	}
	return tx.Model(&pending).Updates(map[string]any{
		"kind": notificationStorageCleanup, "storage_key": oldKey,
		"lease_until": time.Now().Add(24 * time.Hour).Unix(),
	}).Error
}

// NotificationImageKey authorizes both records and saved messages using the
// same ownership/public-template rules as their detail endpoints.
func NotificationImageKey(id, viewerID int, admin bool) (string, error) {
	var record NotificationRecord
	if err := DB.Where("id = ? AND kind IN ?", id, []string{"record", "template", "draft"}).First(&record).Error; err != nil {
		return "", err
	}
	allowed := record.OwnerID == viewerID
	if record.Kind == "record" {
		allowed = admin || record.SenderID == viewerID
	}
	if record.Kind == "template" && record.IsPublic {
		allowed = true
	}
	if !allowed {
		return "", gorm.ErrRecordNotFound
	}
	return record.StorageKey, nil
}

func failNotificationSnapshot(id int, claim string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var record NotificationRecord
		if err := lockForUpdate(tx).Where("id = ? AND kind = ? AND claim = ? AND status = ?", id, "record", claim, NotificationSending).First(&record).Error; err != nil {
			return err
		}
		if err := tx.Model(&NotificationDelivery{}).Where("record_id = ? AND status = ?", id, NotificationQueued).Updates(map[string]any{"status": NotificationFailed, "error": "notification content could not be loaded; retry after restoring storage"}).Error; err != nil {
			return err
		}
		return refreshNotificationState(tx, &record, false)
	})
}

// CleanupNotificationStorage is safe to retry and safe across multiple workers.
// References are detached in a transaction before any S3 object is removed.
// Passing IDs limits synchronous cleanup to the records just deleted. Only
// abandoned uploads and replaced snapshots retain a grace period.
func CleanupNotificationStorage(ctx context.Context, ids ...int) error {
	db := DB.WithContext(ctx)
	query := db.Where("lease_until < ? AND (kind = ? OR (kind = ? AND updated_at < ?))",
		time.Now().Unix(), notificationStorageCleanup, notificationStoragePending, time.Now().Add(-24*time.Hour))
	if len(ids) > 0 {
		query = query.Where("id IN ?", ids)
	} else {
		query = query.Limit(20)
	}
	var candidates []NotificationRecord
	if err := query.Order("id asc").Find(&candidates).Error; err != nil {
		return err
	}
	var cleanupErrors []error
	for _, candidate := range candidates {
		if err := ctx.Err(); err != nil {
			return errors.Join(append(cleanupErrors, err)...)
		}
		claim := uuid.NewString()
		result := db.Model(&NotificationRecord{}).Where("id = ? AND kind = ? AND updated_at = ? AND lease_until < ?", candidate.ID, candidate.Kind, candidate.UpdatedAt, time.Now().Unix()).UpdateColumns(map[string]any{"kind": notificationStorageCleanup, "claim": claim, "lease_until": time.Now().Add(5 * time.Minute).Unix()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		var references int64
		if err := db.Model(&NotificationRecord{}).Where("storage_key = ? AND kind IN ?", candidate.StorageKey, []string{"record", "template", "draft"}).Count(&references).Error; err != nil {
			return err
		}
		if references > 0 {
			cleanupErrors = append(cleanupErrors, errors.New("notification cleanup found a live snapshot reference"))
			continue
		}
		deleteCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		err := notificationstore.Delete(deleteCtx, candidate.StorageKey)
		cancel()
		if err != nil {
			cleanupErrors = append(cleanupErrors, err)
			continue
		}
		if err := db.Where("id = ? AND kind = ? AND claim = ?", candidate.ID, notificationStorageCleanup, claim).Delete(&NotificationRecord{}).Error; err != nil {
			return err
		}
	}
	return errors.Join(cleanupErrors...)
}

// A committed deletion must not be reported as failed just because S3 is down.
// The durable cleanup row remains available to the background retry worker.
func cleanupDeletedNotificationStorage(ids []int) {
	if len(ids) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := CleanupNotificationStorage(ctx, ids...); err != nil {
		common.SysError("notification deleted; object cleanup deferred for background retry")
	}
}
