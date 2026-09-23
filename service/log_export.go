package service

import (
	"archive/zip"
	"compress/flate"
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/xuri/excelize/v2"
)

type logExportWriter struct {
	ctx context.Context
	io.Writer
}

func (w logExportWriter) Write(data []byte) (int, error) {
	if err := w.ctx.Err(); err != nil {
		return 0, err
	}
	return w.Writer.Write(data)
}

// WriteLogExport streams worksheet XML, spilling to Excelize's temporary files
// above its memory threshold. Only the final XLSX is sent to the client, so an
// error cannot silently deliver a partial workbook as a successful export.
func WriteLogExport(ctx context.Context, output io.Writer, filter model.LogExportFilter, location *time.Location, masked bool) (int, error) {
	book := excelize.NewFile()
	defer book.Close()
	const sheet = "使用日志"
	if err := book.SetSheetName("Sheet1", sheet); err != nil {
		return 0, err
	}
	stream, err := book.NewStreamWriter(sheet)
	if err != nil {
		return 0, err
	}
	if err := stream.SetColWidth(1, 9, 20); err != nil {
		return 0, err
	}
	if err := stream.SetColWidth(3, 3, 42); err != nil {
		return 0, err
	}
	if err := stream.SetPanes(&excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"}); err != nil {
		return 0, err
	}
	if err := stream.SetRow("A1", []any{"时间", "类型", "模型", "费用", "输入", "输出", "缓存读取", "缓存写入", "缓存写入 (1h)"}); err != nil {
		return 0, err
	}

	// Snapshot display settings once; these conversions do not affect billing.
	symbol := operation_setting.GetCurrencySymbol()
	rate := operation_setting.GetUsdToCurrencyRate(operation_setting.USDExchangeRate)
	quotaPerUnit := common.QuotaPerUnit
	tokensDisplay := operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens
	if quotaPerUnit <= 0 || math.IsNaN(quotaPerUnit) || math.IsInf(quotaPerUnit, 0) || rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
		return 0, errors.New("无效的额度显示配置")
	}
	typeNames := [...]string{"未知", "充值", "消耗", "管理", "系统", "错误", "退款", "登录"}
	count := 0
	err = model.VisitLogExportRows(ctx, filter, func(log model.LogExportRow) error {
		if count >= 1048575 {
			return errors.New("导出超过 Excel 单表行数限制，请缩小筛选范围")
		}
		var other struct {
			CacheTokens          int64  `json:"cache_tokens"`
			CacheCreationTokens  int64  `json:"cache_creation_tokens"`
			CacheCreation5m      int64  `json:"cache_creation_tokens_5m"`
			CacheCreation1h      int64  `json:"cache_creation_tokens_1h"`
			BillingSource        string `json:"billing_source"`
			SubscriptionConsumed *int64 `json:"subscription_consumed"`
		}
		if log.Other != "" {
			if err := common.UnmarshalJsonStr(log.Other, &other); err != nil {
				return fmt.Errorf("日志附加字段无效，导出已停止: %w", err)
			}
		}
		cacheWrite := other.CacheCreationTokens
		if other.CacheCreation5m > 0 || other.CacheCreation1h > 0 {
			cacheWrite = other.CacheCreation5m
		}
		quota := log.Quota
		if other.BillingSource == "subscription" && other.SubscriptionConsumed != nil {
			quota = *other.SubscriptionConsumed
		}
		cost := fmt.Sprintf("%s%.3f", symbol, float64(quota)/quotaPerUnit*rate)
		if tokensDisplay {
			cost = strconv.FormatInt(quota, 10)
		}
		if masked {
			cost = symbol + "*"
		}
		typeName := typeNames[0]
		if log.Type >= 0 && log.Type < len(typeNames) {
			typeName = typeNames[log.Type]
		}
		count++
		return stream.SetRow("A"+strconv.Itoa(count+1), []any{
			time.Unix(log.CreatedAt, 0).In(location).Format("2006-01-02 15:04:05"),
			typeName, log.ModelName, cost, log.PromptTokens, log.CompletionTokens,
			other.CacheTokens, cacheWrite, other.CacheCreation1h,
		})
	})
	if err != nil || count == 0 {
		return count, err
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if err := stream.Flush(); err != nil {
		return 0, err
	}
	// Excelize normally buffers the complete ZIP. Its custom ZIP writer lets
	// us send compressed entries directly to the output file instead. The
	// supplied buffer remains empty, so WriteTo has nothing left to copy.
	book.SetZipWriter(func(_ io.Writer) excelize.ZipWriter {
		writer := zip.NewWriter(logExportWriter{ctx: ctx, Writer: output})
		writer.RegisterCompressor(zip.Deflate, func(w io.Writer) (io.WriteCloser, error) {
			return flate.NewWriter(w, flate.BestSpeed)
		})
		return writer
	})
	_, err = book.WriteTo(io.Discard)
	return count, err
}
