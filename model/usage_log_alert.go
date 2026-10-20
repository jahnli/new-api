package model

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const SystemTaskTypeUsageLogErrorAlert = "usage_log_error_alert"

type UsageLogErrorAlertResult struct {
	ErrorCount     int64 `json:"error_count"`
	LastNotifiedAt int64 `json:"last_notified_at"`
}

// Read the last successful check, so failures do not erase the shared cooldown.
func GetUsageLogErrorAlertResult(ctx context.Context) (UsageLogErrorAlertResult, error) {
	var task SystemTask
	err := DB.WithContext(ctx).Select("result").Where("type = ? AND status = ?", SystemTaskTypeUsageLogErrorAlert, SystemTaskStatusSucceeded).Order("id desc").First(&task).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return UsageLogErrorAlertResult{}, nil
	}
	if err != nil {
		return UsageLogErrorAlertResult{}, err
	}
	var result UsageLogErrorAlertResult
	err = common.UnmarshalJsonStr(task.Result, &result)
	return result, err
}

func CountUsageLogErrors(ctx context.Context, start, end int64) (int64, error) {
	var count int64
	err := LOG_DB.WithContext(ctx).Model(&Log{}).
		Where("type = ? AND created_at >= ? AND created_at < ?", LogTypeError, start, end).
		Count(&count).Error
	return count, err
}

type UsageLogErrorGroup struct {
	ChannelID   int
	ChannelName string `gorm:"-"`
	ModelName   string
	ErrorCount  int64
}

type UsageLogErrorDetails struct {
	Channels []UsageLogErrorGroup
	Models   []UsageLogErrorGroup
}

// Only fetch bounded aggregates; logs may live in a
// separate database, so channel names are loaded from the main DB separately.
func GetUsageLogErrorDetails(ctx context.Context, start, end int64) (UsageLogErrorDetails, error) {
	var details UsageLogErrorDetails
	logs := LOG_DB.WithContext(ctx).Model(&Log{}).
		Where("type = ? AND created_at >= ? AND created_at < ?", LogTypeError, start, end)
	if err := logs.Session(&gorm.Session{}).Select("channel_id, COUNT(*) AS error_count").
		Group("channel_id").Order("error_count desc, channel_id asc").Limit(5).Scan(&details.Channels).Error; err != nil {
		return details, err
	}
	if err := logs.Session(&gorm.Session{}).Select("model_name, COUNT(*) AS error_count").
		Group("model_name").Order("error_count desc, model_name asc").Limit(5).Scan(&details.Models).Error; err != nil {
		return details, err
	}
	channelIDs := make([]int, 0, len(details.Channels))
	for _, group := range details.Channels {
		if group.ChannelID > 0 {
			channelIDs = append(channelIDs, group.ChannelID)
		}
	}
	if len(channelIDs) == 0 {
		return details, nil
	}
	var channels []Channel
	if err := DB.WithContext(ctx).Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return details, err
	}
	names := make(map[int]string, len(channels))
	for _, channel := range channels {
		names[channel.Id] = channel.Name
	}
	for i := range details.Channels {
		details.Channels[i].ChannelName = names[details.Channels[i].ChannelID]
	}
	return details, nil
}
