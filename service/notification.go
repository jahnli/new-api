package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"net/mail"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	_ "golang.org/x/image/webp"
)

const notificationMaxImageBytes = 15 * 1024 * 1024

// Allow ten base64-encoded images plus message text and request metadata.
const NotificationMaxBodyBytes = 10*((notificationMaxImageBytes+2)/3*4) + 2*1024*1024

type NotificationImage struct {
	ID          string `json:"id,omitempty"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Data        string `json:"data"`
}

// NotificationMessage is shared with the platform sender. Retries load the
// immutable title, content and recipients captured when the message was queued.
type NotificationMessage struct {
	Channel   string `json:"channel"`
	CompanyID int    `json:"company_id"`
	// Kept in frozen snapshots so old records retain their original targets on retry.
	RecipientType string              `json:"recipient_type,omitempty"`
	Recipients    []string            `json:"recipients"`
	Title         string              `json:"title"`
	TitleIcon     string              `json:"title_icon,omitempty"`
	TitleTheme    string              `json:"title_theme,omitempty"`
	Content       string              `json:"content"`
	Images        []NotificationImage `json:"images"`
}

var notificationPlatformIDPattern = regexp.MustCompile(`^[A-Za-z0-9_.:@=-]{1,320}$`)
var notificationNativeMentionPattern = regexp.MustCompile(`(?i)<\s*at\b`)
var notificationImageIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

type NotificationValidationError struct{ Err error }

func (err *NotificationValidationError) Error() string { return err.Err.Error() }
func (err *NotificationValidationError) Unwrap() error { return err.Err }

// PrepareNotificationMessage allows incomplete templates but applies the same
// size and attachment rules to every persisted message.
func PrepareNotificationMessage(message *NotificationMessage, maxRecipients int, sending bool) error {
	if len(message.Content) > 128*1024 || len(message.Title) > 8192 {
		return errors.New("notification title or content exceeds the allowed length")
	}
	if !slices.Contains([]string{"feishu", "dingtalk", "email"}, message.Channel) {
		return errors.New("unsupported notification channel")
	}
	if !slices.Contains([]string{
		"", "blue", "wathet", "turquoise", "green", "yellow", "orange", "red", "carmine", "violet", "purple", "indigo", "grey", "default",
	}, message.TitleTheme) {
		return errors.New("unsupported notification title theme")
	}
	if !slices.Contains([]string{
		"", "📢", "🔔", "📣", "✉️", "📬", "📰", "📝", "📌", "📅", "⏰", "🚀", "🎉", "🎊", "🎁", "🏆", "⭐", "✨", "💡", "🔥", "✅", "⚠️", "❗", "🛠️", "🔒",
		"📋", "📊", "📈", "📉", "📁", "📂", "📎", "📚", "📖", "🗂️", "🗓️", "⏳", "⌛", "⏱️", "🔍", "🔎", "🔑", "🛡️", "⚙️", "🔧", "🧰", "💻", "🖥️", "📱",
		"🤖", "🧠", "🧪", "🔬", "🛰️", "🌐", "🌍", "☁️", "⚡", "🔋", "🎯", "💎", "🥇", "🎖️", "🎈", "🎂", "🎵", "🎨", "🧩", "🌟", "☀️", "🌙", "🌈", "🌸",
		"🌻", "🌿", "🍀", "🌱", "❤️", "🧡", "💛", "💚", "💙", "💜", "👍", "👏", "🙌", "🤝", "💪", "😊", "😄", "🥳", "💬", "📍", "🚩", "❓", "❌", "🔄",
	}, message.TitleIcon) {
		return errors.New("unsupported notification title icon")
	}
	switch message.Channel {
	case "feishu":
		message.RecipientType = "open_id"
	case "dingtalk":
		message.RecipientType = "user_id"
	case "email":
		message.RecipientType = "email"
	}
	if message.CompanyID < 0 {
		return errors.New("invalid company ID")
	}
	if message.Channel != "email" && sending {
		company, err := model.GetEnabledCompanyByID(message.CompanyID)
		if err != nil || company.Platform != message.Channel {
			return errors.New("an enabled company matching the channel is required")
		}
	} else if message.Channel == "email" && message.CompanyID != 0 {
		return errors.New("email notifications must not select a company")
	}
	if len(message.Recipients) > maxRecipients || (sending && len(message.Recipients) == 0) {
		return fmt.Errorf("recipients must contain between 1 and %d entries", maxRecipients)
	}
	seen := make(map[string]bool)
	for _, recipient := range message.Recipients {
		if len(recipient) > 320 || recipient != strings.TrimSpace(recipient) || strings.ContainsAny(recipient, "\r\n\x00") {
			return errors.New("invalid notification recipient")
		}
		if message.Channel == "email" && sending {
			address, err := mail.ParseAddress(recipient)
			if err != nil || address.Address != recipient || !strings.Contains(recipient, "@") {
				return errors.New("invalid email recipient")
			}
		} else if message.Channel != "email" && sending && (!notificationPlatformIDPattern.MatchString(recipient) || strings.EqualFold(strings.TrimPrefix(recipient, "@"), "all") || recipient == "0") {
			return errors.New("platform recipients must be explicit IDs without separators or broadcast values")
		}
		key := recipient
		if message.Channel == "email" {
			key = strings.ToLower(key)
		}
		if seen[key] {
			return errors.New("duplicate notification recipient")
		}
		seen[key] = true
	}
	if sending {
		if message.Channel == "feishu" && notificationNativeMentionPattern.MatchString(message.Content) {
			return errors.New("notification content must not contain native Feishu mention tags")
		}
		if strings.TrimSpace(message.Title) == "" || strings.TrimSpace(message.Content) == "" {
			return errors.New("notification title and content are required")
		}
		if message.TitleIcon != "" {
			message.Title = message.TitleIcon + " " + strings.TrimSpace(message.Title)
			// Freeze the final title so retry and history reuse cannot duplicate
			// its icon. Templates retain the separate, editable icon field.
			message.TitleIcon = ""
		}
	}
	if !utf8.ValidString(message.Title) || !utf8.ValidString(message.Content) || utf8.RuneCountInString(message.Title) > 200 || len(message.Content) > 128*1024 {
		return errors.New("notification title or content exceeds the allowed length")
	}
	if strings.ContainsAny(message.Title, "\r\n\x00") || strings.ContainsRune(message.Content, '\x00') {
		return errors.New("notification text contains invalid control characters")
	}
	if sending {
		if err := validateNotificationMarkdown(message.Content); err != nil {
			return err
		}
		if message.Channel == "feishu" {
			if _, err := notificationFeishuTables(message.Content); err != nil {
				return err
			}
		}
		if message.Channel != "email" && utf8.RuneCountInString(message.Content) > 5000 {
			return errors.New("platform notification content must not exceed 5000 characters")
		}
	}
	if len(message.Images) > 10 {
		return errors.New("at most 10 images are allowed")
	}
	imageIDs := make(map[string]bool, len(message.Images))
	for _, attachment := range message.Images {
		if attachment.ID != "" {
			if !notificationImageIDPattern.MatchString(attachment.ID) || imageIDs[attachment.ID] {
				return errors.New("invalid or duplicate notification image ID")
			}
			imageIDs[attachment.ID] = true
		}
		if attachment.Filename == "" || len(attachment.Filename) > 255 || strings.ContainsAny(attachment.Filename, "/\\\r\n\x00") {
			return errors.New("invalid image filename")
		}
		if len(attachment.Data) > base64.StdEncoding.EncodedLen(notificationMaxImageBytes) {
			return errors.New("each image must not exceed 15 MiB")
		}
		data, err := base64.StdEncoding.Strict().DecodeString(attachment.Data)
		if err != nil || len(data) == 0 || len(data) > notificationMaxImageBytes {
			return errors.New("invalid image base64 or image exceeds 15 MiB")
		}
		contentType := http.DetectContentType(data)
		if !slices.Contains([]string{"image/jpeg", "image/png", "image/gif", "image/webp"}, contentType) || contentType != attachment.ContentType {
			return errors.New("image content must match JPEG, PNG, GIF or WebP content type")
		}
		config, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 40_000_000/config.Height {
			return errors.New("invalid image or image dimensions exceed 40 megapixels")
		}
	}
	if sending {
		if _, err := notificationImageReferences(*message); err != nil {
			return err
		}
	}
	if message.Images == nil {
		message.Images = []NotificationImage{}
	}
	if message.Recipients == nil {
		message.Recipients = []string{}
	}
	return nil
}

// Validate paired fences and inline link destinations without treating ordinary
// punctuation or code samples as links. URLs in markdown cannot run scripts.
func validateNotificationMarkdown(content string) error {
	fence := byte(0)
	fenceLength := 0
	var prose strings.Builder
	for line := range strings.SplitSeq(content, "\n") {
		trimmed := strings.TrimLeft(line, " \t")
		if len(trimmed) >= 3 && (trimmed[0] == '`' || trimmed[0] == '~') {
			n := 0
			for n < len(trimmed) && trimmed[n] == trimmed[0] {
				n++
			}
			if n >= 3 {
				if fence == 0 {
					fence, fenceLength = trimmed[0], n
				} else if fence == trimmed[0] && n >= fenceLength && strings.TrimSpace(trimmed[n:]) == "" {
					fence = 0
				}
				continue
			}
		}
		if fence == 0 {
			prose.WriteString(line)
			prose.WriteByte('\n')
		}
	}
	if fence != 0 {
		return errors.New("markdown contains an unclosed code fence")
	}
	text := prose.String()
	for i := 0; i < len(text); i++ {
		if text[i] == '\\' {
			i++
			continue
		}
		if text[i] == '`' {
			run := 1
			for i+run < len(text) && text[i+run] == '`' {
				run++
			}
			end := strings.Index(text[i+run:], strings.Repeat("`", run))
			if end >= 0 {
				i += run + end + run - 1
			}
			continue
		}
		if text[i] != '[' {
			continue
		}
		endLabel := strings.IndexByte(text[i+1:], ']')
		if endLabel < 0 {
			return errors.New("markdown contains an unclosed link label")
		}
		endLabel += i + 1
		if endLabel+1 >= len(text) || text[endLabel+1] != '(' {
			continue
		}
		start := endLabel + 2
		depth, end := 1, start
		for ; end < len(text); end++ {
			if text[end] == '\\' {
				end++
				continue
			}
			if text[end] == '(' {
				depth++
			}
			if text[end] == ')' {
				depth--
				if depth == 0 {
					break
				}
			}
		}
		if depth != 0 {
			return errors.New("markdown contains an unclosed link destination")
		}
		destination := strings.TrimSpace(text[start:end])
		if cut := strings.IndexFunc(destination, unicode.IsSpace); cut >= 0 {
			destination = destination[:cut]
		}
		destination = strings.Trim(destination, "<>")
		parsed, err := url.Parse(destination)
		if err != nil || (parsed.Scheme != "" && !slices.Contains([]string{"https", "http", "mailto", "cid"}, strings.ToLower(parsed.Scheme))) {
			return errors.New("markdown contains an unsafe link")
		}
		i = end
	}
	return nil
}

func DeliverNotificationMessage(ctx context.Context, message NotificationMessage, userID int, username string, isTest bool) (*model.NotificationRecord, error) {
	limit := 1000
	if isTest {
		limit = 20
	} else if message.Channel == "feishu" || message.Channel == "dingtalk" {
		// Resolve the audience once at submission. Never trust a client-supplied
		// platform recipient list for an official send or expand it on retry.
		audience, err := ResolveNotificationAudience(message.Channel, message.CompanyID)
		if err != nil {
			return nil, err
		}
		if audience.RecipientCount == 0 {
			return nil, &NotificationValidationError{Err: errors.New("用户表中没有可发送的平台账号 ID")}
		}
		message.Recipients = audience.Recipients
		limit = max(limit, len(message.Recipients))
	}
	if err := PrepareNotificationMessage(&message, limit, true); err != nil {
		return nil, &NotificationValidationError{Err: err}
	}
	payload, err := common.Marshal(message)
	if err != nil {
		return nil, err
	}
	record := &model.NotificationRecord{SenderID: userID, Sender: username, Channel: message.Channel, CompanyID: message.CompanyID, Title: message.Title, IsTest: isTest}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return nil, err
	}
	record.Claim = "direct:" + hex.EncodeToString(random[:])
	contentRunes := []rune(strings.Join(strings.Fields(message.Content), " "))
	record.Summary = string(contentRunes[:min(len(contentRunes), 200)])
	if err := model.CreateNotification(record, payload, message.Recipients); err != nil {
		return nil, err
	}
	return CompleteDirectNotification(ctx, record, message)
}
