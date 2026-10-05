package model

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

// SMTPAudit is stored in the main database even when logs use a separate store.
type SMTPAudit struct {
	ID                     int `json:"id" gorm:"primaryKey"`
	common.SMTPAuditRecord `gorm:"embedded"`
}

func (SMTPAudit) TableName() string { return "smtp_audit_logs" }

type SMTPAuditFilter struct {
	Status         string `form:"status" binding:"omitempty,oneof=sending accepted failed unknown"`
	Purpose        string `form:"purpose" binding:"max=64"`
	Recipient      string `form:"recipient" binding:"max=254"`
	UserID         *int   `form:"user_id" binding:"omitempty,gte=0"`
	RequestID      string `form:"request_id" binding:"max=64"`
	StartTimestamp int64  `form:"start_timestamp" binding:"gte=0"`
	EndTimestamp   int64  `form:"end_timestamp" binding:"gte=0"`
	IsTest         *bool  `form:"is_test"`
}

// RecordSMTPAudit has its own bounded context: a canceled mail request must not
// discard its final audit result. A late start callback cannot replace a final
// record, and a final callback can insert even when the start insert failed.
func RecordSMTPAudit(record common.SMTPAuditRecord) error {
	if record.AttemptID == "" {
		return errors.New("SMTP audit attempt ID is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	db := DB.WithContext(ctx)
	row := SMTPAudit{SMTPAuditRecord: record}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "attempt_id"}},
		DoNothing: true,
	}).Create(&row).Error; err != nil {
		return err
	}
	if record.Status == "sending" {
		return nil
	}
	// An actual final callback may replace a maintenance-generated unknown, but
	// duplicate or delayed callbacks cannot replace an established final result.
	return db.Model(&SMTPAudit{}).
		Where("attempt_id = ? AND status IN ?", record.AttemptID, []string{"sending", "unknown"}).
		Select("*").Omit("id").Updates(&SMTPAudit{SMTPAuditRecord: record}).Error
}

func ListSMTPAudits(ctx context.Context, filter SMTPAuditFilter, offset, limit int) ([]SMTPAudit, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	db := DB.WithContext(ctx).Model(&SMTPAudit{})
	if filter.Status != "" {
		db = db.Where("status = ?", filter.Status)
	}
	if filter.Purpose != "" {
		db = db.Where("purpose = ?", filter.Purpose)
	}
	if filter.Recipient != "" {
		// Recipients are canonical addresses separated by semicolons. Match one
		// whole member without relying on dialect-specific JSON/string functions.
		escaped := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(filter.Recipient)
		db = db.Where("recipient = ? OR recipient LIKE ? ESCAPE '!' OR recipient LIKE ? ESCAPE '!' OR recipient LIKE ? ESCAPE '!'",
			filter.Recipient, escaped+";%", "%;"+escaped, "%;"+escaped+";%")
	}
	if filter.UserID != nil {
		db = db.Where("user_id = ?", *filter.UserID)
	}
	if filter.RequestID != "" {
		db = db.Where("request_id = ?", filter.RequestID)
	}
	if filter.StartTimestamp > 0 {
		db = db.Where("started_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp > 0 {
		db = db.Where("started_at <= ?", filter.EndTimestamp)
	}
	if filter.IsTest != nil {
		db = db.Where("is_test = ?", *filter.IsTest)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]SMTPAudit, 0)
	// Events are deliberately excluded from the list query; only the detail
	// endpoint exposes the complete diagnostic timeline.
	err := db.Omit("events").Order("id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

func GetSMTPAudit(ctx context.Context, id int) (*SMTPAudit, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var row SMTPAudit
	err := DB.WithContext(ctx).First(&row, id).Error
	return &row, err
}

// MaintainSMTPAudits performs one bounded batch per pass. The deadline belongs
// to the sender; a further minute of grace permits its final DB callback before
// a crashed process is reconciled. Active sends are never interrupted.
func MaintainSMTPAudits(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	db := DB.WithContext(ctx)
	now := time.Now().Unix()
	const batchSize = 500
	var abandoned []int
	if err := db.Model(&SMTPAudit{}).
		Where("status = ? AND deadline_at > 0 AND deadline_at < ?", "sending", now-60).
		Order("id").Limit(batchSize).Pluck("id", &abandoned).Error; err != nil {
		return err
	}
	if len(abandoned) > 0 {
		if err := db.Model(&SMTPAudit{}).
			Where("id IN ? AND status = ? AND deadline_at > 0 AND deadline_at < ?", abandoned, "sending", now-60).
			Updates(map[string]any{
				"status":      "unknown",
				"finished_at": now,
				"error":       "sender_interrupted",
			}).Error; err != nil {
			return err
		}
	}
	retentionDays := common.GetEnvOrDefault("SMTP_AUDIT_RETENTION_DAYS", 90)
	if retentionDays <= 0 || retentionDays > 3650 {
		retentionDays = 90
	}
	cutoff := now - int64(retentionDays)*24*60*60
	var expired []int
	if err := db.Model(&SMTPAudit{}).Where("started_at < ? AND status <> ?", cutoff, "sending").
		Order("id").Limit(batchSize).Pluck("id", &expired).Error; err != nil {
		return err
	}
	if len(expired) == 0 {
		return nil
	}
	return db.Where("id IN ? AND started_at < ? AND status <> ?", expired, cutoff, "sending").Delete(&SMTPAudit{}).Error
}
