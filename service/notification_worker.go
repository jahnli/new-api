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

const notificationDeliveryConcurrency = 10

type notificationDeliveryResult struct {
	delivery    *model.NotificationDelivery
	status      string
	messageID   string
	reason      string
	interrupted bool
}

// NotificationDeliveryUnknownError lets a sender explicitly mark a request whose
// acceptance cannot be established (for example, a connection lost after write).
type NotificationDeliveryUnknownError struct{ Err error }

func (err *NotificationDeliveryUnknownError) Error() string {
	return "notification delivery outcome is unknown"
}
func (err *NotificationDeliveryUnknownError) Unwrap() error { return err.Err }

// StartNotificationWorker starts a single bounded poller per process. Database
// claims coordinate nodes; each claimed notification uses the same bounded
// recipient dispatcher as direct sends and retries.
func StartNotificationWorker(ctx context.Context) {
	notificationWorkerOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(10 * time.Minute)
			defer ticker.Stop()
			for {
				cleanupCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
				err := model.CleanupNotificationStorage(cleanupCtx)
				cancel()
				if err != nil && ctx.Err() == nil {
					common.SysError("notification object cleanup failed; cleanup will be retried")
				}
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				}
			}
		}()
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
	remaining := max(0, record.Total-record.SuccessCount-record.FailedCount-record.UnknownCount)
	results := make(chan notificationDeliveryResult, notificationDeliveryConcurrency)
	sendCtx, cancel := context.WithCancel(ctx)
	var workers sync.WaitGroup
	defer func() {
		cancel()
		workers.Wait()
	}()
	active := 0
	var stopErr error
	for remaining > 0 || active > 0 {
		var result notificationDeliveryResult
		// Persist available results before starting more sends. Only this
		// coordinator claims recipients and writes results, keeping those short
		// transactions serialized even on SQLite. Provider I/O runs concurrently.
		select {
		case result = <-results:
		default:
			if stopErr == nil {
				stopErr = ctx.Err()
			}
			if stopErr == nil && remaining > 0 && active < notificationDeliveryConcurrency {
				delivery, err := model.BeginNotificationDelivery(record.ID, record.Claim)
				if err == nil {
					remaining--
					active++
					workers.Go(func() {
						results <- sendNotificationRecipient(sendCtx, message, delivery)
					})
					continue
				}
				stopErr = err
			}
			if active == 0 {
				return stopErr
			}
			result = <-results
		}
		active--
		if result.interrupted && stopErr == nil {
			stopErr = errors.New("notification sender interrupted")
		}
		// Stop dispatching on a write failure, but drain and persist every send
		// already in flight before finalization. Do not cancel accepted sends or
		// retry uncertain outcomes; failed writes remain for lease recovery.
		if err := model.FinishNotificationDelivery(record.ID, record.Claim, result.delivery, result.status, result.messageID, result.reason); err != nil && stopErr == nil {
			stopErr = err
		}
	}
	if stopErr != nil {
		return stopErr
	}
	return ctx.Err()
}

// Each recipient owns its timeout and result. Recover here because a panic in a
// child goroutine cannot be caught by the HTTP handler or background poller.
func sendNotificationRecipient(ctx context.Context, message NotificationMessage, delivery *model.NotificationDelivery) (result notificationDeliveryResult) {
	result.delivery = delivery
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	defer func() {
		if recover() != nil {
			result.status = model.NotificationUnknown
			result.reason = "notification sender interrupted; delivery outcome is unknown"
			result.messageID = ""
			result.interrupted = true
		}
	}()
	if ctx.Err() != nil {
		result.status, result.reason = model.NotificationFailed, "request ended before delivery"
		return result
	}
	messageID, sendErr := SendNotificationMessage(ctx, message, delivery.Recipient)
	result.status = model.NotificationSuccess
	if sendErr != nil {
		result.status = model.NotificationFailed
		// The sender returns safe errors; never log a recovered panic or a raw
		// provider response that could contain credentials.
		reason := []rune(sendErr.Error())
		result.reason = string(reason[:min(len(reason), 2000)])
		var unknown *NotificationDeliveryUnknownError
		var networkError net.Error
		if ctx.Err() != nil || errors.As(sendErr, &unknown) || errors.Is(sendErr, context.Canceled) || errors.Is(sendErr, context.DeadlineExceeded) || (errors.As(sendErr, &networkError) && networkError.Timeout()) {
			result.status, result.reason = model.NotificationUnknown, "delivery outcome is unknown; automatic retry is disabled"
		}
	}
	result.messageID = messageID[:min(len(messageID), 4096)]
	return result
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
