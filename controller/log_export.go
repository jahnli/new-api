package controller

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// Bound per-process disk/DB work and prevent duplicate exports for one user.
var logExportSlots = make(chan struct{}, 2)
var logExportUsers sync.Map

func ExportLogs(c *gin.Context) {
	exportLogs(c, false)
}

func ExportSelfLogs(c *gin.Context) {
	exportLogs(c, true)
}

func exportLogs(c *gin.Context, self bool) {
	var filter model.LogExportFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的日志筛选参数"})
		return
	}
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if self {
		filter.UserID = userID
		filter.Username = ""
		if c.GetInt("role") < common.RoleAdminUser {
			filter.Channel = ""
		}
	}
	started := time.Now()
	if filter.EndTimestamp != 0 && filter.StartTimestamp > filter.EndTimestamp {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "开始时间不能晚于结束时间"})
		return
	}
	if filter.EndTimestamp == 0 || filter.EndTimestamp > started.Unix() {
		filter.EndTimestamp = started.Unix()
	}
	if filter.StartTimestamp > filter.EndTimestamp {
		c.Status(http.StatusNoContent)
		return
	}
	location, err := time.LoadLocation(c.DefaultQuery("timezone", "UTC"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的导出时区"})
		return
	}
	if _, loaded := logExportUsers.LoadOrStore(userID, struct{}{}); loaded {
		c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "已有日志导出正在进行"})
		return
	}
	defer logExportUsers.Delete(userID)
	select {
	case logExportSlots <- struct{}{}:
		defer func() { <-logExportSlots }()
	default:
		c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "导出服务繁忙，请稍后重试"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Minute)
	defer cancel()
	file, err := os.CreateTemp("", "usage-log-export-*.xlsx")
	if err != nil {
		common.ApiErrorMsg(c, "无法创建导出文件")
		return
	}
	defer os.Remove(file.Name())
	defer file.Close()
	settings, _ := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	count, err := service.WriteLogExport(ctx, file, filter, location, settings.DemoMode)
	if err != nil {
		if c.Request.Context().Err() == nil {
			common.SysError(fmt.Sprintf("log export failed for user %d: %v", userID, err))
			common.ApiErrorMsg(c, "日志导出失败，请缩小筛选范围后重试")
		}
		return
	}
	if count == 0 {
		c.Status(http.StatusNoContent)
		return
	}
	info, err := file.Stat()
	if err != nil {
		common.ApiErrorMsg(c, "无法读取导出文件")
		return
	}
	if _, err := file.Seek(0, 0); err != nil {
		common.ApiErrorMsg(c, "无法读取导出文件")
		return
	}
	c.Header("X-Export-Count", strconv.Itoa(count))
	startLabel := ""
	if filter.StartTimestamp != 0 {
		startLabel = time.Unix(filter.StartTimestamp, 0).In(location).Format("2006-01-02_15-04-05")
	}
	endLabel := time.Unix(filter.EndTimestamp, 0).In(location).Format("2006-01-02_15-04-05")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="usage-logs_%s~%s.xlsx"`, startLabel, endLabel))
	c.DataFromReader(http.StatusOK, info.Size(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file, nil)
}
