package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	feishuRobotRequestTimeout  = 10 * time.Second
	feishuRobotResponseMaxSize = 64 * 1024
)

type feishuRobotTextElement struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type feishuRobotInteractivePayload struct {
	MessageType string         `json:"msg_type"`
	Card        map[string]any `json:"card"`
}

type feishuRobotResponse struct {
	Code          *int   `json:"code"`
	Message       string `json:"msg"`
	StatusCode    *int   `json:"StatusCode"`
	StatusMessage string `json:"StatusMessage"`
}

func notifyFeishuChannelStatusAsync(card map[string]any) {
	webhookURL := operation_setting.GetMonitorSetting().FeishuChannelStatusWebhookURL
	if strings.TrimSpace(webhookURL) == "" {
		return
	}

	gopool.Go(func() {
		if err := sendFeishuRobotCard(webhookURL, card); err != nil {
			common.SysError("failed to send Feishu channel status notification: " + err.Error())
		}
	})
}

func sendFeishuRobotCard(webhookURL string, card map[string]any) error {
	return sendFeishuRobotCardContext(context.Background(), webhookURL, card)
}

func sendFeishuRobotCardContext(ctx context.Context, webhookURL string, card map[string]any) error {
	normalizedWebhookURL, err := operation_setting.NormalizeFeishuRobotWebhookURL(webhookURL)
	if err != nil {
		return err
	}
	if normalizedWebhookURL == "" {
		return nil
	}
	if err := ValidateSSRFProtectedFetchURL(normalizedWebhookURL); err != nil {
		return fmt.Errorf("Feishu robot webhook rejected: %w", err)
	}

	requestContext, cancelRequest := context.WithTimeout(ctx, feishuRobotRequestTimeout)
	defer cancelRequest()
	return sendFeishuRobotCardRequest(requestContext, GetSSRFProtectedHTTPClient(), normalizedWebhookURL, card)
}

func sendFeishuRobotCardRequest(ctx context.Context, httpClient *http.Client, webhookURL string, card map[string]any) error {
	payload := feishuRobotInteractivePayload{
		MessageType: "interactive",
		Card:        card,
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal Feishu robot payload: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create Feishu robot request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("failed to send Feishu robot request: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, feishuRobotResponseMaxSize+1))
	if err != nil {
		return fmt.Errorf("failed to read Feishu robot response: %w", err)
	}
	if len(responseBody) > feishuRobotResponseMaxSize {
		return fmt.Errorf("Feishu robot response exceeds %d bytes", feishuRobotResponseMaxSize)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("Feishu robot request failed with HTTP status %d", response.StatusCode)
	}

	var robotResponse feishuRobotResponse
	if err := common.Unmarshal(responseBody, &robotResponse); err != nil {
		return fmt.Errorf("failed to decode Feishu robot response: %w", err)
	}
	if robotResponse.Code != nil {
		if *robotResponse.Code != 0 {
			return fmt.Errorf("Feishu robot rejected the message: code=%d, message=%s", *robotResponse.Code, robotResponse.Message)
		}
		return nil
	}
	if robotResponse.StatusCode != nil {
		if *robotResponse.StatusCode != 0 {
			return fmt.Errorf("Feishu robot rejected the message: code=%d, message=%s", *robotResponse.StatusCode, robotResponse.StatusMessage)
		}
		return nil
	}

	return fmt.Errorf("Feishu robot response did not contain a business status code")
}

func buildFeishuChannelDisableCard(channelName string, channelId int, reason string, occurredAt time.Time) map[string]any {
	cardElements := []any{
		map[string]any{
			"tag":     "markdown",
			"content": "**路由保护已触发**\n系统检测到渠道异常，已将其从可用路由中移除。",
		},
		buildFeishuChannelStatusFields(channelName, channelId, "自动禁用", occurredAt),
		map[string]any{"tag": "hr"},
		map[string]any{
			"tag":     "markdown",
			"content": "**禁用原因**\n" + escapeFeishuMarkdown(formatFeishuChannelDisableReason(reason)),
		},
		map[string]any{
			"tag": "note",
			"elements": []feishuRobotTextElement{
				{
					Tag:     "plain_text",
					Content: "渠道恢复后，可由路由可靠性健康检查自动启用。",
				},
			},
		},
	}
	if channelManagementURL := buildChannelManagementURL(channelName); channelManagementURL != "" {
		cardElements = append(cardElements, map[string]any{
			"tag": "action",
			"actions": []any{
				map[string]any{
					"tag":  "button",
					"type": "primary",
					"text": feishuRobotTextElement{
						Tag:     "plain_text",
						Content: "前往渠道管理",
					},
					"url": channelManagementURL,
				},
			},
		})
	}

	return map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
			"enable_forward":   true,
		},
		"header": map[string]any{
			"template": "red",
			"title": feishuRobotTextElement{
				Tag:     "plain_text",
				Content: "渠道已自动禁用",
			},
		},
		"elements": cardElements,
	}
}

func buildFeishuChannelEnableCard(channelName string, channelId int, occurredAt time.Time) map[string]any {
	return map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
			"enable_forward":   true,
		},
		"header": map[string]any{
			"template": "green",
			"title": feishuRobotTextElement{
				Tag:     "plain_text",
				Content: "渠道已恢复",
			},
		},
		"elements": []any{
			map[string]any{
				"tag":     "markdown",
				"content": "**渠道健康检查通过**\n系统已重新启用该渠道，并恢复参与请求路由。",
			},
			buildFeishuChannelStatusFields(channelName, channelId, "已启用", occurredAt),
			map[string]any{
				"tag": "note",
				"elements": []feishuRobotTextElement{
					{
						Tag:     "plain_text",
						Content: "本次状态恢复由路由可靠性健康检查确认。",
					},
				},
			},
		},
	}
}

func buildFeishuChannelStatusFields(channelName string, channelId int, statusText string, occurredAt time.Time) map[string]any {
	return map[string]any{
		"tag": "div",
		"fields": []map[string]any{
			{
				"is_short": true,
				"text": map[string]string{
					"tag":     "lark_md",
					"content": "**渠道**\n" + escapeFeishuMarkdown(channelName),
				},
			},
			{
				"is_short": true,
				"text": map[string]string{
					"tag":     "lark_md",
					"content": fmt.Sprintf("**渠道 ID**\n#%d", channelId),
				},
			},
			{
				"is_short": true,
				"text": map[string]string{
					"tag":     "lark_md",
					"content": "**当前状态**\n" + statusText,
				},
			},
			{
				"is_short": true,
				"text": map[string]string{
					"tag":     "lark_md",
					"content": "**发生时间**\n" + occurredAt.Format("2006-01-02 15:04:05 MST"),
				},
			},
		},
	}
}

func formatFeishuChannelDisableReason(reason string) string {
	maskedReason := strings.TrimSpace(common.MaskSensitiveInfo(reason))
	if maskedReason == "" {
		maskedReason = "未提供"
	}
	reasonRunes := []rune(maskedReason)
	const maximumReasonRunes = 1000
	if len(reasonRunes) > maximumReasonRunes {
		maskedReason = string(reasonRunes[:maximumReasonRunes]) + "..."
	}
	return maskedReason
}

func escapeFeishuMarkdown(content string) string {
	markdownReplacer := strings.NewReplacer(
		"\\", "\\\\",
		"`", "\\`",
		"*", "\\*",
		"_", "\\_",
		"~", "\\~",
		"[", "\\[",
		"]", "\\]",
	)
	return markdownReplacer.Replace(content)
}

func buildChannelManagementURL(channelName string) string {
	serverAddress := strings.TrimSpace(system_setting.ServerAddress)
	if serverAddress == "" {
		return ""
	}

	channelManagementURL, err := url.JoinPath(serverAddress, "channels")
	if err != nil {
		return ""
	}
	parsedManagementURL, err := url.Parse(channelManagementURL)
	if err != nil {
		return ""
	}
	queryValues := parsedManagementURL.Query()
	queryValues.Set("filter", channelName)
	parsedManagementURL.RawQuery = queryValues.Encode()
	parsedManagementURL.Fragment = ""
	return parsedManagementURL.String()
}
