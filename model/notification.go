package model

import (
	"cmp"
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/notificationstore"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const (
	NotificationQueued  = "queued"
	NotificationSending = "sending"
	NotificationSuccess = "success"
	NotificationFailed  = "failed"
	NotificationPartial = "partial"
	NotificationUnknown = "unknown"
)

var (
	ErrNotificationActive   = errors.New("notification is active")
	ErrNotificationConflict = errors.New("notification is active or has no failed recipients")
)

type NotificationRecord struct {
	ID           int                    `json:"id" gorm:"primaryKey"`
	Kind         string                 `json:"-" gorm:"size:16;index"`
	OwnerID      int                    `json:"-" gorm:"index"`
	Name         string                 `json:"-" gorm:"size:128"`
	IsPublic     bool                   `json:"-"`
	StorageKey   string                 `json:"-" gorm:"size:128;index"`
	SenderID     int                    `json:"user_id" gorm:"index:idx_notification_records_sender_id"`
	Sender       string                 `json:"sender_name" gorm:"size:128"`
	DisplayName  string                 `json:"display_name" gorm:"-"`
	AvatarUrl    string                 `json:"avatar_url" gorm:"-"`
	OpenId       string                 `json:"open_id" gorm:"-"`
	Gender       int                    `json:"gender" gorm:"-"`
	Channel      string                 `json:"channel" gorm:"size:16;index:idx_notification_records_channel"`
	CompanyID    int                    `json:"company_id"`
	Title        string                 `json:"title" gorm:"size:512"`
	Summary      string                 `json:"summary" gorm:"type:text"`
	IsTest       bool                   `json:"is_test" gorm:"index:idx_notification_records_is_test"`
	Status       string                 `json:"status" gorm:"size:16;index:idx_notification_queue,priority:1"`
	Total        int                    `json:"total"`
	SuccessCount int                    `json:"success_count"`
	FailedCount  int                    `json:"failed_count"`
	UnknownCount int                    `json:"unknown_count"`
	Claim        string                 `json:"-" gorm:"size:64"`
	LeaseUntil   int64                  `json:"-" gorm:"index:idx_notification_queue,priority:2"`
	CreatedAt    time.Time              `json:"created_at" gorm:"index:idx_notification_records_created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	Message      json.RawMessage        `json:"message,omitempty" gorm:"-"`
	Deliveries   []NotificationDelivery `json:"deliveries,omitempty" gorm:"-"`
}

// Both API projections share one table; only this complete schema is migrated.
func (NotificationRecord) TableName() string { return "notification_messages" }

type NotificationDelivery struct {
	ID        int              `json:"id" gorm:"primaryKey"`
	RecordID  int              `json:"record_id" gorm:"index"`
	Recipient string           `json:"recipient" gorm:"size:320"`
	Status    string           `json:"status" gorm:"size:16"`
	Attempts  int              `json:"attempts"`
	Error     string           `json:"error" gorm:"type:text"`
	MessageID string           `json:"message_id" gorm:"type:text"`
	UpdatedAt time.Time        `json:"updated_at"`
	History   NotificationBlob `json:"-"`
}

// Attempts are JSON snapshots in NotificationDelivery.History, not a table.
// Entries are identified by delivery_id + attempt.
type NotificationAttempt struct {
	DeliveryID int       `json:"delivery_id"`
	Attempt    int       `json:"attempt"`
	Status     string    `json:"status"`
	Error      string    `json:"error"`
	MessageID  string    `json:"message_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type NotificationSavedMessage struct {
	ID         int             `json:"id" gorm:"primaryKey"`
	OwnerID    int             `json:"user_id" gorm:"index"`
	Kind       string          `json:"-" gorm:"size:16;index"`
	Name       string          `json:"name" gorm:"size:128"`
	Channel    string          `json:"channel" gorm:"size:16"`
	Summary    string          `json:"summary" gorm:"type:text"`
	IsPublic   bool            `json:"is_public"`
	StorageKey string          `json:"-" gorm:"size:128;index"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
	Message    json.RawMessage `json:"message,omitempty" gorm:"-"`
}

func (NotificationSavedMessage) TableName() string { return "notification_messages" }

// Delivery attempt history uses a binary JSON snapshot. Notification tables
// live only in the main database, never the independent log database.
type NotificationBlob []byte

func (NotificationBlob) GormDataType() string { return "bytes" }
func (NotificationBlob) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	switch db.Dialector.Name() {
	case "mysql":
		return "LONGBLOB"
	case "postgres":
		return "BYTEA"
	default:
		return "BLOB"
	}
}
func (value NotificationBlob) Value() (driver.Value, error) { return []byte(value), nil }
func (value *NotificationBlob) Scan(src any) error {
	switch data := src.(type) {
	case []byte:
		*value = append((*value)[:0], data...)
	case string:
		*value = append((*value)[:0], data...)
	case nil:
		*value = nil
	default:
		return fmt.Errorf("unsupported notification payload type %T", src)
	}
	return nil
}

func CreateNotification(ctx context.Context, record *NotificationRecord, payload []byte, recipients []string) error {
	stage, err := stageNotificationSnapshot(ctx, DB, payload)
	if err != nil {
		return err
	}
	record.StorageKey = stage.StorageKey
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := commitNotificationSnapshot(tx, stage, ""); err != nil {
			return err
		}
		record.Kind = "record"
		record.Status, record.Total = NotificationQueued, len(recipients)
		if strings.HasPrefix(record.Claim, "direct:") {
			record.Status = NotificationSending
			record.LeaseUntil = time.Now().Add(3 * time.Minute).Unix()
		}
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		deliveries := make([]NotificationDelivery, len(recipients))
		for i, recipient := range recipients {
			deliveries[i] = NotificationDelivery{RecordID: record.ID, Recipient: recipient, Status: NotificationQueued}
		}
		return tx.CreateInBatches(deliveries, 100).Error
	})
}

type NotificationFilter struct {
	ViewerID                         int
	Admin                            bool
	IncludeTests                     bool
	Channel, Status, Keyword, Sender string
	From, To                         *time.Time
	Page, PageSize                   int
}

func notificationQuery(filter NotificationFilter) *gorm.DB {
	query := DB.Model(&NotificationRecord{}).Where("kind = ?", "record")
	if !filter.Admin {
		query = query.Where("sender_id = ?", filter.ViewerID)
	}
	if !filter.IncludeTests {
		query = query.Where("is_test = ?", false)
	}
	if filter.Channel != "" {
		query = query.Where("channel = ?", filter.Channel)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Keyword != "" {
		query = query.Where("title LIKE ? OR summary LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
	}
	if filter.Sender != "" {
		query = query.Where("sender = ?", filter.Sender)
	}
	if filter.From != nil {
		query = query.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("created_at <= ?", *filter.To)
	}
	return query
}

func ListNotifications(filter NotificationFilter) ([]NotificationRecord, int64, error) {
	var count int64
	if err := notificationQuery(filter).Count(&count).Error; err != nil {
		return nil, 0, err
	}
	items := make([]NotificationRecord, 0)
	if err := notificationQuery(filter).Order("id desc").Offset((filter.Page - 1) * filter.PageSize).Limit(filter.PageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}

	senderIDs := make(map[int]struct{}, len(items))
	for _, item := range items {
		if item.SenderID != 0 {
			senderIDs[item.SenderID] = struct{}{}
		}
	}
	if len(senderIDs) == 0 {
		return items, count, nil
	}

	ids := make([]int, 0, len(senderIDs))
	for id := range senderIDs {
		ids = append(ids, id)
	}
	type senderInfo struct {
		ID          int    `gorm:"column:id"`
		DisplayName string `gorm:"column:display_name"`
		AvatarUrl   string `gorm:"column:avatar_url"`
		OpenId      string `gorm:"column:open_id"`
		Gender      int    `gorm:"column:gender"`
	}
	var senders []senderInfo
	if err := DB.Table("users").Select("id, display_name, avatar_url, open_id, gender").Where("id IN ?", ids).Find(&senders).Error; err != nil {
		return nil, 0, err
	}
	senderByID := make(map[int]senderInfo, len(senders))
	for _, sender := range senders {
		senderByID[sender.ID] = sender
	}
	for i := range items {
		sender, ok := senderByID[items[i].SenderID]
		if !ok {
			continue
		}
		items[i].DisplayName = sender.DisplayName
		items[i].AvatarUrl = sender.AvatarUrl
		items[i].OpenId = sender.OpenId
		items[i].Gender = sender.Gender
	}
	return items, count, nil
}

func GetNotification(id, viewerID int, admin, includeMessage bool) (*NotificationRecord, error) {
	var record NotificationRecord
	query := DB.Where("id = ? AND kind = ?", id, "record")
	if !admin {
		query = query.Where("sender_id = ?", viewerID)
	}
	if err := query.First(&record).Error; err != nil {
		return nil, err
	}
	if includeMessage {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		payload, err := notificationstore.Read(ctx, record.StorageKey, id, true)
		if err != nil {
			return nil, err
		}
		record.Message = payload
	}
	if err := DB.Omit("history").Where("record_id = ?", id).Order("id asc").Find(&record.Deliveries).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func NotificationAttempts(recordID int) ([]NotificationAttempt, error) {
	var deliveries []NotificationDelivery
	if err := DB.Select("id", "history").Where("record_id = ?", recordID).Order("id asc").Find(&deliveries).Error; err != nil {
		return nil, err
	}
	attempts := make([]NotificationAttempt, 0)
	for _, delivery := range deliveries {
		if len(delivery.History) == 0 {
			continue
		}
		var history []NotificationAttempt
		if err := common.Unmarshal(delivery.History, &history); err != nil {
			return nil, err
		}
		attempts = append(attempts, history...)
	}
	slices.SortFunc(attempts, func(a, b NotificationAttempt) int {
		if order := a.CreatedAt.Compare(b.CreatedAt); order != 0 {
			return order
		}
		if order := cmp.Compare(a.DeliveryID, b.DeliveryID); order != 0 {
			return order
		}
		return cmp.Compare(a.Attempt, b.Attempt)
	})
	return attempts, nil
}

func DeleteNotifications(ids []int, viewerID int, admin bool) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		var records []NotificationRecord
		query := lockForUpdate(tx).Where("id IN ? AND kind = ?", ids, "record").Order("id asc")
		if !admin {
			query = query.Where("sender_id = ?", viewerID)
		}
		if err := query.Find(&records).Error; err != nil {
			return err
		}
		if len(records) != len(ids) {
			return gorm.ErrRecordNotFound
		}
		for _, record := range records {
			if record.Status == NotificationQueued || record.Status == NotificationSending {
				return ErrNotificationActive
			}
		}
		if err := tx.Where("record_id IN ?", ids).Delete(&NotificationDelivery{}).Error; err != nil {
			return err
		}
		result := tx.Model(&NotificationRecord{}).Where("id IN ? AND kind = ?", ids, "record").Updates(map[string]any{"kind": notificationStorageCleanup, "claim": "", "lease_until": 0})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != int64(len(ids)) {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		return err
	}
	cleanupDeletedNotificationStorage(ids)
	return nil
}

// The caller must authorize access to the parent record before using this query.
func ListNotificationDeliveries(recordID int) ([]NotificationDelivery, error) {
	items := make([]NotificationDelivery, 0)
	err := DB.Omit("history").Where("record_id = ?", recordID).Order("id asc").Find(&items).Error
	return items, err
}

func RetryNotification(id, userID int, admin bool, claim string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var record NotificationRecord
		query := lockForUpdate(tx).Where("id = ? AND kind = ?", id, "record")
		if !admin {
			query = query.Where("sender_id = ? AND is_test = ?", userID, true)
		}
		if err := query.First(&record).Error; err != nil {
			return err
		}
		if record.Status == NotificationSending || record.Status == NotificationQueued {
			return ErrNotificationConflict
		}
		result := tx.Model(&NotificationRecord{}).Where("id = ? AND status = ?", id, record.Status).Updates(map[string]any{"status": NotificationSending, "claim": claim, "lease_until": time.Now().Add(3 * time.Minute).Unix()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrNotificationConflict
		}
		result = tx.Model(&NotificationDelivery{}).Where("record_id = ? AND status = ?", id, NotificationFailed).Updates(map[string]any{"status": NotificationQueued, "error": ""})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrNotificationConflict
		}
		return tx.Model(&NotificationRecord{}).Where("id = ?", id).Update("failed_count", 0).Error
	})
}

func ClaimNotification(ctx context.Context, claim string) (*NotificationRecord, error) {
	db := DB.WithContext(ctx)
	var candidate NotificationRecord
	if err := db.Where("kind = ? AND status = ?", "record", NotificationQueued).Order("id asc").First(&candidate).Error; err != nil {
		return nil, err
	}
	result := db.Model(&NotificationRecord{}).Where("id = ? AND status = ?", candidate.ID, NotificationQueued).
		Updates(map[string]any{"status": NotificationSending, "claim": claim, "lease_until": time.Now().Add(3 * time.Minute).Unix()})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	candidate.Claim = claim
	readCtx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	payload, err := notificationstore.Read(readCtx, candidate.StorageKey, candidate.ID, true)
	if err != nil {
		// No provider was contacted. Record a finite failure instead of looping
		// forever on an unavailable or missing snapshot.
		if failErr := failNotificationSnapshot(candidate.ID, claim); failErr != nil {
			return nil, failErr
		}
		return nil, err
	}
	candidate.Message = payload
	return &candidate, nil
}

// The parent claim excludes other nodes and serializes recipient acquisition.
// Provider requests may overlap after these short transactions commit; each
// acquired recipient stays sending until its own result is durably recorded.
func BeginNotificationDelivery(recordID int, claim string) (*NotificationDelivery, error) {
	var delivery NotificationDelivery
	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&NotificationRecord{}).Where("id = ? AND kind = ? AND claim = ? AND status = ? AND lease_until > ?", recordID, "record", claim, NotificationSending, time.Now().Unix()).
			Updates(map[string]any{"lease_until": time.Now().Add(3 * time.Minute).Unix(), "updated_at": time.Now()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrNotificationConflict
		}
		if err := tx.Omit("history").Where("record_id = ? AND status = ?", recordID, NotificationQueued).Order("id asc").First(&delivery).Error; err != nil {
			return err
		}
		result = tx.Model(&NotificationDelivery{}).Where("id = ? AND status = ?", delivery.ID, NotificationQueued).
			Updates(map[string]any{"status": NotificationSending, "attempts": gorm.Expr("attempts + 1"), "error": ""})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrNotificationConflict
		}
		delivery.Attempts++
		return nil
	})
	return &delivery, err
}

func FinishNotificationDelivery(recordID int, claim string, delivery *NotificationDelivery, status, messageID, reason string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var record NotificationRecord
		if err := lockForUpdate(tx).Where("id = ? AND kind = ? AND claim = ? AND status = ? AND lease_until > ?", recordID, "record", claim, NotificationSending, time.Now().Unix()).First(&record).Error; err != nil {
			return err
		}
		if err := finishNotificationAttempt(tx, recordID, delivery.ID, status, messageID, reason); err != nil {
			return err
		}
		return refreshNotificationState(tx, &record, false)
	})
}

// The parent notification must be locked by the caller. Read the history inside
// that transaction so lease recovery and completion cannot overwrite each other.
func finishNotificationAttempt(tx *gorm.DB, recordID, deliveryID int, status, messageID, reason string) error {
	var delivery NotificationDelivery
	if err := tx.Where("id = ? AND record_id = ? AND status = ?", deliveryID, recordID, NotificationSending).First(&delivery).Error; err != nil {
		return err
	}
	var history []NotificationAttempt
	if len(delivery.History) > 0 {
		if err := common.Unmarshal(delivery.History, &history); err != nil {
			return err
		}
	}
	history = append(history, NotificationAttempt{DeliveryID: delivery.ID, Attempt: delivery.Attempts, Status: status, Error: reason, MessageID: messageID, CreatedAt: time.Now()})
	payload, err := common.Marshal(history)
	if err != nil {
		return err
	}
	result := tx.Model(&NotificationDelivery{}).Where("id = ? AND status = ?", delivery.ID, NotificationSending).
		Updates(map[string]any{"status": status, "error": reason, "message_id": messageID, "history": NotificationBlob(payload)})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrNotificationConflict
	}
	return nil
}

func refreshNotificationState(tx *gorm.DB, record *NotificationRecord, release bool) error {
	var deliveries []NotificationDelivery
	if err := tx.Select("status").Where("record_id = ?", record.ID).Find(&deliveries).Error; err != nil {
		return err
	}
	counts := make(map[string]int)
	for _, delivery := range deliveries {
		counts[delivery.Status]++
	}
	status := NotificationSending
	if release && counts[NotificationQueued] > 0 {
		status = NotificationQueued
	} else if counts[NotificationQueued]+counts[NotificationSending] == 0 {
		switch {
		case counts[NotificationUnknown] > 0:
			status = NotificationUnknown
		case counts[NotificationSuccess] == record.Total:
			status = NotificationSuccess
		case counts[NotificationSuccess] > 0:
			status = NotificationPartial
		default:
			status = NotificationFailed
		}
	}
	updates := map[string]any{"status": status, "success_count": counts[NotificationSuccess], "failed_count": counts[NotificationFailed], "unknown_count": counts[NotificationUnknown]}
	if status != NotificationSending {
		updates["claim"], updates["lease_until"] = "", 0
	}
	return tx.Model(&NotificationRecord{}).Where("id = ? AND claim = ?", record.ID, record.Claim).Updates(updates).Error
}

func RecoverExpiredNotifications() error {
	var records []NotificationRecord
	if err := DB.Where("kind = ? AND status = ? AND lease_until < ?", "record", NotificationSending, time.Now().Unix()).Limit(20).Find(&records).Error; err != nil {
		return err
	}
	for _, expired := range records {
		if err := DB.Transaction(func(tx *gorm.DB) error {
			var record NotificationRecord
			err := lockForUpdate(tx).Where("id = ? AND status = ? AND lease_until < ?", expired.ID, NotificationSending, time.Now().Unix()).First(&record).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			var deliveries []NotificationDelivery
			if err := tx.Omit("history").Where("record_id = ? AND status = ?", record.ID, NotificationSending).Find(&deliveries).Error; err != nil {
				return err
			}
			for _, delivery := range deliveries {
				reason := "worker interrupted; delivery outcome is unknown and will not be retried"
				if err := finishNotificationAttempt(tx, record.ID, delivery.ID, NotificationUnknown, "", reason); err != nil {
					return err
				}
			}
			if strings.HasPrefix(record.Claim, "direct:") {
				if err := tx.Model(&NotificationDelivery{}).Where("record_id = ? AND status = ?", record.ID, NotificationQueued).
					Updates(map[string]any{"status": NotificationFailed, "error": "request interrupted before delivery"}).Error; err != nil {
					return err
				}
				return refreshNotificationState(tx, &record, false)
			}
			return refreshNotificationState(tx, &record, true)
		}); err != nil {
			return err
		}
	}
	return nil
}

// FinishDirectNotification stops unsent recipients when a synchronous request
// ends. They must never be picked up by the background queue after cancellation.
func FinishDirectNotification(id int, claim string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var record NotificationRecord
		if err := lockForUpdate(tx).Where("id = ? AND kind = ?", id, "record").First(&record).Error; err != nil {
			return err
		}
		if record.Status != NotificationSending || record.Claim != claim {
			return nil
		}
		if err := tx.Model(&NotificationDelivery{}).Where("record_id = ? AND status = ?", id, NotificationQueued).
			Updates(map[string]any{"status": NotificationFailed, "error": "request ended before delivery"}).Error; err != nil {
			return err
		}
		return refreshNotificationState(tx, &record, false)
	})
}

func ListNotificationSaved(kind string, userID, page, pageSize int, keyword, scope string) ([]NotificationSavedMessage, int64, error) {
	if kind != "template" && kind != "draft" {
		return nil, 0, errors.New("unsupported notification library kind")
	}
	items := make([]NotificationSavedMessage, 0)
	query := DB.Where("kind = ?", kind)
	if kind == "template" {
		query = query.Where("owner_id = ? OR is_public = ?", userID, true)
	} else {
		query = query.Where("owner_id = ?", userID)
	}
	if keyword != "" {
		query = query.Where("name LIKE ? OR summary LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if scope == "public" {
		query = query.Where("is_public = ?", true)
	} else if scope == "personal" {
		query = query.Where("is_public = ? AND owner_id = ?", false, userID)
	}
	var total int64
	if err := query.Model(&NotificationSavedMessage{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("updated_at desc, id desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetNotificationSaved(id int, kind string, userID int) (*NotificationSavedMessage, error) {
	if kind != "template" && kind != "draft" {
		return nil, errors.New("unsupported notification library kind")
	}
	var item NotificationSavedMessage
	query := DB.Where("id = ? AND kind = ?", id, kind)
	if kind == "template" {
		query = query.Where("owner_id = ? OR is_public = ?", userID, true)
	} else {
		query = query.Where("owner_id = ?", userID)
	}
	if err := query.First(&item).Error; err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	payload, err := notificationstore.Read(ctx, item.StorageKey, id, false)
	if err != nil {
		return nil, err
	}
	item.Message = payload
	return &item, nil
}

func SaveNotificationMessage(ctx context.Context, item *NotificationSavedMessage, payload []byte, userID int, admin bool) error {
	if item.Kind != "template" && item.Kind != "draft" {
		return errors.New("unsupported notification library kind")
	}
	// Reject unauthorized replacements before allocating S3 objects. The same
	// predicate is checked again under lock when committing the replacement.
	if item.ID != 0 {
		query := DB.WithContext(ctx).Where("id = ? AND kind = ?", item.ID, item.Kind)
		if admin && item.Kind == "template" {
			query = query.Where("owner_id = ? OR is_public = ?", userID, true)
		} else {
			query = query.Where("owner_id = ? AND is_public = ?", userID, false)
		}
		var existing NotificationSavedMessage
		if err := query.First(&existing).Error; err != nil {
			return err
		}
	}
	stage, err := stageNotificationSnapshot(ctx, DB, payload)
	if err != nil {
		return err
	}
	item.StorageKey = stage.StorageKey
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		oldKey := ""
		if item.ID == 0 {
			item.OwnerID = userID
			if err := tx.Create(item).Error; err != nil {
				return err
			}
		} else {
			var existing NotificationSavedMessage
			query := lockForUpdate(tx).Where("id = ? AND kind = ?", item.ID, item.Kind)
			if admin && item.Kind == "template" {
				query = query.Where("owner_id = ? OR is_public = ?", userID, true)
			} else {
				query = query.Where("owner_id = ? AND is_public = ?", userID, false)
			}
			if err := query.First(&existing).Error; err != nil {
				return err
			}
			item.OwnerID, item.CreatedAt = existing.OwnerID, existing.CreatedAt
			oldKey = existing.StorageKey
			if err := tx.Model(&existing).Updates(map[string]any{"name": item.Name, "is_public": item.IsPublic, "channel": item.Channel, "summary": item.Summary, "storage_key": item.StorageKey}).Error; err != nil {
				return err
			}
			item.UpdatedAt = existing.UpdatedAt
		}
		return commitNotificationSnapshot(tx, stage, oldKey)
	})
}

func DeleteNotificationSaved(id int, kind string, userID int, admin bool) error {
	if kind != "template" && kind != "draft" {
		return errors.New("unsupported notification library kind")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := tx.Where("id = ? AND kind = ?", id, kind)
		if admin && kind == "template" {
			query = query.Where("owner_id = ? OR is_public = ?", userID, true)
		} else {
			query = query.Where("owner_id = ? AND is_public = ?", userID, false)
		}
		result := query.Model(&NotificationSavedMessage{}).Updates(map[string]any{"kind": notificationStorageCleanup, "claim": "", "lease_until": 0})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		return err
	}
	cleanupDeletedNotificationStorage([]int{id})
	return nil
}
