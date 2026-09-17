package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 安全审计"非工作时间请求"聚合:不落额外数据,查询时对 logs 表按逐天生成的
// 审计时段 Unix 秒区间做多区间聚合。时区口径为服务器本地时区(部署 TZ 决定)。

const (
	// MaxOffHoursAuditDays 单次查询允许的最大天数范围
	MaxOffHoursAuditDays = 366
	// maxOffHoursGroupRows 聚合分组行数保险丝(用户×天×模型×IP)
	maxOffHoursGroupRows = 100000
)

// OffHoursWindow 单天审计窗口。BucketStart 为未裁剪的窗口起点,用于天桶号对齐;
// Start/End 为与筛选范围求交后的实际查询区间,左闭右开。
type OffHoursWindow struct {
	Date        string
	BucketStart int64
	Start       int64
	End         int64
}

type OffHoursDayRow struct {
	Date        string   `json:"date"`
	WindowStart int64    `json:"window_start"`
	WindowEnd   int64    `json:"window_end"`
	StartTime   int64    `json:"start_time"`
	EndTime     int64    `json:"end_time"`
	Models      []string `json:"models"`
	Ips         []string `json:"ips"`
	Count       int64    `json:"count"`
	Quota       int64    `json:"quota"`
}

type OffHoursUserRow struct {
	UserId      int              `json:"user_id"`
	Username    string           `json:"username"`
	DisplayName string           `json:"display_name"`
	AvatarUrl   string           `json:"avatar_url"`
	Days        int              `json:"days"`
	Models      []string         `json:"models"`
	Ips         []string         `json:"ips"`
	Count       int64            `json:"count"`
	Quota       int64            `json:"quota"`
	DayRows     []OffHoursDayRow `json:"day_rows"`
}

// GenerateOffHoursWindows 为 [startTs, endTs](含端,Unix 秒)内的每一天生成审计窗口
// [当天 startHour, 当天 endHour),并与筛选范围求交。endHour <= startHour 表示跨午夜
// (窗口延伸到次日 endHour),归属天为起始天。
func GenerateOffHoursWindows(startTs, endTs int64, startHour, endHour int, loc *time.Location) ([]OffHoursWindow, error) {
	if startTs >= endTs {
		return nil, errors.New("时间范围无效:开始时间必须早于结束时间")
	}
	if startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 {
		return nil, errors.New("审计时段配置无效:小时必须为 0-23 的整数")
	}
	if startHour == endHour {
		return nil, errors.New("审计时段配置无效:开始与结束小时不能相同")
	}
	if (endTs-startTs)/86400+2 > MaxOffHoursAuditDays {
		return nil, fmt.Errorf("时间范围过大:最多支持 %d 天", MaxOffHoursAuditDays)
	}

	rangeStart := time.Unix(startTs, 0).In(loc)
	rangeEnd := time.Unix(endTs, 0).In(loc)
	// 从前一天开始迭代,覆盖跨午夜窗口延伸进筛选范围的情形
	day := time.Date(rangeStart.Year(), rangeStart.Month(), rangeStart.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -1)
	lastDay := time.Date(rangeEnd.Year(), rangeEnd.Month(), rangeEnd.Day(), 0, 0, 0, 0, loc)

	var windows []OffHoursWindow
	for !day.After(lastDay) {
		winStart := time.Date(day.Year(), day.Month(), day.Day(), startHour, 0, 0, 0, loc)
		var winEnd time.Time
		if endHour > startHour {
			winEnd = time.Date(day.Year(), day.Month(), day.Day(), endHour, 0, 0, 0, loc)
		} else {
			next := day.AddDate(0, 0, 1)
			winEnd = time.Date(next.Year(), next.Month(), next.Day(), endHour, 0, 0, 0, loc)
		}
		day = day.AddDate(0, 0, 1)

		// 与筛选范围求交:筛选含端 [startTs, endTs] 折算为右开 [startTs, endTs+1)
		effStart := winStart.Unix()
		effEnd := winEnd.Unix()
		if effStart < startTs {
			effStart = startTs
		}
		if effEnd > endTs+1 {
			effEnd = endTs + 1
		}
		if effStart >= effEnd {
			continue
		}
		windows = append(windows, OffHoursWindow{
			Date:        winStart.Format("2006-01-02"),
			BucketStart: winStart.Unix(),
			Start:       effStart,
			End:         effEnd,
		})
	}
	return windows, nil
}

// offHoursDayBucketExpr 天桶表达式:(created_at - anchor) 整除 86400,含一个 anchor 占位参数。
// 窗口长度 < 24h 且逐日 BucketStart 等差 86400,故桶号即窗口下标,不依赖数据库时区函数。
// 注意 MySQL 不能用 CAST(x AS SIGNED) 截断——它是四舍五入。
func offHoursDayBucketExpr() string {
	switch {
	case common.UsingLogDatabase(common.DatabaseTypeMySQL):
		return "((created_at - ?) DIV 86400)"
	case common.UsingLogDatabase(common.DatabaseTypeClickHouse):
		return "intDiv(created_at - ?, 86400)"
	default:
		// PostgreSQL/SQLite:整型除法向零截断,WHERE 边界保证被除数非负
		return "((created_at - ?) / 86400)"
	}
}

type offHoursDayAgg struct {
	models  map[string]int64
	ips     map[string]struct{}
	firstTs int64
	lastTs  int64
	count   int64
	quota   int64
}

type offHoursUserAgg struct {
	username string
	lastTs   int64
	days     map[int]*offHoursDayAgg
}

// GetOffHoursUsage 聚合审计时段内的消费日志,返回按用户汇总(内嵌按天子行)的分页结果。
// total 为用户总数;分页在应用层按用户维度切片。
func GetOffHoursUsage(startTs, endTs int64, startHour, endHour int, username string, startIdx int, num int) ([]*OffHoursUserRow, int64, error) {
	windows, err := GenerateOffHoursWindows(startTs, endTs, startHour, endHour, time.Local)
	if err != nil {
		return nil, 0, err
	}
	if len(windows) == 0 {
		return []*OffHoursUserRow{}, 0, nil
	}

	anchor := windows[0].BucketStart
	var sb strings.Builder
	args := make([]interface{}, 0, 4+2*len(windows))
	sb.WriteString("SELECT user_id, username, ")
	sb.WriteString(offHoursDayBucketExpr())
	args = append(args, anchor)
	sb.WriteString(" AS day_bucket, model_name, ip, COUNT(*) AS req_count, COALESCE(SUM(quota), 0) AS total_quota, ")
	sb.WriteString("MIN(created_at) AS first_ts, MAX(created_at) AS last_ts FROM logs WHERE type = ? AND created_at >= ? AND created_at < ? AND (")
	args = append(args, LogTypeConsume, windows[0].Start, windows[len(windows)-1].End)
	for i, w := range windows {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(created_at >= ? AND created_at < ?)")
		args = append(args, w.Start, w.End)
	}
	sb.WriteString(")")
	trimmedKeyword := strings.TrimSpace(username)
	if trimmedKeyword != "" {
		likeKeyword := "%" + trimmedKeyword + "%"
		var matchedUserIds []int
		if err = DB.Table("users").
			Where("username LIKE ? OR display_name LIKE ?", likeKeyword, likeKeyword).
			Pluck("id", &matchedUserIds).Error; err != nil {
			return nil, 0, err
		}

		if len(matchedUserIds) > 0 {
			sb.WriteString(" AND (user_id IN ? OR username LIKE ?)")
			args = append(args, matchedUserIds, likeKeyword)
		} else {
			sb.WriteString(" AND username LIKE ?")
			args = append(args, likeKeyword)
		}
	}
	sb.WriteString(" GROUP BY user_id, username, day_bucket, model_name, ip")
	sb.WriteString(fmt.Sprintf(" LIMIT %d", maxOffHoursGroupRows+1))

	var rows []struct {
		UserId     int    `gorm:"column:user_id"`
		Username   string `gorm:"column:username"`
		DayBucket  int64  `gorm:"column:day_bucket"`
		ModelName  string `gorm:"column:model_name"`
		Ip         string `gorm:"column:ip"`
		ReqCount   int64  `gorm:"column:req_count"`
		TotalQuota int64  `gorm:"column:total_quota"`
		FirstTs    int64  `gorm:"column:first_ts"`
		LastTs     int64  `gorm:"column:last_ts"`
	}
	if err = LOG_DB.Raw(sb.String(), args...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	if len(rows) > maxOffHoursGroupRows {
		return nil, 0, errors.New("查询结果过大,请缩小时间范围")
	}

	userAggs := make(map[int]*offHoursUserAgg)
	for _, row := range rows {
		bucket := int(row.DayBucket)
		if bucket < 0 || bucket >= len(windows) {
			continue
		}
		w := windows[bucket]
		if row.FirstTs < w.Start || row.FirstTs >= w.End {
			continue
		}
		user, ok := userAggs[row.UserId]
		if !ok {
			user = &offHoursUserAgg{username: row.Username, days: make(map[int]*offHoursDayAgg)}
			userAggs[row.UserId] = user
		}
		if row.LastTs >= user.lastTs {
			user.lastTs = row.LastTs
			user.username = row.Username
		}
		day, ok := user.days[bucket]
		if !ok {
			day = &offHoursDayAgg{
				models:  make(map[string]int64),
				ips:     make(map[string]struct{}),
				firstTs: row.FirstTs,
				lastTs:  row.LastTs,
			}
			user.days[bucket] = day
		}
		if row.ModelName != "" {
			day.models[row.ModelName] += row.ReqCount
		}
		if row.Ip != "" {
			day.ips[row.Ip] = struct{}{}
		}
		if row.FirstTs < day.firstTs {
			day.firstTs = row.FirstTs
		}
		if row.LastTs > day.lastTs {
			day.lastTs = row.LastTs
		}
		day.count += row.ReqCount
		day.quota += row.TotalQuota
	}

	users := make([]*OffHoursUserRow, 0, len(userAggs))
	for userId, agg := range userAggs {
		row := &OffHoursUserRow{UserId: userId, Username: agg.username}
		userModels := make(map[string]int64)
		userIps := make(map[string]struct{})
		buckets := make([]int, 0, len(agg.days))
		for bucket := range agg.days {
			buckets = append(buckets, bucket)
		}
		// 按天倒序展示(最近的一天在前)
		sort.Sort(sort.Reverse(sort.IntSlice(buckets)))
		for _, bucket := range buckets {
			day := agg.days[bucket]
			w := windows[bucket]
			row.DayRows = append(row.DayRows, OffHoursDayRow{
				Date:        w.Date,
				WindowStart: w.Start,
				WindowEnd:   w.End,
				StartTime:   day.firstTs,
				EndTime:     day.lastTs,
				Models:      topModelsByRequestCount(day.models, 2),
				Ips:         sortedSetItems(day.ips),
				Count:       day.count,
				Quota:       day.quota,
			})
			for modelName, requestCount := range day.models {
				userModels[modelName] += requestCount
			}
			for ip := range day.ips {
				userIps[ip] = struct{}{}
			}
			row.Count += day.count
			row.Quota += day.quota
		}
		row.Days = len(row.DayRows)
		row.Models = topModelsByRequestCount(userModels, 2)
		row.Ips = sortedSetItems(userIps)
		users = append(users, row)
	}

	sort.Slice(users, func(i, j int) bool {
		if users[i].Days != users[j].Days {
			return users[i].Days > users[j].Days
		}
		if users[i].Quota != users[j].Quota {
			return users[i].Quota > users[j].Quota
		}
		if users[i].Count != users[j].Count {
			return users[i].Count > users[j].Count
		}
		return users[i].UserId < users[j].UserId
	})

	total := int64(len(users))
	if startIdx < 0 {
		startIdx = 0
	}
	if startIdx >= len(users) {
		return []*OffHoursUserRow{}, total, nil
	}
	end := startIdx + num
	if num <= 0 || end > len(users) {
		end = len(users)
	}
	page := users[startIdx:end]

	if err = fillOffHoursUserInfo(page); err != nil {
		return nil, 0, err
	}
	return page, total, nil
}

func topModelsByRequestCount(modelRequestCounts map[string]int64, limit int) []string {
	type modelRequestCount struct {
		name  string
		count int64
	}

	models := make([]modelRequestCount, 0, len(modelRequestCounts))
	for modelName, requestCount := range modelRequestCounts {
		models = append(models, modelRequestCount{name: modelName, count: requestCount})
	}
	sort.Slice(models, func(leftIndex, rightIndex int) bool {
		if models[leftIndex].count != models[rightIndex].count {
			return models[leftIndex].count > models[rightIndex].count
		}
		return models[leftIndex].name < models[rightIndex].name
	})

	if limit > 0 && len(models) > limit {
		models = models[:limit]
	}
	modelNames := make([]string, len(models))
	for index, model := range models {
		modelNames[index] = model.name
	}
	return modelNames
}

func sortedSetItems(set map[string]struct{}) []string {
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	sort.Strings(items)
	return items
}

// fillOffHoursUserInfo 用主库回填用户展示信息。logs 可能位于独立日志库,禁止跨库 JOIN。
func fillOffHoursUserInfo(users []*OffHoursUserRow) error {
	if len(users) == 0 {
		return nil
	}
	ids := make([]int, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.UserId)
	}
	var infos []struct {
		Id          int    `gorm:"column:id"`
		DisplayName string `gorm:"column:display_name"`
		AvatarUrl   string `gorm:"column:avatar_url"`
	}
	if err := DB.Table("users").Select("id, display_name, avatar_url").Where("id IN ?", ids).Find(&infos).Error; err != nil {
		return err
	}
	infoMap := make(map[int]struct {
		DisplayName string
		AvatarUrl   string
	}, len(infos))
	for _, info := range infos {
		infoMap[info.Id] = struct {
			DisplayName string
			AvatarUrl   string
		}{info.DisplayName, info.AvatarUrl}
	}
	for _, u := range users {
		if info, ok := infoMap[u.UserId]; ok {
			u.DisplayName = info.DisplayName
			u.AvatarUrl = info.AvatarUrl
		}
	}
	return nil
}
