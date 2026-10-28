package service

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

// PrepareUserRequestNotice resolves the recipient's company for both preview and
// delivery. Missing company/platform assignments use email; broken configured
// platforms must be fixed rather than silently switching delivery channels.
func PrepareUserRequestNotice(user *model.User, preview *RequestNoticePreview) (NotificationMessage, error) {
	message := NotificationMessage{Channel: "email", Title: preview.Title, TitleTheme: preview.Template}
	recipient := strings.TrimSpace(user.Email)
	companyName := model.NormalizeCompany(user.Company)
	if companyName != "" {
		company, err := model.GetCompanyByName(companyName)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return message, err
		}
		if err == nil {
			if company.Status != model.CompanyStatusEnabled {
				return message, common.NewMessage("The user's company is disabled")
			}
			if company.Platform == "" || company.Platform == model.CompanyPlatformNone {
				// No company platform: continue with the email fallback below.
			} else {
				config, err := company.GetConfig()
				if err != nil {
					return message, common.NewMessage("The company notification platform is not configured correctly")
				}
				configured := false
				switch company.Platform {
				case model.CompanyPlatformFeishu:
					configured = strings.TrimSpace(config.Feishu.AppID) != "" && strings.TrimSpace(config.Feishu.AppSecret) != ""
				case model.CompanyPlatformDingTalk:
					configured = strings.TrimSpace(config.DingTalk.ClientID) != "" && strings.TrimSpace(config.DingTalk.ClientSecret) != "" && config.DingTalk.AgentID > 0
				}
				if !configured {
					return message, common.NewMessage("The company notification platform is not configured correctly")
				}
				message.Channel, message.CompanyID = company.Platform, company.Id
				recipient = strings.TrimSpace(user.PlatformID(company.Platform))
				if !notificationPlatformIDPattern.MatchString(recipient) || strings.EqualFold(strings.TrimPrefix(recipient, "@"), "all") || recipient == "0" {
					return message, common.NewMessage("The user has no valid identity for the company platform")
				}
			}
		}
	}
	if message.Channel == "email" {
		address, err := mail.ParseAddress(recipient)
		if err != nil || address.Address != recipient || !strings.Contains(recipient, "@") || strings.ContainsAny(recipient, ";\r\n\x00") {
			return message, common.NewMessage("Invalid email address")
		}
		if common.SMTPServer == "" && common.SMTPAccount == "" {
			return message, common.NewMessage("SMTP is not configured")
		}
	}
	message.Recipients = []string{recipient}
	// Preview text and request metadata are plain text. Escape Markdown and HTML
	// delimiters before passing them to the shared platform/email renderers.
	escape := strings.NewReplacer("\\", "\\\\", "`", "\\`", "*", "\\*", "_", "\\_", "~", "\\~", "[", "\\[", "]", "\\]", "<", "&lt;", ">", "&gt;", "#", "\\#", "+", "\\+", "-", "\\-", "!", "\\!", "|", "\\|", ".", "\\.")
	var content strings.Builder
	content.WriteString(escape.Replace(preview.Content))
	for _, field := range preview.Fields {
		fmt.Fprintf(&content, "\n\n**%s**\n\n%s", escape.Replace(field.Label), escape.Replace(field.Value))
	}
	message.Content = content.String()
	if err := PrepareNotificationMessage(&message, 1, true); err != nil {
		return message, err
	}
	return message, nil
}
