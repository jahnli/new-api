package model

import (
	"fmt"
	"os"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

type SecurityAuditRecord struct {
	UserId        int                    `json:"user_id" gorm:"column:user_id"`
	Username      string                 `json:"username" gorm:"column:username"`
	DisplayName   string                 `json:"display_name" gorm:"-"`
	LdapId        string                 `json:"ldap_id,omitempty" gorm:"-"`
	AvatarUrl     string                 `json:"avatar_url,omitempty" gorm:"-"`
	Remark        string                 `json:"remark,omitempty" gorm:"-"`
	AuditDate     string                 `json:"audit_date,omitempty" gorm:"column:audit_date"`
	Models        string                 `json:"models" gorm:"column:models"`
	StartTime     int64                  `json:"start_time" gorm:"column:start_time"`
	EndTime       int64                  `json:"end_time" gorm:"column:end_time"`
	TotalQuota    int64                  `json:"total_quota" gorm:"column:total_quota"`
	TotalRequests int64                  `json:"total_requests" gorm:"column:total_requests"`
	Ips           string                 `json:"ips" gorm:"column:ips"`
	Children      []*SecurityAuditRecord `json:"children,omitempty" gorm:"-"`
}

// getActualLogDBType resolves the real database dialect for LOG_DB.
// common.LogSqlType defaults to SQLite, but when LOG_SQL_DSN is unset
// LOG_DB shares the main DB, so we must fall back to the main DB flags.
func getActualLogDBType() string {
	if os.Getenv("LOG_SQL_DSN") != "" {
		return common.LogSqlType
	}
	if common.UsingPostgreSQL {
		return common.DatabaseTypePostgreSQL
	}
	if common.UsingMySQL {
		return common.DatabaseTypeMySQL
	}
	return common.DatabaseTypeSQLite
}

func getLocalTZOffset() int {
	_, offset := time.Now().Zone()
	return offset
}

func getLogHourExpr() string {
	offset := getLocalTZOffset()
	return fmt.Sprintf("((logs.created_at + %d) %% 86400) / 3600", offset)
}

func getLogGroupConcatDistinct(col string) string {
	if getActualLogDBType() == common.DatabaseTypePostgreSQL {
		return fmt.Sprintf("STRING_AGG(DISTINCT %s, ',')", col)
	}
	return fmt.Sprintf("GROUP_CONCAT(DISTINCT %s)", col)
}

func getLogDateExpr() string {
	offset := getLocalTZOffset()
	dbType := getActualLogDBType()
	switch dbType {
	case common.DatabaseTypePostgreSQL:
		return fmt.Sprintf("TO_CHAR(TO_TIMESTAMP(logs.created_at + %d), 'YYYY-MM-DD')", offset)
	case common.DatabaseTypeMySQL:
		return fmt.Sprintf("DATE(FROM_UNIXTIME(logs.created_at + %d))", offset)
	default:
		return fmt.Sprintf("DATE((logs.created_at + %d), 'unixepoch')", offset)
	}
}

func GetSecurityAuditLogs(startTimestamp, endTimestamp int64, startHour, endHour int, startIdx, num int) (records []SecurityAuditRecord, total int64, err error) {
	hourExpr := getLogHourExpr()
	dateExpr := getLogDateExpr()
	modelsExpr := getLogGroupConcatDistinct("logs.model_name")
	ipsExpr := getLogGroupConcatDistinct("logs.ip")

	baseWhere := fmt.Sprintf("logs.type = ? AND %s >= ? AND %s < ?", hourExpr, hourExpr)
	baseArgs := []interface{}{LogTypeConsume, startHour, endHour}
	if startTimestamp != 0 {
		baseWhere += " AND logs.created_at >= ?"
		baseArgs = append(baseArgs, startTimestamp)
	}
	if endTimestamp != 0 {
		baseWhere += " AND logs.created_at <= ?"
		baseArgs = append(baseArgs, endTimestamp)
	}

	err = LOG_DB.Table("logs").Where(baseWhere, baseArgs...).
		Select("COUNT(DISTINCT logs.user_id)").Scan(&total).Error
	if err != nil {
		return nil, 0, err
	}

	parentSelect := fmt.Sprintf(
		"logs.user_id, logs.username, %s as models, MIN(logs.created_at) as start_time, MAX(logs.created_at) as end_time, COALESCE(SUM(logs.quota), 0) as total_quota, COUNT(*) as total_requests, %s as ips",
		modelsExpr, ipsExpr,
	)
	err = LOG_DB.Table("logs").Where(baseWhere, baseArgs...).
		Select(parentSelect).
		Group("logs.user_id, logs.username").
		Order("total_quota DESC").
		Limit(num).Offset(startIdx).
		Find(&records).Error
	if err != nil {
		return nil, 0, err
	}

	if len(records) > 0 {
		userIds := make([]int, len(records))
		for i, r := range records {
			userIds[i] = r.UserId
		}

		var dayRecords []SecurityAuditRecord
		daySelect := fmt.Sprintf(
			"logs.user_id, logs.username, %s as audit_date, %s as models, MIN(logs.created_at) as start_time, MAX(logs.created_at) as end_time, COALESCE(SUM(logs.quota), 0) as total_quota, COUNT(*) as total_requests, %s as ips",
			dateExpr, modelsExpr, ipsExpr,
		)
		err = LOG_DB.Table("logs").Where(baseWhere, baseArgs...).
			Where("logs.user_id IN ?", userIds).
			Select(daySelect).
			Group(fmt.Sprintf("logs.user_id, logs.username, %s", dateExpr)).
			Order(fmt.Sprintf("logs.user_id, %s DESC", dateExpr)).
			Find(&dayRecords).Error
		if err != nil {
			return nil, 0, err
		}

		dayMap := make(map[int][]*SecurityAuditRecord)
		for i := range dayRecords {
			uid := dayRecords[i].UserId
			dayMap[uid] = append(dayMap[uid], &dayRecords[i])
		}
		for i := range records {
			days := dayMap[records[i].UserId]
			if len(days) > 1 {
				records[i].Children = days
			}
		}

		var userInfos []struct {
			Id          int    `gorm:"column:id"`
			DisplayName string `gorm:"column:display_name"`
			LdapId      string `gorm:"column:ldap_id"`
			AvatarUrl   string `gorm:"column:avatar_url"`
			Remark      string `gorm:"column:remark"`
		}
		if err2 := DB.Table("users").Select("id, display_name, ldap_id, avatar_url, remark").
			Where("id IN ?", userIds).Find(&userInfos).Error; err2 == nil {
			infoMap := make(map[int]*struct {
				DisplayName string
				LdapId      string
				AvatarUrl   string
				Remark      string
			}, len(userInfos))
			for i := range userInfos {
				infoMap[userInfos[i].Id] = &struct {
					DisplayName string
					LdapId      string
					AvatarUrl   string
					Remark      string
				}{
					DisplayName: userInfos[i].DisplayName,
					LdapId:      userInfos[i].LdapId,
					AvatarUrl:   userInfos[i].AvatarUrl,
					Remark:      userInfos[i].Remark,
				}
			}
			for i := range records {
				if info, ok := infoMap[records[i].UserId]; ok {
					records[i].DisplayName = info.DisplayName
					records[i].LdapId = info.LdapId
					records[i].AvatarUrl = info.AvatarUrl
					records[i].Remark = info.Remark
				}
			}
		}
	}

	return records, total, nil
}

func GetSecurityAuditDetails(userId int, startTimestamp, endTimestamp int64, startHour, endHour int, startIdx, num int) (logs []*Log, total int64, err error) {
	hourExpr := getLogHourExpr()

	tx := LOG_DB.Where("logs.type = ?", LogTypeConsume).
		Where("logs.user_id = ?", userId).
		Where(fmt.Sprintf("%s >= ? AND %s < ?", hourExpr, hourExpr), startHour, endHour)

	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}

	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
	}

	if channelIds.Len() > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if common.MemoryCacheEnabled {
			for _, channelId := range channelIds.Items() {
				if cacheChannel, err := CacheGetChannel(channelId); err == nil {
					channels = append(channels, struct {
						Id   int    `gorm:"column:id"`
						Name string `gorm:"column:name"`
					}{
						Id:   channelId,
						Name: cacheChannel.Name,
					})
				}
			}
		} else {
			if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
				return logs, total, err
			}
		}
		channelMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, nil
}
