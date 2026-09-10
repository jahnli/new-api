package service

import (
	"bytes"
	"fmt"
	"html"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type CompanyNotificationImage struct {
	Filename    string
	ContentType string
	Data        []byte
}

type CompanyNotificationRequest struct {
	Company         *model.Company
	Title           string
	Content         string
	SendPlatform    bool
	SendEmail       bool
	TestMode        bool
	TestPlatformIDs []string
	TestEmails      []string
	Images          []CompanyNotificationImage
}

type CompanyNotificationFailure struct {
	Channel string `json:"channel"`
	Reason  string `json:"reason"`
	Count   int    `json:"count"`
}

type CompanyNotificationResult struct {
	Total    int                          `json:"total"`
	Success  int                          `json:"success"`
	Failed   int                          `json:"failed"`
	Skipped  int                          `json:"skipped"`
	Failures []CompanyNotificationFailure `json:"failures"`
}

var (
	listCompanyNotificationUsers = model.ListEnabledNotificationUsers
	sendCompanyNotificationEmail = sendNotificationEmail
	prepareFeishuNotification    = prepareFeishuCompanyNotification
	prepareDingTalkNotification  = prepareDingTalkCompanyNotification
)

func SendCompanyNotification(request CompanyNotificationRequest) (*CompanyNotificationResult, error) {
	if request.SendPlatform && request.Company == nil {
		return nil, fmt.Errorf("company is required for platform notifications")
	}
	result := &CompanyNotificationResult{Failures: make([]CompanyNotificationFailure, 0)}
	platformIDs := request.TestPlatformIDs
	emails := request.TestEmails
	if !request.TestMode {
		users, err := listCompanyNotificationUsers()
		if err != nil {
			return nil, err
		}
		platformIDs = make([]string, 0, len(users))
		emails = make([]string, 0, len(users))
		for _, user := range users {
			if request.SendPlatform {
				if strings.TrimSpace(user.OpenId) == "" {
					result.Total++
					result.Skipped++
				} else {
					platformIDs = append(platformIDs, strings.TrimSpace(user.OpenId))
				}
			}
			if request.SendEmail {
				if strings.TrimSpace(user.Email) == "" {
					result.Total++
					result.Skipped++
				} else {
					emails = append(emails, strings.TrimSpace(user.Email))
				}
			}
		}
	}

	if request.SendPlatform {
		platformRecipients := uniqueNonEmptyStrings(platformIDs)
		var sender func(string) error
		var prepareErr error
		if len(platformRecipients) > 0 {
			switch request.Company.Platform {
			case model.CompanyPlatformFeishu:
				sender, prepareErr = prepareFeishuNotification(request.Company, request.Title, request.Content, request.Images)
			case model.CompanyPlatformDingTalk:
				sender, prepareErr = prepareDingTalkNotification(request.Company, request.Title, request.Content, request.Images)
			default:
				prepareErr = fmt.Errorf("company platform does not support notifications")
			}
		}
		for _, recipient := range platformRecipients {
			result.Total++
			if prepareErr != nil {
				result.recordFailure("platform", prepareErr)
				continue
			}
			if err := sender(recipient); err != nil {
				result.recordFailure("platform", err)
				continue
			}
			result.Success++
		}
	}

	if request.SendEmail {
		for _, recipient := range uniqueNonEmptyStrings(emails) {
			result.Total++
			if err := sendCompanyNotificationEmail(recipient, request.Title, request.Content, request.Images); err != nil {
				result.recordFailure("email", err)
				continue
			}
			result.Success++
		}
	}

	return result, nil
}

func (result *CompanyNotificationResult) recordFailure(channel string, err error) {
	result.Failed++
	common.SysError(fmt.Sprintf("company notification %s delivery failed: %s", channel, common.MaskSensitiveInfo(err.Error())))
	reason := "platform delivery failed"
	if channel == "email" {
		reason = "email delivery failed"
	}
	for index := range result.Failures {
		if result.Failures[index].Channel == channel && result.Failures[index].Reason == reason {
			result.Failures[index].Count++
			return
		}
	}
	if len(result.Failures) < 10 {
		result.Failures = append(result.Failures, CompanyNotificationFailure{Channel: channel, Reason: reason, Count: 1})
	}
}

func uniqueNonEmptyStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func sendNotificationEmail(recipient, title, content string, images []CompanyNotificationImage) error {
	attachments := make([]common.EmailAttachment, 0, len(images))
	for _, image := range images {
		attachments = append(attachments, common.EmailAttachment{
			Filename:    image.Filename,
			ContentType: image.ContentType,
			Data:        image.Data,
		})
	}
	body := strings.ReplaceAll(html.EscapeString(content), "\n", "<br>\n")
	return common.SendEmailWithAttachments(title, recipient, body, attachments)
}

func prepareFeishuCompanyNotification(company *model.Company, title, content string, images []CompanyNotificationImage) (func(string) error, error) {
	config, err := company.GetConfig()
	if err != nil {
		return nil, err
	}
	token, err := feishuGetTenantAccessToken(feishuSyncConfig{AppID: config.Feishu.AppID, AppSecret: config.Feishu.AppSecret})
	if err != nil {
		return nil, fmt.Errorf("get Feishu access token: %w", err)
	}
	imageKeys := make([]string, 0, len(images))
	for _, image := range images {
		imageKey, err := uploadFeishuNotificationImage(token, image)
		if err != nil {
			return nil, err
		}
		imageKeys = append(imageKeys, imageKey)
	}
	card := buildFeishuCompanyNotificationCard(title, content, imageKeys)
	cardBytes, err := common.Marshal(card)
	if err != nil {
		return nil, err
	}

	return func(recipient string) error {
		body := map[string]any{
			"receive_id": recipient,
			"msg_type":   "interactive",
			"content":    string(cardBytes),
		}
		endpoint := feishuBaseURL + "/im/v1/messages?receive_id_type=open_id"
		responseBody, status, err := feishuDoRequest(http.MethodPost, endpoint, body, token)
		if err != nil {
			return err
		}
		_, err = feishuCheckResult(responseBody, status)
		return err
	}, nil
}

func buildFeishuCompanyNotificationCard(title, content string, imageKeys []string) map[string]any {
	normalizedContent := strings.ReplaceAll(content, "\r\n", "\n")
	normalizedContent = strings.ReplaceAll(normalizedContent, "\r", "\n")
	firstLine, remainingContent, hasMoreLines := strings.Cut(normalizedContent, "\n")
	formattedContent := "**" + escapeFeishuMarkdown(firstLine) + "**"
	if hasMoreLines {
		remainingContent = strings.TrimLeft(remainingContent, "\n")
		if remainingContent != "" {
			formattedContent += "\n" + escapeFeishuMarkdown(remainingContent)
		}
	}
	card := map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
		},
		"header": map[string]any{
			"template": "orange",
			"title":    map[string]string{"tag": "plain_text", "content": title},
		},
		"elements": []any{
			map[string]any{
				"tag":     "markdown",
				"content": formattedContent,
			},
		},
	}
	elements := card["elements"].([]any)
	for _, imageKey := range imageKeys {
		elements = append(elements, map[string]any{
			"tag": "img", "img_key": imageKey,
			"alt": map[string]string{"tag": "plain_text", "content": title},
		})
	}
	card["elements"] = elements
	return card
}

func uploadFeishuNotificationImage(token string, image CompanyNotificationImage) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("image_type", "message"); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("image", image.Filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(image.Data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, feishuBaseURL+"/im/v1/images", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := feishuHTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	result, err := feishuCheckResult(responseBody, resp.StatusCode)
	if err != nil {
		return "", err
	}
	var data struct {
		ImageKey string `json:"image_key"`
	}
	if err := common.Unmarshal(result.Data, &data); err != nil {
		return "", err
	}
	if data.ImageKey == "" {
		return "", fmt.Errorf("Feishu image upload returned an empty image key")
	}
	return data.ImageKey, nil
}

func prepareDingTalkCompanyNotification(company *model.Company, title, content string, images []CompanyNotificationImage) (func(string) error, error) {
	config, err := company.GetConfig()
	if err != nil {
		return nil, err
	}
	if config.DingTalk.AgentID <= 0 {
		return nil, fmt.Errorf("DingTalk agent ID is not configured")
	}
	token, err := dingtalkGetAccessToken(dingtalkSyncConfig{ClientID: config.DingTalk.ClientID, ClientSecret: config.DingTalk.ClientSecret})
	if err != nil {
		return nil, fmt.Errorf("get DingTalk access token: %w", err)
	}
	mediaIDs := make([]string, 0, len(images))
	for _, image := range images {
		mediaID, err := uploadDingTalkNotificationImage(token, image)
		if err != nil {
			return nil, err
		}
		mediaIDs = append(mediaIDs, mediaID)
	}
	message, err := buildDingTalkCompanyNotificationMarkdown(title, content, mediaIDs)
	if err != nil {
		return nil, err
	}

	return func(recipient string) error {
		return sendDingTalkWorkNotification(token, config.DingTalk.AgentID, recipient, message)
	}, nil
}

func buildDingTalkCompanyNotificationMarkdown(title, content string, mediaIDs []string) (map[string]any, error) {
	// The notification form accepts plain text; only our heading and uploaded
	// images should be interpreted as Markdown.
	escape := strings.NewReplacer(
		"\\", "\\\\", "`", "\\`", "*", "\\*", "_", "\\_",
		"{", "\\{", "}", "\\}", "[", "\\[", "]", "\\]",
		"(", "\\(", ")", "\\)", "#", "\\#", "+", "\\+",
		"-", "\\-", ".", "\\.", "!", "\\!", ">", "\\>",
		"<", "&lt;", "&", "&amp;",
	)
	normalizedContent := strings.ReplaceAll(content, "\r\n", "\n")
	normalizedContent = strings.ReplaceAll(normalizedContent, "\r", "\n")
	text := "## " + escape.Replace(strings.Join(strings.Fields(title), " ")) + "\n\n" +
		strings.ReplaceAll(escape.Replace(normalizedContent), "\n", "  \n")
	for _, mediaID := range mediaIDs {
		text += "\n\n![](" + mediaID + ")"
	}
	// DingTalk limits the complete Markdown body, including image references,
	// to 5000 characters. Never silently truncate the notice or its images.
	if utf8.RuneCountInString(text) > 5000 {
		return nil, fmt.Errorf("DingTalk Markdown notification exceeds 5000 characters including formatting and images")
	}
	return map[string]any{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"title": title,
			"text":  text,
		},
	}, nil
}

func uploadDingTalkNotificationImage(token string, image CompanyNotificationImage) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("media", image.Filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(image.Data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	endpoint := dingTalkBaseURL + "/media/upload?access_token=" + url.QueryEscape(token) + "&type=image"
	req, err := http.NewRequest(http.MethodPost, endpoint, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := (&http.Client{Timeout: dingTalkHTTPTimeout}).Do(req)
	if err != nil {
		return "", fmt.Errorf("DingTalk image upload failed")
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	var response struct {
		Errcode int    `json:"errcode"`
		Errmsg  string `json:"errmsg"`
		MediaID string `json:"media_id"`
	}
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK || response.Errcode != 0 || response.MediaID == "" {
		return "", fmt.Errorf("DingTalk image upload rejected: code=%d message=%s", response.Errcode, response.Errmsg)
	}
	return response.MediaID, nil
}

func sendDingTalkWorkNotification(token string, agentID int64, recipient string, message map[string]any) error {
	endpoint := dingTalkBaseURL + "/topapi/message/corpconversation/asyncsend_v2?access_token=" + url.QueryEscape(token)
	body := map[string]any{
		"agent_id":    agentID,
		"userid_list": recipient,
		"msg":         message,
	}
	responseBody, status, err := dingtalkDoRequest(http.MethodPost, endpoint, body)
	if err != nil {
		return err
	}
	var response struct {
		Errcode int    `json:"errcode"`
		Errmsg  string `json:"errmsg"`
		TaskID  int64  `json:"task_id"`
	}
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return err
	}
	if status != http.StatusOK || response.Errcode != 0 {
		return fmt.Errorf("DingTalk message rejected: code=%d message=%s", response.Errcode, response.Errmsg)
	}
	if response.TaskID <= 0 {
		return fmt.Errorf("DingTalk message returned an invalid task ID: %s", strconv.FormatInt(response.TaskID, 10))
	}
	return nil
}
