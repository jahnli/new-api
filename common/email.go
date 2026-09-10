package common

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
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
}

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
	mail, err := buildHTMLMessage(subject, receiver, content, nil)
	if err != nil {
		return err
	}
	return sendSMTPMessage(receiver, mail)
}

func SendEmailWithAttachments(subject string, receiver string, content string, attachments []EmailAttachment) error {
	mail, err := buildHTMLMessage(subject, receiver, content, attachments)
	if err != nil {
		return err
	}
	return sendSMTPMessage(receiver, mail)
}

func buildHTMLMessage(subject string, receiver string, content string, attachments []EmailAttachment) ([]byte, error) {
	from := SMTPFrom
	if from == "" { // for compatibility
		from = SMTPAccount
	}
	id, err := generateMessageID(from)
	if err != nil {
		return nil, err
	}
	if SMTPServer == "" && SMTPAccount == "" {
		return nil, fmt.Errorf("SMTP 服务器未配置")
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
	if _, err := body.WriteString(header + "Content-Type: multipart/mixed; boundary=\"" + multipartWriter.Boundary() + "\"\r\n\r\n"); err != nil {
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
	from := SMTPFrom
	if from == "" {
		from = SMTPAccount
	}
	auth := getSMTPAuth()
	addr := fmt.Sprintf("%s:%d", SMTPServer, SMTPPort)
	to := strings.Split(receiver, ";")
	var err error
	client, err := newSMTPClient(addr)
	if err != nil {
		return err
	}
	defer client.Close()
	if shouldAuthenticateSMTP() {
		if err = client.Auth(auth); err != nil {
			return err
		}
	}
	if err = client.Mail(from); err != nil {
		return err
	}
	for _, receiver := range to {
		if err = client.Rcpt(strings.TrimSpace(receiver)); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, err = w.Write(mail)
	if err != nil {
		return err
	}
	err = w.Close()
	if err != nil {
		return err
	}
	err = client.Quit()
	if err != nil {
		SysError(fmt.Sprintf("failed to send email to %s: %v", receiver, err))
	}
	// DATA was already accepted by the SMTP server. A QUIT failure does not
	// mean delivery failed and must not encourage callers to resend the mail.
	return nil
}
