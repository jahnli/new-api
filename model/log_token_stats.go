package model

import (
	"context"
	"errors"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// sumLogQuotaData shares the overview's hourly, persisted token totals. The logs
// alias lets existing log filters apply without scanning the raw log database.
func sumLogQuotaData(ctx context.Context, startTimestamp, endTimestamp int64, modelName, username, tokenName, channel, group, userCategory string, userID int, breakdown bool) (Stat, error) {
	var stat Stat
	selection := quotaDataTotalTokensExpr + " AS total_tokens"
	if breakdown {
		selection += `,
            COALESCE(SUM(uncached_input_tokens), 0) AS uncached_input_tokens,
            COALESCE(SUM(uncached_output_tokens), 0) AS uncached_output_tokens,
            COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
            COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens`
	}
	tx := DB.WithContext(ctx).Table("quota_data AS logs").Select(selection)
	var err error
	if userID > 0 {
		tx = tx.Where("logs.user_id = ?", userID)
	} else if tx, err = applyLogUserKeywordFilter(tx, username, "logs.username"); err != nil {
		return stat, err
	}
	if tx, err = applyLogUserCategoryFilter(tx, userCategory); err != nil {
		return stat, err
	}
	if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", modelName); err != nil {
		return stat, err
	}
	if tx, err = applyChannelFilter(tx, "logs.channel_id", channel); err != nil {
		return stat, err
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_id IN (?)", DB.WithContext(ctx).Table("tokens").Select("id").Where("name = ?", tokenName))
	}
	if group != "" {
		tx = tx.Where("logs.use_group = ?", group)
	}
	// Match GetDepartmentStats exactly: timestamps filter hourly bucket starts.
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if err := tx.Scan(&stat).Error; err != nil {
		common.SysError("failed to query log quota-data token stat: " + err.Error())
		return stat, err
	}
	return stat, nil
}

// RecordedLogUsage is reconstructed from the individual request, preserving its
// original cache accounting even after the corresponding key is renamed.
type RecordedLogUsage struct {
	Input, Output, CacheRead, CacheWrite, CacheWrite1h, Quota int64
}

func (log LogExportRow) RecordedUsage() (RecordedLogUsage, error) {
	var other struct {
		CacheTokens          int64  `json:"cache_tokens"`
		CacheWriteTokens     int64  `json:"cache_write_tokens"`
		CacheCreationTokens  int64  `json:"cache_creation_tokens"`
		CacheCreation5m      int64  `json:"cache_creation_tokens_5m"`
		CacheCreation1h      int64  `json:"cache_creation_tokens_1h"`
		BillingSource        string `json:"billing_source"`
		SubscriptionConsumed *int64 `json:"subscription_consumed"`
		UsageSemantic        string `json:"usage_semantic"`
		Claude               bool   `json:"claude"`
	}
	if log.Other != "" {
		if err := common.UnmarshalJsonStr(log.Other, &other); err != nil {
			return RecordedLogUsage{}, err
		}
	}
	cacheRead := max(other.CacheTokens, 0)
	cache5m := max(other.CacheCreation5m, 0)
	cache1h := max(other.CacheCreation1h, 0)
	if cache5m > math.MaxInt64-cache1h {
		return RecordedLogUsage{}, errors.New("cache write token count exceeds int64")
	}
	cacheWrite := max(other.CacheWriteTokens, other.CacheCreationTokens, cache5m+cache1h)
	inputTokens := max(log.PromptTokens, 0)
	semantic := strings.ToLower(strings.TrimSpace(other.UsageSemantic))
	anthropic := semantic == "anthropic" || (semantic == "" && other.Claude && (cache5m > 0 || cache1h > 0))
	if !anthropic {
		// Subtract separately to avoid overflowing when cache totals exceed input.
		inputTokens = max(max(inputTokens-cacheRead, 0)-cacheWrite, 0)
	}
	quota := log.Quota
	if other.BillingSource == "subscription" && other.SubscriptionConsumed != nil {
		quota = *other.SubscriptionConsumed
	}
	return RecordedLogUsage{Input: inputTokens, Output: max(log.CompletionTokens, 0), CacheRead: cacheRead, CacheWrite: cacheWrite, CacheWrite1h: cache1h, Quota: quota}, nil
}

func sumNamedLogUsage(tx *gorm.DB, breakdown bool) (Stat, error) {
	var stat Stat
	rows, err := tx.Select("quota, prompt_tokens, completion_tokens, other").Rows()
	if err != nil {
		return stat, err
	}
	defer rows.Close()
	for rows.Next() {
		var row LogExportRow
		if err := tx.ScanRows(rows, &row); err != nil {
			return stat, err
		}
		if (row.Quota > 0 && int64(stat.Quota) > math.MaxInt-row.Quota) || (row.Quota < 0 && int64(stat.Quota) < math.MinInt-row.Quota) {
			return stat, errors.New("total quota exceeds int range")
		}
		stat.Quota = int(int64(stat.Quota) + row.Quota)
		usage, err := row.RecordedUsage()
		if err != nil {
			return stat, err
		}
		for _, count := range [...]int64{usage.Input, usage.Output, usage.CacheRead, usage.CacheWrite} {
			if count > math.MaxInt64-stat.TotalTokens {
				return stat, errors.New("total token count exceeds int64")
			}
			stat.TotalTokens += count
		}
		if breakdown {
			stat.UncachedInputTokens += usage.Input
			stat.UncachedOutputTokens += usage.Output
			stat.CacheReadTokens += usage.CacheRead
			stat.CacheWriteTokens += usage.CacheWrite
		}
	}
	return stat, rows.Err()
}
