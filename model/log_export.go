package model

import (
	"context"

	"github.com/QuantumNous/new-api/common"
)

// LogExportFilter shares the list endpoint's filter semantics. UserID is set
// exclusively by the controller for self exports, never bound from a request.
type LogExportFilter struct {
	UserID            int    `form:"-"`
	Type              int    `form:"type" binding:"min=0,max=7"`
	StartTimestamp    int64  `form:"start_timestamp" binding:"min=0"`
	EndTimestamp      int64  `form:"end_timestamp" binding:"min=0"`
	ModelName         string `form:"model_name"`
	Username          string `form:"username"`
	TokenName         string `form:"token_name"`
	Channel           string `form:"channel"`
	Group             string `form:"group"`
	RequestID         string `form:"request_id"`
	UpstreamRequestID string `form:"upstream_request_id"`
	UserCategory      string `form:"user_category"`
}

// LogExportRow selects only fields needed by the workbook. Other is parsed into
// the small set of usage fields in the service and is never exported verbatim.
type LogExportRow struct {
	CreatedAt        int64
	Type             int
	ModelName        string
	Quota            int64
	PromptTokens     int64
	CompletionTokens int64
	Other            string
}

// VisitLogExportRows uses one database result stream instead of OFFSET pages.
// No count, user enrichment or channel enrichment is needed. A single SELECT
// also avoids pagination drift and works when ClickHouse logs have no unique ID.
func VisitLogExportRows(ctx context.Context, filter LogExportFilter, visit func(LogExportRow) error) error {
	tx := LOG_DB.WithContext(ctx).Table("logs").Select("created_at, type, model_name, quota, prompt_tokens, completion_tokens, other")
	if filter.UserID > 0 {
		tx = tx.Where("logs.user_id = ?", filter.UserID)
	}
	if filter.Type != LogTypeUnknown {
		tx = tx.Where("logs.type = ?", filter.Type)
	}
	if filter.StartTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", filter.EndTimestamp)
	}
	var err error
	if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", filter.ModelName); err != nil {
		return err
	}
	if tx, err = applyLogUserKeywordFilter(tx, filter.Username, "logs.username"); err != nil {
		return err
	}
	if tx, err = applyLogUserCategoryFilter(tx, filter.UserCategory); err != nil {
		return err
	}
	if tx, err = applyChannelFilter(tx, "logs.channel_id", filter.Channel); err != nil {
		return err
	}
	if filter.TokenName != "" {
		tx = tx.Where("logs.token_name = ?", filter.TokenName)
	}
	if filter.Group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", filter.Group)
	}
	if filter.RequestID != "" {
		tx = tx.Where("logs.request_id = ?", filter.RequestID)
	}
	if filter.UpstreamRequestID != "" {
		tx = tx.Where("logs.upstream_request_id = ?", filter.UpstreamRequestID)
	}
	order := "logs.created_at desc, logs.id desc"
	if filter.UserID > 0 {
		order = "logs.id desc"
	}
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		order = clickHouseLogOrder("logs.")
	}
	rows, err := tx.Order(order).Rows()
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return err
		}
		var row LogExportRow
		if err := LOG_DB.ScanRows(rows, &row); err != nil {
			return err
		}
		if err := visit(row); err != nil {
			return err
		}
	}
	return rows.Err()
}
