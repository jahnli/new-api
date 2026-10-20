package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

type usageLogErrorAlertHandler struct{}

func init() {
	RegisterSystemTaskHandler(usageLogErrorAlertHandler{})
}

func (usageLogErrorAlertHandler) Type() string { return model.SystemTaskTypeUsageLogErrorAlert }
func (usageLogErrorAlertHandler) Enabled() bool {
	return model.CurrentRequestPolicy().UsageLogErrorAlertEnabled
}
func (usageLogErrorAlertHandler) Interval() time.Duration { return 30 * time.Second }
func (usageLogErrorAlertHandler) NewPayload() any         { return nil }

func (usageLogErrorAlertHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	// The system task lease serializes checks across master nodes. Both the
	// count and cooldown survive node changes, using the configured log DB.
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	result, err := checkUsageLogErrorAlert(ctx)
	if err != nil {
		failSystemTask(task, runnerID, err)
		return
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		common.SysError(common.LogText("failed to finish usage log error alert task: %v", err))
	}
}

func checkUsageLogErrorAlert(ctx context.Context) (model.UsageLogErrorAlertResult, error) {
	result, err := model.GetUsageLogErrorAlertResult(ctx)
	if err != nil {
		return result, err
	}
	policy := model.CurrentRequestPolicy()
	end := time.Now()
	window := time.Duration(policy.UsageLogErrorWindowMinutes) * time.Minute
	if !policy.UsageLogErrorAlertEnabled || end.Unix()-result.LastNotifiedAt < int64(window.Seconds()) {
		return result, nil
	}
	result.ErrorCount, err = model.CountUsageLogErrors(ctx, end.Add(-window).Unix(), end.Unix())
	if err != nil || result.ErrorCount < int64(policy.UsageLogErrorThreshold) {
		return result, err
	}
	// A failed detail lookup must not suppress an already-triggered alert.
	detailContext, cancelDetails := context.WithTimeout(ctx, 5*time.Second)
	details, detailErr := model.GetUsageLogErrorDetails(detailContext, end.Add(-window).Unix(), end.Unix())
	cancelDetails()
	var content strings.Builder
	fmt.Fprintf(&content,
		"最近 %d 分钟共记录 %d 条错误日志，告警阈值为 %d 条。\n统计时段：%s 至 %s\n",
		policy.UsageLogErrorWindowMinutes,
		result.ErrorCount, policy.UsageLogErrorThreshold,
		end.Add(-window).Format(time.RFC3339), end.Format(time.RFC3339),
	)
	if detailErr != nil {
		common.SysError(common.LogText("failed to load usage log error alert details: %v", detailErr))
		content.WriteString("\n详细统计暂时不可用，请进入使用日志查看。\n")
	} else {
		content.WriteString("\n主要出错渠道\n")
		for i, group := range details.Channels {
			name := usageLogAlertText(group.ChannelName, 100)
			if group.ChannelID <= 0 {
				name = "未分配渠道"
			} else if group.ChannelName == "" {
				name = "渠道已删除或名称不可用"
			}
			fmt.Fprintf(&content, "%d. %s：%d 条\n", i+1, name, group.ErrorCount)
		}
		content.WriteString("\n主要出错模型\n")
		for i, group := range details.Models {
			fmt.Fprintf(&content, "%d. %s：%d 条\n", i+1, usageLogAlertText(group.ModelName, 100), group.ErrorCount)
		}
	}
	card := map[string]any{
		"header": map[string]any{
			"template": "red",
			"title":    feishuRobotTextElement{Tag: "plain_text", Content: "使用日志错误告警"},
		},
		"elements": []any{map[string]any{
			"tag":  "div",
			"text": feishuRobotTextElement{Tag: "plain_text", Content: content.String()},
		}},
	}
	if logsURL := buildUsageLogErrorURL(); logsURL != "" {
		actions := []any{map[string]any{
			"tag":  "button",
			"type": "primary",
			"text": feishuRobotTextElement{Tag: "plain_text", Content: "查看错误日志"},
			"url":  logsURL,
		}}
		if channelsURL := buildChannelManagementURL(""); channelsURL != "" {
			actions = append(actions, map[string]any{
				"tag":  "button",
				"type": "default",
				"text": feishuRobotTextElement{Tag: "plain_text", Content: "前往渠道管理"},
				"url":  channelsURL,
			})
		}
		card["elements"] = append(card["elements"].([]any), map[string]any{
			"tag":     "action",
			"actions": actions,
		})
	}
	if err := sendFeishuRobotCardContext(ctx, policy.Options[operation_setting.FeishuChannelStatusWebhookOptionKey], card); err != nil {
		// HTTP errors may contain the secret webhook URL. Do not persist them.
		return result, errors.New("Failed to send usage log error alert to Feishu")
	}
	result.LastNotifiedAt = time.Now().Unix()
	return result, nil
}

// Bound external diagnostic text and reuse the gateway's credential masking.
func usageLogAlertText(value string, limit int) string {
	value = strings.Join(strings.Fields(common.MaskSensitiveInfo(value)), " ")
	if value == "" {
		return "未提供"
	}
	runes := []rune(value)
	if len(runes) > limit {
		return string(runes[:limit]) + "…"
	}
	return value
}

func buildUsageLogErrorURL() string {
	logsURL, err := url.Parse(strings.TrimSpace(system_setting.ServerAddress))
	if err != nil || logsURL.Host == "" || logsURL.User != nil || (logsURL.Scheme != "http" && logsURL.Scheme != "https") {
		return ""
	}
	logsURL = logsURL.JoinPath("usage-logs", "common")
	// TanStack Router JSON-decodes search values; a bare 5 becomes a number
	// and fails the log page's string-enum filter. Use its string-array format.
	query := url.Values{}
	query.Set("type", `["5"]`)
	logsURL.RawQuery = query.Encode()
	logsURL.Fragment = ""
	return logsURL.String()
}
