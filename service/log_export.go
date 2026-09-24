package service

import (
	"archive/zip"
	"bufio"
	"compress/flate"
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/language"
	"golang.org/x/text/message"
)

type logExportWriter struct {
	ctx context.Context
	io.Writer
}

// LogExportTitle returns the title used both in the workbook and as the
// downloaded file name. The first date in the requested range identifies the
// export; when no start is supplied, the end date (or today) is used.
func LogExportTitle(filter model.LogExportFilter, location *time.Location, channelName string) string {
	if location == nil {
		location = time.UTC
	}
	date := time.Now().In(location)
	if filter.StartTimestamp != 0 {
		date = time.Unix(filter.StartTimestamp, 0).In(location)
	} else if filter.EndTimestamp != 0 {
		date = time.Unix(filter.EndTimestamp, 0).In(location)
	}
	channel := logExportTitlePart(channelName, "全部渠道")
	modelName := logExportTitlePart(filter.ModelName, "全部模型")
	return fmt.Sprintf("%s-%s(%s)日志", date.Format("2006-01-02"), channel, modelName)
}

func logExportTitlePart(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return strings.Map(func(r rune) rune {
		switch r {
		case '<', '>', ':', '"', '/', '\\', '|', '?', '*':
			return '_'
		default:
			if r < 0x20 {
				return -1
			}
			return r
		}
	}, value)
}

func (w logExportWriter) Write(data []byte) (int, error) {
	if err := w.ctx.Err(); err != nil {
		return 0, err
	}
	return w.Writer.Write(data)
}

// WriteLogExport spools one database result stream to disk so the summary can
// precede the detail without a second query or holding every row in memory.
// Only the complete workbook is sent to the client by the controller.
func WriteLogExport(ctx context.Context, output io.Writer, filter model.LogExportFilter, location *time.Location, masked bool, channelName string) (int, error) {
	if location == nil {
		location = time.UTC
	}
	if masked && strings.TrimSpace(filter.Channel) != "" {
		channelName = "已隐藏渠道"
	}

	// Snapshot display settings once; these conversions do not affect billing.
	symbol := operation_setting.GetCurrencySymbol()
	rate := operation_setting.GetUsdToCurrencyRate(operation_setting.USDExchangeRate)
	quotaPerUnit := common.QuotaPerUnit
	tokensDisplay := operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens
	if quotaPerUnit <= 0 || math.IsNaN(quotaPerUnit) || math.IsInf(quotaPerUnit, 0) || rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
		return 0, errors.New("无效的额度显示配置")
	}
	spool, err := os.CreateTemp("", "usage-log-rows-*.gob")
	if err != nil {
		return 0, err
	}
	defer os.Remove(spool.Name())
	defer spool.Close()
	buffer := bufio.NewWriter(logExportWriter{ctx: ctx, Writer: spool})
	encoder := gob.NewEncoder(buffer)
	typeNames := [...]string{"未知", "充值", "消费", "管理", "系统", "错误", "退款", "登录"}
	const headerRow = 8
	const maxLogExportRows = excelize.TotalRows - headerRow
	var typeCounts [len(typeNames)]int
	totalQuota := decimal.Zero
	unitDecimal := decimal.NewFromFloat(quotaPerUnit)
	rateDecimal := decimal.NewFromFloat(rate)
	count := 0
	err = model.VisitLogExportRows(ctx, filter, func(log model.LogExportRow) error {
		if count >= maxLogExportRows {
			return errors.New("导出超过 Excel 单表行数限制，请缩小筛选范围")
		}
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
				return fmt.Errorf("日志附加字段无效，导出已停止: %w", err)
			}
		}
		cacheRead := max(other.CacheTokens, 0)
		cache5m := max(other.CacheCreation5m, 0)
		cache1h := max(other.CacheCreation1h, 0)
		if cache5m > math.MaxInt64-cache1h {
			return errors.New("缓存写入 Token 超出有效范围，导出已停止")
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
		totalQuota = totalQuota.Add(decimal.NewFromInt(quota))
		fee := decimal.NewFromInt(quota).Mul(rateDecimal).DivRound(unitDecimal, 8)
		feeValue := fee.InexactFloat64()
		if math.IsInf(feeValue, 0) || math.IsNaN(feeValue) {
			return errors.New("费用超出 Excel 数值范围，导出已停止")
		}
		var cost any = feeValue
		if tokensDisplay {
			cost = strconv.FormatInt(quota, 10)
		}
		if masked {
			cost = symbol + "*"
		}
		typeName := typeNames[0]
		if log.Type >= 0 && log.Type < len(typeNames) {
			typeName = typeNames[log.Type]
			typeCounts[log.Type]++
		}
		count++
		return encoder.Encode([]any{
			time.Unix(log.CreatedAt, 0).In(location).Format("2006-01-02 15:04:05"),
			typeName, log.ModelName, cost, inputTokens, max(log.CompletionTokens, 0),
			cacheRead, cacheWrite, cache1h,
		})
	})
	if err != nil || count == 0 {
		return count, err
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if err := buffer.Flush(); err != nil {
		return 0, err
	}
	if _, err := spool.Seek(0, io.SeekStart); err != nil {
		return 0, err
	}

	printer := message.NewPrinter(language.English)
	totalFee := totalQuota.Mul(rateDecimal).DivRound(unitDecimal, 8).StringFixed(8)
	integer, fraction, _ := strings.Cut(totalFee, ".")
	// Group the integer digits as text to retain all eight decimal places.
	for i := len(integer) - 3; i > 0 && integer[i-1] != '-'; i -= 3 {
		integer = integer[:i] + "," + integer[i:]
	}
	totalLabel := symbol + integer + "." + fraction
	feeDescription := fmt.Sprintf("换算：计费额度 ÷ %s × %s（%s）\n订阅记录优先取实际消耗（subscription_consumed），缺失时及其他记录取 quota；费用包含订阅消费，不等同于钱包实扣。\n合计按未舍入金额汇总，明细保留 8 位小数，逐行求和可能有尾差。", unitDecimal.String(), rateDecimal.String(), symbol)
	feeHeader := "费用（" + symbol + "）"
	if tokensDisplay {
		totalLabel = totalQuota.String() + " quota"
		feeHeader = "费用（quota）"
		feeDescription = "单位：quota，不作货币换算。\n订阅记录优先取实际消耗（subscription_consumed），缺失时及其他记录取 quota；费用包含订阅消费，不等同于钱包实扣。"
	}
	if masked {
		totalLabel = "***"
		feeDescription = "演示模式：已隐藏费用明细、合计与换算参数。\n费用包含订阅消费，不等同于钱包实扣。"
	}
	title := LogExportTitle(filter, location, channelName)
	notes := []struct{ label, content string }{
		{"数据来源", fmt.Sprintf("当前日志数据库 · logs 表 · %s；统计与下方明细来自同一批记录。", common.LogDatabaseType())},
		{"筛选范围", logExportScopeDescription(filter, location, masked, channelName)},
		{"费用口径", feeDescription},
		{"Token 口径", "输入：扣除原始输入中已包含的缓存读取与写入；Anthropic 输入已不含缓存，不重复扣除。\n缓存读取：cache_tokens。缓存写入：取 cache_write_tokens、cache_creation_tokens、5 分钟与 1 小时创建量之和的最大值，缺省为 0。\n缓存写入 (1h) 已计入缓存写入合计，请勿重复相加。"},
	}
	book := excelize.NewFile()
	defer book.Close()
	const sheet = "使用日志"
	if err := book.SetSheetName("Sheet1", sheet); err != nil {
		return 0, err
	}
	if err := book.AutoFilter(sheet, fmt.Sprintf("A%d:I%d", headerRow, count+headerRow), nil); err != nil {
		return 0, err
	}
	feeFormat := "#,##0.00000000"
	styles := []excelize.Style{
		{Font: &excelize.Font{Family: "Arial", Size: 16, Bold: true, Color: "FFFFFF"}, Fill: excelize.Fill{Type: "pattern", Color: []string{"203864"}, Pattern: 1}, Alignment: &excelize.Alignment{Vertical: "center", WrapText: true, Indent: 1}},
		{Font: &excelize.Font{Family: "Arial", Size: 10, Color: "334155"}, Alignment: &excelize.Alignment{Vertical: "center", WrapText: true, Indent: 1}},
		{Font: &excelize.Font{Family: "Arial", Size: 10, Bold: true, Color: "FFFFFF"}, Fill: excelize.Fill{Type: "pattern", Color: []string{"203864"}, Pattern: 1}, Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true}},
		{Font: &excelize.Font{Family: "Arial", Size: 10}, NumFmt: 3},
		{Font: &excelize.Font{Family: "Arial", Size: 10}, CustomNumFmt: &feeFormat},
		{Font: &excelize.Font{Family: "Arial", Size: 10, Bold: true, Color: "203864"}, Fill: excelize.Fill{Type: "pattern", Color: []string{"F1F5F9"}, Pattern: 1}, Alignment: &excelize.Alignment{Vertical: "top", Indent: 1}},
		{Font: &excelize.Font{Family: "Arial", Size: 12, Bold: true, Color: "203864"}, Fill: excelize.Fill{Type: "pattern", Color: []string{"E8EFF7"}, Pattern: 1}, Alignment: &excelize.Alignment{Vertical: "center", WrapText: true, Indent: 1}},
	}
	styleIDs := make([]int, len(styles))
	for i := range styles {
		styleIDs[i], err = book.NewStyle(&styles[i])
		if err != nil {
			return 0, err
		}
	}
	stream, err := book.NewStreamWriter(sheet)
	if err != nil {
		return 0, err
	}
	if err := stream.SetColWidth(1, 9, 20); err != nil {
		return 0, err
	}
	if err := stream.SetColWidth(1, 1, 28); err != nil {
		return 0, err
	}
	if err := stream.SetColWidth(3, 3, 42); err != nil {
		return 0, err
	}
	if err := stream.SetPanes(&excelize.Panes{Freeze: true, YSplit: headerRow, TopLeftCell: fmt.Sprintf("A%d", headerRow+1), ActivePane: "bottomLeft"}); err != nil {
		return 0, err
	}
	if err := stream.MergeCell("A1", "I1"); err != nil {
		return 0, err
	}
	titleLines := max(1, (len([]rune(title))+59)/60)
	if err := stream.SetRow("A1", []any{title}, excelize.RowOpts{Height: min(28*float64(titleLines)+12, excelize.MaxRowHeight), StyleID: styleIDs[0]}); err != nil {
		return 0, err
	}
	for _, cells := range [][2]string{{"A2", "C2"}, {"D2", "F2"}, {"G2", "I2"}} {
		if err := stream.MergeCell(cells[0], cells[1]); err != nil {
			return 0, err
		}
	}
	breakdown := printer.Sprintf("消费 %d 条 · 错误 %d 条", typeCounts[model.LogTypeConsume], typeCounts[model.LogTypeError])
	if otherCount := count - typeCounts[model.LogTypeConsume] - typeCounts[model.LogTypeError]; otherCount > 0 {
		breakdown += printer.Sprintf(" · 其他 %d 条", otherCount)
	}
	if err := stream.SetRow("A2", []any{
		printer.Sprintf("导出记录\n%d 条", count), nil, nil,
		"记录分布\n" + breakdown, nil, nil,
		"费用合计\n" + totalLabel,
	}, excelize.RowOpts{Height: 64, StyleID: styleIDs[6]}); err != nil {
		return 0, err
	}
	for i, note := range notes {
		row := strconv.Itoa(i + 3)
		if err := stream.MergeCell("B"+row, "I"+row); err != nil {
			return 0, err
		}
		lines := 0
		for line := range strings.SplitSeq(note.content, "\n") {
			// Count non-ASCII characters as two columns so field names do not
			// inflate row heights as much as full-width Chinese characters.
			width := 0
			for _, r := range line {
				width++
				if r > 127 {
					width++
				}
			}
			lines += max(1, (width+159)/160)
		}
		if err := stream.SetRow("A"+row, []any{
			excelize.Cell{StyleID: styleIDs[5], Value: note.label},
			excelize.Cell{StyleID: styleIDs[1], Value: note.content},
		}, excelize.RowOpts{Height: min(16*float64(lines)+12, excelize.MaxRowHeight)}); err != nil {
			return 0, err
		}
	}
	if err := stream.SetRow("A"+strconv.Itoa(headerRow), []any{"时间（" + location.String() + "）", "类型", "模型", feeHeader, "输入 Token", "输出 Token", "缓存读取 Token", "缓存写入 Token（合计）", "缓存写入 (1h)"}, excelize.RowOpts{Height: 28, StyleID: styleIDs[2]}); err != nil {
		return 0, err
	}
	decoder := gob.NewDecoder(bufio.NewReader(spool))
	for i := range count {
		if err := ctx.Err(); err != nil {
			return 0, err
		}
		var values []any
		if err := decoder.Decode(&values); err != nil {
			return 0, err
		}
		if !tokensDisplay && !masked {
			values[3] = excelize.Cell{StyleID: styleIDs[4], Value: values[3]}
		}
		if err := stream.SetRow("A"+strconv.Itoa(i+headerRow+1), values, excelize.RowOpts{StyleID: styleIDs[3]}); err != nil {
			return 0, err
		}
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

func logExportScopeDescription(filter model.LogExportFilter, location *time.Location, masked bool, channelName string) string {
	var models []string
	for entry := range strings.SplitSeq(filter.ModelName, ",") {
		if entry = strings.TrimSpace(entry); entry != "" {
			models = append(models, entry)
		}
	}
	modelScope := "全部模型"
	if len(models) > 0 {
		modelScope = strings.Join(models, "、") + "（包含匹配；% 表示通配符，多项满足任一）"
	}
	channel := strings.TrimSpace(channelName)
	if channel == "" {
		channel = "全部渠道"
	} else if masked {
		channel = "已隐藏"
	}
	start, end := "不限", "不限"
	if filter.StartTimestamp != 0 {
		start = time.Unix(filter.StartTimestamp, 0).In(location).Format("2006-01-02 15:04:05")
	}
	if filter.EndTimestamp != 0 {
		end = time.Unix(filter.EndTimestamp, 0).In(location).Format("2006-01-02 15:04:05")
	}
	timezone := location.String()
	if timezone == "Asia/Shanghai" {
		timezone = "北京时间（Asia/Shanghai）"
	}
	var scope strings.Builder
	fmt.Fprintf(&scope, "时间：%s 至 %s · %s（已指定的起止时刻均包含）\n模型：%s\n渠道：%s", start, end, timezone, modelScope, channel)
	if filter.UserID > 0 {
		scope.WriteString(" · 用户范围：仅自己")
	} else {
		scope.WriteString(" · 用户范围：全部用户")
	}
	if filter.Type != 0 {
		fmt.Fprintf(&scope, " · 类型代码：%d", filter.Type)
	}
	for _, item := range []struct{ label, value string }{
		{"用户", filter.Username}, {"角色", filter.UserCategory}, {"分组", filter.Group},
		{"令牌", filter.TokenName}, {"请求 ID", filter.RequestID}, {"上游请求 ID", filter.UpstreamRequestID},
	} {
		if item.value == "" {
			continue
		}
		value := item.value
		if masked {
			value = "已隐藏"
		}
		scope.WriteString("\n" + item.label + "：" + value)
	}
	return scope.String()
}
