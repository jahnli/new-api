package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

// ErrNotificationDeliveryUnknown means the provider may have accepted the
// message. Such a delivery must never be included in automatic retries.
var ErrNotificationDeliveryUnknown = errors.New("notification delivery outcome is unknown")

type NotificationSender interface {
	Send(context.Context, NotificationMessage, string) (string, error)
}

type notificationEmailSender struct{}
type notificationFeishuSender struct{ company *model.Company }
type notificationDingTalkSender struct{ company *model.Company }

func SendNotificationMessage(ctx context.Context, message NotificationMessage, recipient string) (string, error) {
	// Older snapshots may still store the icon separately. Current snapshots
	// already contain the complete title and have an empty TitleIcon.
	if message.TitleIcon != "" {
		message.Title = message.TitleIcon + " " + strings.TrimSpace(message.Title)
		message.TitleIcon = ""
	}
	var sender NotificationSender
	if message.Channel == "email" {
		sender = notificationEmailSender{}
	} else {
		company, err := model.GetEnabledCompanyByID(message.CompanyID)
		if err != nil || company.Platform != message.Channel {
			return "", fmt.Errorf("公司已停用或通知通道已变更")
		}
		switch message.Channel {
		case "feishu":
			sender = notificationFeishuSender{company: company}
		case "dingtalk":
			sender = notificationDingTalkSender{company: company}
		default:
			return "", fmt.Errorf("不支持的通知通道")
		}
	}
	id, err := sender.Send(ctx, message, recipient)
	if errors.Is(err, ErrNotificationDeliveryUnknown) {
		return id, &NotificationDeliveryUnknownError{Err: err}
	}
	return id, err
}

func (notificationEmailSender) Send(ctx context.Context, message NotificationMessage, recipient string) (string, error) {
	references, err := notificationImageReferences(message)
	if err != nil {
		return "", err
	}
	var rendered bytes.Buffer
	// Goldmark's default renderer excludes raw HTML and dangerous link schemes.
	markdown := goldmark.New(goldmark.WithExtensions(extension.GFM))
	if err := markdown.Convert([]byte(message.Content), &rendered); err != nil {
		return "", fmt.Errorf("邮件 Markdown 渲染失败")
	}
	var body strings.Builder
	body.WriteString(`<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#182230;max-width:720px;margin:auto;padding:24px"><h1 style="font-size:24px">`)
	body.WriteString(html.EscapeString(message.Title))
	body.WriteString("</h1>")
	body.Write(rendered.Bytes())
	attachments := make([]common.EmailAttachment, 0, len(message.Images))
	for i, image := range message.Images {
		if image.ID != "" && !slices.ContainsFunc(references, func(reference notificationImageReference) bool { return reference.ID == image.ID }) {
			continue
		}
		data, err := base64.StdEncoding.DecodeString(image.Data)
		if err != nil {
			return "", fmt.Errorf("图片数据无效")
		}
		cid := fmt.Sprintf("notification-legacy-image-%d", i)
		if image.ID != "" {
			cid = "notification-image-" + image.ID
		}
		attachments = append(attachments, common.EmailAttachment{
			Filename: image.Filename, ContentType: image.ContentType, Data: data, ContentID: cid,
		})
		if image.ID == "" {
			fmt.Fprintf(&body, `<p><img src="cid:%s" alt="%s" style="max-width:100%%;height:auto;border-radius:8px"></p>`, cid, html.EscapeString(image.Filename))
		}
	}
	body.WriteString("</div>")
	id, err := common.SendNotificationEmail(ctx, message.Title, recipient, body.String(), attachments)
	if errors.Is(err, common.ErrSMTPDeliveryUnknown) {
		return "", fmt.Errorf("%w: SMTP 未确认接收结果，请人工核实", ErrNotificationDeliveryUnknown)
	}
	if err != nil {
		// Transport errors may include SMTP server configuration; do not expose it.
		return "", fmt.Errorf("邮件发送失败，请检查 SMTP 配置、收件地址及服务器连接")
	}
	return id, nil
}

func (sender notificationFeishuSender) Send(ctx context.Context, message NotificationMessage, recipient string) (string, error) {
	config, err := sender.company.GetConfig()
	if err != nil {
		return "", err
	}
	token, err := feishuGetTenantAccessToken(feishuSyncConfig{AppID: config.Feishu.AppID, AppSecret: config.Feishu.AppSecret})
	if err != nil {
		return "", fmt.Errorf("获取飞书应用授权失败，请检查公司应用配置")
	}
	receiveType := message.RecipientType
	if receiveType == "department_id" {
		// Feishu messages target a person or a chat. A department is delivered
		// to its configured department chat; never silently expand to all staff.
		endpoint := feishuBaseURL + "/contact/v3/departments/" + url.PathEscape(recipient) + "?department_id_type=department_id"
		body, _, err := notificationProviderRequest(ctx, http.MethodGet, endpoint, nil, token, false)
		if err != nil {
			return "", err
		}
		var response struct {
			Code int `json:"code"`
			Data struct {
				Department struct {
					ChatID string `json:"chat_id"`
				} `json:"department"`
			} `json:"data"`
		}
		if common.Unmarshal(body, &response) != nil || response.Code != 0 || response.Data.Department.ChatID == "" {
			return "", fmt.Errorf("飞书部门未配置部门群，或应用无权读取该部门")
		}
		recipient, receiveType = response.Data.Department.ChatID, "chat_id"
	}
	if receiveType != "open_id" && receiveType != "chat_id" && receiveType != "user_id" {
		return "", fmt.Errorf("飞书接收人类型无效")
	}
	placements, err := notificationFeishuTables(message.Content)
	if err != nil {
		return "", err
	}
	references, err := notificationImageReferences(message)
	if err != nil {
		return "", err
	}
	imageKeys := make(map[string]string)
	legacyElements := make([]any, 0)
	imageTitle := strings.TrimSpace(message.Title)
	// The card tooltip uses the full title; the upload also needs a valid,
	// bounded filename, with an extension matching the image content.
	filenameTitle := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || strings.ContainsRune(`\/:*?"<>|`, r) {
			return '_'
		}
		return r
	}, imageTitle)
	filenameRunes := []rune(filenameTitle)
	filenameTitle = strings.Trim(string(filenameRunes[:min(len(filenameRunes), 60)]), " .")
	if filenameTitle == "" {
		filenameTitle = "notification"
	}
	for _, image := range message.Images {
		if image.ID != "" && !slices.ContainsFunc(references, func(reference notificationImageReference) bool { return reference.ID == image.ID }) {
			continue
		}
		if err := ctx.Err(); err != nil {
			return "", fmt.Errorf("图片准备超时")
		}
		data, err := base64.StdEncoding.DecodeString(image.Data)
		if err != nil {
			return "", fmt.Errorf("图片数据无效")
		}
		extension := map[string]string{
			"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
		}[image.ContentType]
		key, err := uploadFeishuNotificationImage(ctx, token, notificationImageUpload{Filename: filenameTitle + extension, Data: data})
		if err != nil {
			return "", fmt.Errorf("飞书图片上传失败，请检查应用图片权限或图片格式")
		}
		if image.ID != "" {
			imageKeys[image.ID] = key
		} else {
			legacyElements = append(legacyElements, map[string]any{"tag": "img", "img_key": key, "alt": map[string]string{"tag": "plain_text", "content": imageTitle}})
		}
	}
	// Preserve source order across native tables, images and Markdown sections.
	for _, reference := range references {
		placements = append(placements, notificationFeishuElement{
			Start: reference.Start, End: reference.End,
			Element: map[string]any{"tag": "img", "img_key": imageKeys[reference.ID], "alt": map[string]string{"tag": "plain_text", "content": imageTitle}},
		})
	}
	slices.SortFunc(placements, func(a, b notificationFeishuElement) int { return a.Start - b.Start })
	elements := make([]any, 0, len(placements)*2+1+len(legacyElements))
	last := 0
	for _, placement := range placements {
		if placement.Start < last || placement.End > len(message.Content) {
			return "", fmt.Errorf("飞书消息中的表格或图片位置重叠")
		}
		if content := strings.Trim(message.Content[last:placement.Start], "\r\n"); strings.TrimSpace(content) != "" {
			elements = append(elements, map[string]any{"tag": "markdown", "content": content})
		}
		elements = append(elements, placement.Element)
		last = placement.End
	}
	if remaining := strings.Trim(message.Content[last:], "\r\n"); strings.TrimSpace(remaining) != "" {
		elements = append(elements, map[string]any{"tag": "markdown", "content": remaining})
	}
	elements = append(elements, legacyElements...)
	titleTheme := message.TitleTheme
	if titleTheme == "" {
		// Preserve blue headers for snapshots created before themes were configurable.
		titleTheme = "blue"
	}
	card, err := common.Marshal(map[string]any{
		"config":   map[string]bool{"wide_screen_mode": true},
		"header":   map[string]any{"template": titleTheme, "title": map[string]string{"tag": "plain_text", "content": message.Title}},
		"elements": elements,
	})
	if err != nil {
		return "", err
	}
	body, status, err := notificationProviderRequest(ctx, http.MethodPost, feishuBaseURL+"/im/v1/messages?receive_id_type="+receiveType,
		map[string]string{"receive_id": recipient, "msg_type": "interactive", "content": string(card)}, token, true)
	if err != nil {
		return "", err
	}
	var response struct {
		Code  int    `json:"code"`
		Msg   string `json:"msg"`
		Error struct {
			LogID string `json:"log_id"`
		} `json:"error"`
		Data struct {
			MessageID string `json:"message_id"`
		} `json:"data"`
	}
	if common.Unmarshal(body, &response) != nil {
		return "", fmt.Errorf("%w: 飞书响应无法解析", ErrNotificationDeliveryUnknown)
	}
	if status != http.StatusOK || response.Code != 0 {
		// Card failures include an actionable nested ErrCode/ErrMsg. ErrorValue
		// may echo message content, so exclude it from stored delivery errors.
		detail, _, _ := strings.Cut(response.Msg, "ErrorValue:")
		for _, secret := range []string{token, config.Feishu.AppSecret} {
			if secret != "" {
				detail = strings.ReplaceAll(detail, secret, "[redacted]")
			}
		}
		detail = strings.Join(strings.Fields(common.MaskSensitiveInfo(detail)), " ")
		detailRunes := []rune(detail)
		detail = string(detailRunes[:min(len(detailRunes), 1200)])
		if detail == "" {
			detail = "飞书未提供详细原因"
		}
		description := "飞书拒绝发送"
		if response.Code == 230099 {
			description = "飞书卡片内容创建失败"
		}
		// Feishu trace IDs contain only alphanumeric characters. Do not persist
		// arbitrary response fields or troubleshooting URLs with request data.
		logID := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' {
				return r
			}
			return -1
		}, response.Error.LogID)
		if len(logID) > 128 {
			logID = logID[:128]
		}
		if logID != "" {
			return "", fmt.Errorf("%s（HTTP %d，错误码 %d）：%s；log_id=%s", description, status, response.Code, detail, logID)
		}
		return "", fmt.Errorf("%s（HTTP %d，错误码 %d）：%s", description, status, response.Code, detail)
	}
	if response.Data.MessageID == "" {
		return "", fmt.Errorf("%w: 飞书未返回消息 ID", ErrNotificationDeliveryUnknown)
	}
	return response.Data.MessageID, nil
}

func (sender notificationDingTalkSender) Send(ctx context.Context, message NotificationMessage, recipient string) (string, error) {
	config, err := sender.company.GetConfig()
	if err != nil || config.DingTalk.AgentID <= 0 {
		return "", fmt.Errorf("钉钉应用配置无效")
	}
	token, err := dingtalkGetAccessToken(dingtalkSyncConfig{ClientID: config.DingTalk.ClientID, ClientSecret: config.DingTalk.ClientSecret})
	if err != nil {
		return "", fmt.Errorf("获取钉钉应用授权失败，请检查公司应用配置")
	}
	references, err := notificationImageReferences(message)
	if err != nil {
		return "", err
	}
	mediaIDs := make(map[string]string)
	var legacyImages strings.Builder
	for _, image := range message.Images {
		if image.ID != "" && !slices.ContainsFunc(references, func(reference notificationImageReference) bool { return reference.ID == image.ID }) {
			continue
		}
		if ctx.Err() != nil {
			return "", fmt.Errorf("图片准备超时")
		}
		data, err := base64.StdEncoding.DecodeString(image.Data)
		if err != nil {
			return "", fmt.Errorf("图片数据无效")
		}
		mediaID, err := uploadDingTalkNotificationImage(ctx, token, notificationImageUpload{Filename: image.Filename, Data: data})
		if err != nil {
			return "", fmt.Errorf("钉钉图片上传失败，请检查应用媒体权限或图片格式")
		}
		if image.ID != "" {
			mediaIDs[image.ID] = mediaID
		} else {
			fmt.Fprintf(&legacyImages, "\n\n![](%s)", mediaID)
		}
	}
	var content strings.Builder
	altEscape := strings.NewReplacer("\\", "\\\\", "[", "\\[", "]", "\\]", "\r", " ", "\n", " ")
	last := 0
	for _, reference := range references {
		content.WriteString(message.Content[last:reference.Start])
		fmt.Fprintf(&content, "![%s](%s)", altEscape.Replace(reference.Alt), mediaIDs[reference.ID])
		last = reference.End
	}
	content.WriteString(message.Content[last:])
	content.WriteString(legacyImages.String())
	if utf8.RuneCountInString(content.String()) > 5000 {
		return "", fmt.Errorf("钉钉消息连同图片引用不能超过 5000 个字符")
	}
	markdown := map[string]string{"title": message.Title, "text": content.String()}
	payload := map[string]any{
		"agent_id": config.DingTalk.AgentID,
		"msg":      map[string]any{"msgtype": "markdown", "markdown": markdown},
	}
	endpoint := dingTalkBaseURL + "/topapi/message/corpconversation/asyncsend_v2?access_token=" + url.QueryEscape(token)
	switch message.RecipientType {
	case "user_id":
		payload["userid_list"] = recipient
	case "department_id":
		payload["dept_id_list"] = recipient
		payload["to_all_user"] = false
	case "chat_id":
		endpoint = dingTalkBaseURL + "/chat/send?access_token=" + url.QueryEscape(token)
		payload = map[string]any{"chatid": recipient, "msg": map[string]any{"msgtype": "markdown", "markdown": markdown}}
	default:
		return "", fmt.Errorf("钉钉接收人类型无效")
	}
	body, status, err := notificationProviderRequest(ctx, http.MethodPost, endpoint, payload, "", true)
	if err != nil {
		return "", err
	}
	var response struct {
		Errcode   int    `json:"errcode"`
		TaskID    int64  `json:"task_id"`
		MessageID string `json:"messageId"`
	}
	if common.Unmarshal(body, &response) != nil {
		return "", fmt.Errorf("%w: 钉钉响应无法解析", ErrNotificationDeliveryUnknown)
	}
	if status != http.StatusOK || response.Errcode != 0 {
		return "", fmt.Errorf("钉钉拒绝发送（HTTP %d，错误码 %d），请检查应用权限与接收人", status, response.Errcode)
	}
	if message.RecipientType == "chat_id" && response.MessageID != "" {
		return response.MessageID, nil
	}
	if response.TaskID <= 0 {
		return "", fmt.Errorf("%w: 钉钉未返回消息 ID", ErrNotificationDeliveryUnknown)
	}
	// A task ID only acknowledges submission. Poll the provider's actual work
	// notification result before reporting delivery as successful.
	id := strconv.FormatInt(response.TaskID, 10)
	return id, awaitDingTalkNotification(ctx, token, config.DingTalk.AgentID, response.TaskID, message.RecipientType)
}

func awaitDingTalkNotification(ctx context.Context, token string, agentID, taskID int64, recipientType string) error {
	payload := map[string]int64{"agent_id": agentID, "task_id": taskID}
	for range 30 {
		body, status, err := notificationProviderRequest(ctx, http.MethodPost,
			dingTalkBaseURL+"/topapi/message/corpconversation/getsendprogress?access_token="+url.QueryEscape(token), payload, "", false)
		var progress struct {
			Errcode  int `json:"errcode"`
			Progress struct {
				Percent int `json:"progress_in_percent"`
				Status  int `json:"status"`
			} `json:"progress"`
		}
		if err != nil || status != http.StatusOK || common.Unmarshal(body, &progress) != nil || progress.Errcode != 0 {
			return fmt.Errorf("%w: 钉钉已接收任务，但无法查询发送进度", ErrNotificationDeliveryUnknown)
		}
		if progress.Progress.Percent >= 100 || progress.Progress.Status == 2 {
			body, status, err = notificationProviderRequest(ctx, http.MethodPost,
				dingTalkBaseURL+"/topapi/message/corpconversation/getsendresult?access_token="+url.QueryEscape(token), payload, "", false)
			var result struct {
				Errcode int `json:"errcode"`
				Result  *struct {
					FailedUsers        []string `json:"failed_user_id_list"`
					InvalidUsers       []string `json:"invalid_user_id_list"`
					ForbiddenUsers     []string `json:"forbidden_user_id_list"`
					FailedDepartments  []int64  `json:"failed_dept_id_list"`
					InvalidDepartments []int64  `json:"invalid_dept_id_list"`
				} `json:"send_result"`
			}
			if err != nil || status != http.StatusOK || common.Unmarshal(body, &result) != nil || result.Errcode != 0 || result.Result == nil {
				return fmt.Errorf("%w: 钉钉发送任务已完成，但无法获取接收结果", ErrNotificationDeliveryUnknown)
			}
			failed := len(result.Result.FailedUsers) + len(result.Result.InvalidUsers) + len(result.Result.ForbiddenUsers) + len(result.Result.FailedDepartments) + len(result.Result.InvalidDepartments)
			if failed > 0 {
				if recipientType == "department_id" {
					return fmt.Errorf("%w: 部门中存在发送失败的成员，请在钉钉核实后单独补发", ErrNotificationDeliveryUnknown)
				}
				return fmt.Errorf("钉钉报告接收人发送失败或不在应用可见范围")
			}
			return nil
		}
		timer := time.NewTimer(2 * time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("%w: 钉钉已接收任务，等待发送结果超时", ErrNotificationDeliveryUnknown)
		case <-timer.C:
		}
	}
	return fmt.Errorf("%w: 钉钉任务仍在处理中，请通过任务 ID 核实", ErrNotificationDeliveryUnknown)
}

func notificationProviderRequest(ctx context.Context, method, endpoint string, payload any, token string, sending bool) ([]byte, int, error) {
	var body io.Reader
	if payload != nil {
		encoded, err := common.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return nil, 0, fmt.Errorf("通知请求无法创建")
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		if sending {
			return nil, 0, fmt.Errorf("%w: 上游连接中断或超时，请核实接收结果", ErrNotificationDeliveryUnknown)
		}
		return nil, 0, fmt.Errorf("通知服务连接失败或超时")
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024))
	if err != nil {
		if sending {
			return nil, response.StatusCode, fmt.Errorf("%w: 无法读取上游响应", ErrNotificationDeliveryUnknown)
		}
		return nil, response.StatusCode, fmt.Errorf("无法读取通知服务响应")
	}
	if sending && response.StatusCode >= 500 {
		return nil, response.StatusCode, fmt.Errorf("%w: 上游服务异常（HTTP %d）", ErrNotificationDeliveryUnknown, response.StatusCode)
	}
	return data, response.StatusCode, nil
}
