package common

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"net/textproto"
	"strings"
	"sync"
	"time"
	"unicode"
)

// SMTPAuditMetadata contains identifiers only. Never put credentials, message
// bodies, verification codes, or recovery links into audit metadata.
type SMTPAuditMetadata struct {
	Purpose        string
	UserID         int
	ActorID        int
	RequestID      string
	NotificationID int
	DeliveryID     int
	Attempt        int
	IsTest         bool
}

// SMTPAuditRecord is a transport snapshot. Persistence is injected by the host
// after its main database is ready, keeping common independent of model.
type SMTPAuditRecord struct {
	AttemptID          string `json:"attempt_id" gorm:"size:64;uniqueIndex"`
	StartedAt          int64  `json:"started_at" gorm:"index"`
	FinishedAt         int64  `json:"finished_at"`
	DeadlineAt         int64  `json:"deadline_at" gorm:"index"`
	DurationMS         int64  `json:"duration_ms"`
	Status             string `json:"status" gorm:"size:16;index"`
	Purpose            string `json:"purpose" gorm:"size:64;index"`
	Subject            string `json:"subject" gorm:"type:text"`
	Recipient          string `json:"recipient" gorm:"type:text"`
	Sender             string `json:"sender" gorm:"type:text"`
	UserID             int    `json:"user_id" gorm:"index"`
	ActorID            int    `json:"actor_id"`
	RequestID          string `json:"request_id" gorm:"size:64;index"`
	NotificationID     int    `json:"notification_id" gorm:"index"`
	DeliveryID         int    `json:"delivery_id"`
	Attempt            int    `json:"attempt"`
	IsTest             bool   `json:"is_test"`
	Server             string `json:"server" gorm:"type:text"`
	Port               int    `json:"port"`
	TLSMode            string `json:"tls_mode" gorm:"size:24"`
	TLSVersion         string `json:"tls_version" gorm:"size:24"`
	TLSCipher          string `json:"tls_cipher" gorm:"size:128"`
	AuthEnabled        bool   `json:"auth_enabled"`
	InsecureSkipVerify bool   `json:"insecure_skip_verify"`
	Stage              string `json:"stage" gorm:"size:32"`
	SMTPCode           int    `json:"smtp_code"`
	Error              string `json:"error" gorm:"type:text"`
	Warning            string `json:"warning" gorm:"type:text"`
	MessageID          string `json:"message_id" gorm:"type:text"`
	MessageBytes       int    `json:"message_bytes"`
	AttachmentCount    int    `json:"attachment_count"`
	AttachmentBytes    int    `json:"attachment_bytes"`
	InstanceID         string `json:"instance_id" gorm:"size:255"`
	Events             string `json:"events" gorm:"type:text"`
}

type smtpAuditContextKey struct{}
type smtpTraceContextKey struct{}

type smtpAuditEvent struct {
	Stage      string `json:"stage"`
	DurationMS int64  `json:"duration_ms"`
	Status     string `json:"status"`
	SMTPCode   int    `json:"smtp_code,omitempty"`
	Error      string `json:"error,omitempty"`
}

type smtpAuditTrace struct {
	record SMTPAuditRecord
	events []smtpAuditEvent
}

var smtpAuditRecorder struct {
	sync.RWMutex
	write func(SMTPAuditRecord) error
}

func RegisterSMTPAuditRecorder(write func(SMTPAuditRecord) error) {
	smtpAuditRecorder.Lock()
	smtpAuditRecorder.write = write
	smtpAuditRecorder.Unlock()
}

func WithSMTPAudit(ctx context.Context, metadata SMTPAuditMetadata) context.Context {
	return context.WithValue(ctx, smtpAuditContextKey{}, metadata)
}

// SMTPAuditText strips control characters and limits metadata size; raw SMTP
// responses deliberately never enter this function or the audit database.
func SMTPAuditText(value string, limit int) string {
	value = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, value)
	runes := []rune(strings.ToValidUTF8(value, ""))
	return string(runes[:min(len(runes), limit)])
}

func (trace *smtpAuditTrace) persist() {
	smtpAuditRecorder.RLock()
	write := smtpAuditRecorder.write
	smtpAuditRecorder.RUnlock()
	if write == nil {
		return
	}
	encoded, err := Marshal(trace.events)
	if err == nil {
		trace.record.Events = string(encoded)
		err = write(trace.record)
	}
	if err != nil {
		// Database errors may echo INSERT parameters; never log the raw error.
		SysError(fmt.Sprintf("SMTP audit write failed (attempt_id=%s, status=%s)", trace.record.AttemptID, trace.record.Status))
	}
}

// smtpAuditError uses an allowlist of error classes rather than trying to scrub
// arbitrary server text, which can echo AUTH data or message contents.
func smtpAuditError(err error) (int, string) {
	if err == nil {
		return 0, ""
	}
	var response *textproto.Error
	if errors.As(err, &response) {
		return response.Code, "smtp_rejected"
	}
	var dns *net.DNSError
	var unknownCA x509.UnknownAuthorityError
	var hostname x509.HostnameError
	var invalidCert x509.CertificateInvalidError
	var network net.Error
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return 0, "timeout"
	case errors.Is(err, context.Canceled):
		return 0, "canceled"
	case errors.As(err, &dns):
		return 0, "dns_error"
	case errors.As(err, &unknownCA), errors.As(err, &hostname), errors.As(err, &invalidCert):
		return 0, "tls_certificate_error"
	case errors.As(err, &network) && network.Timeout():
		return 0, "timeout"
	case errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
		return 0, "connection_closed"
	case errors.As(err, &network):
		return 0, "network_error"
	case errors.Is(err, ErrSMTPDeliveryUnknown):
		return 0, "delivery_unknown"
	default:
		// These are fixed local validation messages, not persisted server text.
		switch err.Error() {
		case "SMTP 服务器未配置":
			return 0, "smtp_not_configured"
		case "invalid SMTP account", "invalid sender address":
			return 0, "invalid_sender"
		case "invalid email header":
			return 0, "invalid_header"
		case "invalid attachment content type", "invalid attachment content ID":
			return 0, "invalid_attachment"
		case "SMTP server does not support STARTTLS":
			return 0, "starttls_not_supported"
		case "unencrypted connection":
			return 0, "authentication_requires_tls"
		case "unknown SMTP AUTH LOGIN challenge", "unexpected SMTP auth challenge":
			return 0, "unsupported_auth_challenge"
		}
		if strings.HasPrefix(err.Error(), "invalid receiver address:") {
			return 0, "invalid_recipient"
		}
		return 0, "operation_failed"
	}
}

// smtpAuditStep records only the phase, duration and safe error classification.
func smtpAuditStep(ctx context.Context, stage string, operation func() error) error {
	trace, _ := ctx.Value(smtpTraceContextKey{}).(*smtpAuditTrace)
	started := time.Now()
	if trace != nil {
		trace.record.Stage = stage
	}
	err := operation()
	if trace == nil {
		return err
	}
	event := smtpAuditEvent{Stage: stage, DurationMS: time.Since(started).Milliseconds(), Status: "success"}
	if err == nil && stage == "accept" {
		event.SMTPCode = 250
	}
	if err != nil {
		event.Status = "failed"
		event.SMTPCode, event.Error = smtpAuditError(err)
		trace.record.SMTPCode, trace.record.Error = event.SMTPCode, event.Error
	}
	trace.events = append(trace.events, event)
	return err
}
