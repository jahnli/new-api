package model

import (
	"context"

	"github.com/QuantumNous/new-api/common"
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
