package common

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"slices"
	"strings"
	"time"
)

type EmailAttachment struct {
	Filename    string
	ContentType string
	Data        []byte
	ContentID   string
}

var ErrSMTPDeliveryUnknown = errors.New("SMTP delivery outcome is unknown")

func generateMessageID(from string) (string, error) {
	split := strings.Split(from, "@")
	if len(split) < 2 {
		return "", fmt.Errorf("invalid SMTP account")
	}
	domain := split[1]
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func shouldUseSMTPLoginAuth() bool {
	if SMTPForceAuthLogin {
		return true
	}
	return isOutlookServer(SMTPAccount) || slices.Contains(EmailLoginAuthServerList, SMTPServer)
}

func getSMTPAuth() smtp.Auth {
	return AutoSMTPAuth(SMTPAccount, SMTPToken)
}

func shouldAuthenticateSMTP() bool {
	return SMTPAccount != "" && SMTPToken != ""
}

func smtpTLSConfig() *tls.Config {
	return &tls.Config{
		ServerName:         SMTPServer,
		InsecureSkipVerify: SMTPInsecureSkipVerify, // #nosec G402 -- admin-controlled SMTP compatibility option.
	}
}

func newSMTPClient(addr string) (*smtp.Client, error) {
	if SMTPSSLEnabled || (SMTPPort == 465 && !SMTPStartTLSEnabled) {
		conn, err := tls.Dial("tcp", addr, smtpTLSConfig())
		if err != nil {
			return nil, err
		}
		client, err := smtp.NewClient(conn, SMTPServer)
		if err != nil {
			_ = conn.Close()
			return nil, err
		}
		return client, nil
	}

	client, err := smtp.Dial(addr)
	if err != nil {
		return nil, err
	}

	if SMTPStartTLSEnabled {
		startTLSSupported, _ := client.Extension("STARTTLS")
		if !startTLSSupported {
			_ = client.Close()
			return nil, fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(smtpTLSConfig()); err != nil {
			_ = client.Close()
			return nil, err
		}
	}

	return client, nil
}

func SendEmail(subject string, receiver string, content string) error {
	return SendEmailWithContext(context.Background(), subject, receiver, content)
}

func SendEmailWithContext(ctx context.Context, subject, receiver, content string) error {
	_, err := SendNotificationEmail(ctx, subject, receiver, content, nil)
	return err
}

// SendNotificationEmail returns the actual MIME Message-ID after SMTP accepts
// DATA. Its deadline covers dialing, TLS, authentication and message transfer.
func SendNotificationEmail(ctx context.Context, subject, receiver, content string, attachments []EmailAttachment) (id string, resultErr error) {
	// Every send is bounded, including legacy callers. This also gives audit
	// recovery a reliable deadline for abandoned in-flight records.
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	started := time.Now()
	metadata, _ := ctx.Value(smtpAuditContextKey{}).(SMTPAuditMetadata)
	if metadata.Purpose == "" {
		metadata.Purpose = "unclassified"
	}
	from := SMTPFrom
	if from == "" {
		from = SMTPAccount
	}
	recipients := strings.Split(receiver, ";")
	for i := range recipients {
		recipients[i] = strings.TrimSpace(recipients[i])
		if address, err := mail.ParseAddress(recipients[i]); err == nil {
			recipients[i] = address.Address
		}
	}
	deadline, _ := ctx.Deadline()
	trace := &smtpAuditTrace{events: make([]smtpAuditEvent, 0, 16), record: SMTPAuditRecord{
		AttemptID: NewRequestId(), StartedAt: started.Unix(), DeadlineAt: deadline.Unix(),
		Status: "sending", Stage: "build", Purpose: SMTPAuditText(metadata.Purpose, 64),
		Subject: SMTPAuditText(subject, 512), Recipient: SMTPAuditText(strings.Join(recipients, ";"), 16000), Sender: SMTPAuditText(from, 320),
		UserID: metadata.UserID, ActorID: metadata.ActorID, RequestID: SMTPAuditText(metadata.RequestID, 64),
		NotificationID: metadata.NotificationID, DeliveryID: metadata.DeliveryID, Attempt: max(1, metadata.Attempt),
		IsTest: metadata.IsTest, Server: SMTPAuditText(SMTPServer, 255), Port: SMTPPort,
		TLSMode: "plain", AuthEnabled: shouldAuthenticateSMTP(), InsecureSkipVerify: SMTPInsecureSkipVerify,
		AttachmentCount: len(attachments), InstanceID: SMTPAuditText(NodeName, 255),
	}}
	if SMTPSSLEnabled || (SMTPPort == 465 && !SMTPStartTLSEnabled) {
		trace.record.TLSMode = "implicit_tls"
	} else if SMTPStartTLSEnabled {
		trace.record.TLSMode = "starttls"
	}
	for _, attachment := range attachments {
		trace.record.AttachmentBytes += len(attachment.Data)
	}
	ctx = context.WithValue(ctx, smtpTraceContextKey{}, trace)
	trace.persist()
	completed := false
	defer func() {
		trace.record.FinishedAt = time.Now().Unix()
		trace.record.DurationMS = time.Since(started).Milliseconds()
		switch {
		case trace.record.Status == "accepted":
			trace.record.Error = ""
			trace.record.SMTPCode = 250
			if !completed {
				trace.record.Warning = "sender_interrupted_after_acceptance"
			}
		case !completed:
			trace.record.Status, trace.record.Error = "unknown", "sender_interrupted"
		case resultErr == nil:
			trace.record.Status = "accepted"
			trace.record.SMTPCode = 250 // net/smtp requires 250 after DATA.
		case errors.Is(resultErr, ErrSMTPDeliveryUnknown):
			trace.record.Status = "unknown"
		default:
			trace.record.Status = "failed"
		}
		trace.persist()
	}()
	var message []byte
	err := smtpAuditStep(ctx, "build", func() error {
		var err error
		message, err = buildHTMLMessage(subject, receiver, content, attachments)
		return err
	})
	completed = true
	if err != nil {
		return "", err
	}
	trace.record.MessageBytes = len(message)
	parsed, err := mail.ReadMessage(bytes.NewReader(message))
	if err != nil {
		trace.record.Error = "invalid_message"
		return "", err
	}
	id = parsed.Header.Get("Message-ID")
	trace.record.MessageID = SMTPAuditText(id, 512)
	completed = false
	if err := sendSMTPMessageContext(ctx, receiver, message); err != nil {
		completed = true
		return "", err
	}
	completed = true
	return id, nil
}

func buildHTMLMessage(subject string, receiver string, content string, attachments []EmailAttachment) ([]byte, error) {
	from := SMTPFrom
	if from == "" { // for compatibility
		from = SMTPAccount
	}
	if SMTPServer == "" && SMTPAccount == "" {
		return nil, NewMessage("SMTP server is not configured")
	}
	id, err := generateMessageID(from)
	if err != nil {
		return nil, err
	}
	if strings.ContainsAny(subject, "\r\n") || strings.ContainsAny(receiver, "\r\n") || strings.ContainsAny(SystemName, "\r\n") {
		return nil, fmt.Errorf("invalid email header")
	}
	fromAddress, err := mail.ParseAddress(from)
	if err != nil || fromAddress.Address != from {
		return nil, fmt.Errorf("invalid sender address")
	}
	for _, address := range strings.Split(receiver, ";") {
		if _, err := mail.ParseAddress(strings.TrimSpace(address)); err != nil {
			return nil, fmt.Errorf("invalid receiver address: %w", err)
		}
	}
	for _, attachment := range attachments {
		mediaType, _, err := mime.ParseMediaType(attachment.ContentType)
		if err != nil || mediaType != attachment.ContentType || !strings.HasPrefix(mediaType, "image/") {
			return nil, fmt.Errorf("invalid attachment content type")
		}
		if strings.ContainsAny(attachment.ContentID, "<>\r\n\t ") {
			return nil, fmt.Errorf("invalid attachment content ID")
		}
	}

	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	formattedFrom := (&mail.Address{Name: SystemName, Address: from}).String()
	header := fmt.Sprintf("To: %s\r\n"+
		"From: %s\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+
		"MIME-Version: 1.0\r\n",
		receiver, formattedFrom, encodedSubject, time.Now().Format(time.RFC1123Z), id)

	if len(attachments) == 0 {
		return []byte(header + "Content-Type: text/html; charset=UTF-8\r\n\r\n" + content + "\r\n"), nil
	}

	var body bytes.Buffer
	multipartWriter := multipart.NewWriter(&body)
	multipartType := "mixed"
	if slices.ContainsFunc(attachments, func(attachment EmailAttachment) bool { return attachment.ContentID != "" }) {
		multipartType = "related"
	}
	if _, err := body.WriteString(header + "Content-Type: multipart/" + multipartType + "; boundary=\"" + multipartWriter.Boundary() + "\"\r\n\r\n"); err != nil {
		return nil, err
	}
	textHeader := make(textproto.MIMEHeader)
	textHeader.Set("Content-Type", "text/html; charset=UTF-8")
	textHeader.Set("Content-Transfer-Encoding", "quoted-printable")
	textPart, err := multipartWriter.CreatePart(textHeader)
	if err != nil {
		return nil, err
	}
	quotedWriter := quotedprintable.NewWriter(textPart)
	if _, err := quotedWriter.Write([]byte(content)); err != nil {
		return nil, err
	}
	if err := quotedWriter.Close(); err != nil {
		return nil, err
	}

	for _, attachment := range attachments {
		partHeader := make(textproto.MIMEHeader)
		partHeader.Set("Content-Type", attachment.ContentType)
		partHeader.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": attachment.Filename}))
		if attachment.ContentID != "" {
			partHeader.Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": attachment.Filename}))
			partHeader.Set("Content-ID", "<"+attachment.ContentID+">")
		}
		partHeader.Set("Content-Transfer-Encoding", "base64")
		part, err := multipartWriter.CreatePart(partHeader)
		if err != nil {
			return nil, err
		}
		encoded := base64.StdEncoding.EncodeToString(attachment.Data)
		for len(encoded) > 76 {
			if _, err := fmt.Fprintf(part, "%s\r\n", encoded[:76]); err != nil {
				return nil, err
			}
			encoded = encoded[76:]
		}
		if _, err := fmt.Fprintf(part, "%s\r\n", encoded); err != nil {
			return nil, err
		}
	}
	if err := multipartWriter.Close(); err != nil {
		return nil, err
	}
	return body.Bytes(), nil
}

func sendSMTPMessage(receiver string, mail []byte) error {
	return sendSMTPMessageContext(context.Background(), receiver, mail)
}

func sendSMTPMessageContext(ctx context.Context, receiver string, mail []byte) error {
	from := SMTPFrom
	if from == "" {
		from = SMTPAccount
	}
	auth := getSMTPAuth()
	addr := net.JoinHostPort(SMTPServer, fmt.Sprint(SMTPPort))
	to := strings.Split(receiver, ";")
	var err error
	// The shared public send entry supplies a deadline for all callers.
	client, err := newSMTPClientWithContext(ctx, addr)
	if err != nil {
		return err
	}
	defer client.Close()
	trace, _ := ctx.Value(smtpTraceContextKey{}).(*smtpAuditTrace)
	if state, ok := client.TLSConnectionState(); ok && trace != nil {
		trace.record.TLSVersion = tls.VersionName(state.Version)
		trace.record.TLSCipher = tls.CipherSuiteName(state.CipherSuite)
	}
	if shouldAuthenticateSMTP() {
		if err = smtpAuditStep(ctx, "auth", func() error { return client.Auth(auth) }); err != nil {
			return err
		}
	}
	if err = smtpAuditStep(ctx, "mail_from", func() error { return client.Mail(from) }); err != nil {
		return err
	}
	for i, receiver := range to {
		if err = smtpAuditStep(ctx, fmt.Sprintf("rcpt_to_%d", i+1), func() error { return client.Rcpt(strings.TrimSpace(receiver)) }); err != nil {
			return err
		}
	}
	var w io.WriteCloser
	if err = smtpAuditStep(ctx, "data", func() error {
		var err error
		w, err = client.Data()
		return err
	}); err != nil {
		return err
	}
	err = smtpAuditStep(ctx, "write", func() error {
		_, err := w.Write(mail)
		return err
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrSMTPDeliveryUnknown, err)
	}
	err = smtpAuditStep(ctx, "accept", w.Close)
	if err != nil {
		var rejected *textproto.Error
		if errors.As(err, &rejected) {
			return err
		}
		return fmt.Errorf("%w: %v", ErrSMTPDeliveryUnknown, err)
	}
	if trace != nil {
		trace.record.Status = "accepted"
	}
	err = smtpAuditStep(ctx, "quit", client.Quit)
	if err != nil {
		if trace != nil {
			trace.record.Warning = "quit_failed_after_acceptance"
			trace.record.Error = ""
		}
		SysError("SMTP QUIT failed after message acceptance")
	}
	// DATA was already accepted by the SMTP server. A QUIT failure does not
	// mean delivery failed and must not encourage callers to resend the mail.
	return nil
}

func newSMTPClientWithContext(ctx context.Context, addr string) (*smtp.Client, error) {
	if ctx.Done() == nil {
		return newSMTPClient(addr)
	}
	var conn net.Conn
	err := smtpAuditStep(ctx, "connect", func() error {
		var err error
		conn, err = (&net.Dialer{}).DialContext(ctx, "tcp", addr)
		return err
	})
	if err != nil {
		return nil, err
	}
	if deadline, ok := ctx.Deadline(); ok {
		if err := smtpAuditStep(ctx, "deadline", func() error { return conn.SetDeadline(deadline) }); err != nil {
			_ = conn.Close()
			return nil, err
		}
	}
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	wrapped := &notificationSMTPConn{Conn: conn, stop: stop}
	var transport net.Conn = wrapped
	if SMTPSSLEnabled || (SMTPPort == 465 && !SMTPStartTLSEnabled) {
		tlsConn := tls.Client(wrapped, smtpTLSConfig())
		if err := smtpAuditStep(ctx, "tls", func() error { return tlsConn.HandshakeContext(ctx) }); err != nil {
			_ = wrapped.Close()
			return nil, err
		}
		transport = tlsConn
	}
	var client *smtp.Client
	err = smtpAuditStep(ctx, "greeting", func() error {
		var err error
		client, err = smtp.NewClient(transport, SMTPServer)
		return err
	})
	if err != nil {
		_ = transport.Close()
		return nil, err
	}
	if SMTPStartTLSEnabled && !SMTPSSLEnabled {
		if err := smtpAuditStep(ctx, "starttls", func() error {
			if supported, _ := client.Extension("STARTTLS"); !supported {
				return fmt.Errorf("SMTP server does not support STARTTLS")
			}
			return client.StartTLS(smtpTLSConfig())
		}); err != nil {
			_ = client.Close()
			return nil, err
		}
	}
	return client, nil
}

type notificationSMTPConn struct {
	net.Conn
	stop func() bool
}

func (conn *notificationSMTPConn) Close() error {
	conn.stop()
	return conn.Conn.Close()
}
