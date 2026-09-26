package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

var notificationWorkerOnce sync.Once

// NotificationDeliveryUnknownError lets a sender explicitly mark a request whose
// acceptance cannot be established (for example, a connection lost after write).
type NotificationDeliveryUnknownError struct{ Err error }

func (err *NotificationDeliveryUnknownError) Error() string {
	return "notification delivery outcome is unknown"
}
func (err *NotificationDeliveryUnknownError) Unwrap() error { return err.Err }

// StartNotificationWorker starts a single bounded poller per process. Database
// claims coordinate nodes; there is no goroutine or in-memory queue per request.
func StartNotificationWorker(ctx context.Context) {
	notificationWorkerOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					runNotificationPoll(ctx)
				}
			}
		}()
	})
}

func runNotificationPoll(ctx context.Context) {
	defer func() {
		if recover() != nil {
			common.SysError("notification worker interrupted; its in-flight delivery will be marked unknown")
		}
	}()
	if err := model.RecoverExpiredNotifications(); err != nil {
		common.SysError("notification queue recovery failed")
		return
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return
	}
	claim := hex.EncodeToString(random[:])
	record, err := model.ClaimNotification(ctx, claim)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) && ctx.Err() == nil {
			common.SysError("notification queue claim failed")
		}
		return
	}
	var message NotificationMessage
	if err := common.Unmarshal(record.Message, &message); err != nil {
		common.SysError("notification snapshot cannot be decoded")
		return
	}
	if err := deliverNotificationRecipients(ctx, record, message); err != nil {
		common.SysError("notification delivery interrupted; check delivery history before retrying")
	}
}

func deliverNotificationRecipients(ctx context.Context, record *model.NotificationRecord, message NotificationMessage) error {
	remaining := record.Total - record.SuccessCount - record.FailedCount - record.UnknownCount
	for range remaining {
		if err := ctx.Err(); err != nil {
			return err
		}
		delivery, err := model.BeginNotificationDelivery(record.ID, record.Claim)
		if err != nil {
			return err
		}
		sendCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
		messageID, sendErr := SendNotificationMessage(sendCtx, message, delivery.Recipient)
		contextErr := sendCtx.Err()
		cancel()
		status, reason := model.NotificationSuccess, ""
		if sendErr != nil {
			status = model.NotificationFailed
			// Provider response bodies may contain credentials. The sender returns
			// safe errors; an upper bound also protects the database and detail UI.
			reason = string([]rune(sendErr.Error())[:min(len([]rune(sendErr.Error())), 2000)])
			var unknown *NotificationDeliveryUnknownError
			var networkError net.Error
			if contextErr != nil || errors.As(sendErr, &unknown) || errors.Is(sendErr, context.Canceled) || errors.Is(sendErr, context.DeadlineExceeded) || (errors.As(sendErr, &networkError) && networkError.Timeout()) {
				status, reason = model.NotificationUnknown, "delivery outcome is unknown; automatic retry is disabled"
			}
		}
		if len(messageID) > 4096 {
			messageID = messageID[:4096]
		}
		// A failed result write stops this worker immediately. The lease recovery
		// path marks the recipient unknown instead of risking a second send.
		if err := model.FinishNotificationDelivery(record.ID, record.Claim, delivery, status, messageID, reason); err != nil {
			return err
		}
	}
	return nil
}

// CompleteDirectNotification owns delivery for the duration of the HTTP request.
// No worker may claim this record; cancellation stops the unsent recipients.
func CompleteDirectNotification(ctx context.Context, record *model.NotificationRecord, message NotificationMessage) (*model.NotificationRecord, error) {
	defer func() {
		if err := model.FinishDirectNotification(record.ID, record.Claim); err != nil {
			common.SysError("direct notification finalization failed")
		}
	}()
	err := deliverNotificationRecipients(ctx, record, message)
	if finishErr := model.FinishDirectNotification(record.ID, record.Claim); finishErr != nil {
		return nil, &NotificationDeliveryUnknownError{Err: finishErr}
	}
	if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
		return nil, &NotificationDeliveryUnknownError{Err: err}
	}
	result, err := model.GetNotification(record.ID, record.SenderID, false, false)
	if err != nil {
		return nil, &NotificationDeliveryUnknownError{Err: err}
	}
	return result, nil
}

func RetryNotificationMessage(ctx context.Context, id, userID int, admin bool) (*model.NotificationRecord, error) {
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return nil, err
	}
	claim := "direct:" + hex.EncodeToString(random[:])
	if err := model.RetryNotification(id, userID, admin, claim); err != nil {
		return nil, err
	}
	defer func() {
		if err := model.FinishDirectNotification(id, claim); err != nil {
			common.SysError("direct notification retry finalization failed")
		}
	}()
	record, err := model.GetNotification(id, userID, admin, true)
	if err != nil {
		return nil, err
	}
	var message NotificationMessage
	if err := common.Unmarshal(record.Message, &message); err != nil {
		return nil, err
	}
	return CompleteDirectNotification(ctx, record, message)
}
