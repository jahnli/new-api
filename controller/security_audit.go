package controller

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

type notifyOffHoursViolationRequest struct {
	UserId       int   `json:"user_id"`
	StartTime    int64 `json:"start_time"`
	EndTime      int64 `json:"end_time"`
	RequestCount int64 `json:"request_count"`
}

// GetSecurityAuditSetting 供管理员(role >= admin)读取审计配置。
// /api/option/ 为 root 专属,普通管理员打开审计页时需要单独入口获取时段与开关。
func GetSecurityAuditSetting(c *gin.Context) {
	auditSetting := system_setting.GetAuditSetting()
	common.ApiSuccess(c, auditSetting)
}

func GetOffHoursUsage(c *gin.Context) {
	offHoursSetting := system_setting.GetAuditSetting().OffHours
	if !offHoursSetting.Enabled {
		common.ApiErrorMsg(c, "安全审计功能未启用")
		return
	}
	pageInfo := common.GetPageQuery(c)
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if endTimestamp <= 0 {
		endTimestamp = time.Now().Unix()
	}
	if startTimestamp <= 0 {
		startTimestamp = endTimestamp - 7*86400
	}
	username := c.Query("username")
	items, total, err := model.GetOffHoursUsage(startTimestamp, endTimestamp,
		offHoursSetting.StartHour, offHoursSetting.EndHour,
		username, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func NotifyOffHoursViolation(c *gin.Context) {
	var request notifyOffHoursViolationRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	if request.UserId <= 0 || request.StartTime <= 0 || request.EndTime < request.StartTime || request.RequestCount <= 0 {
		common.ApiErrorMsg(c, "user_id, a valid time range, and a positive request_count are required")
		return
	}

	var user model.User
	if err := model.DB.Select("id, open_id").Where("id = ?", request.UserId).First(&user).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(user.OpenId) == "" {
		common.ApiErrorMsg(c, "The user has not bound a Feishu account")
		return
	}

	requestTime := fmt.Sprintf(
		"%s - %s",
		time.Unix(request.StartTime, 0).Local().Format("2006-01-02 15:04:05"),
		time.Unix(request.EndTime, 0).Local().Format("2006-01-02 15:04:05"),
	)
	cardJSON, err := service.BuildOffHoursViolationNoticeCard(requestTime, request.RequestCount)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.SendFeishuCardMessage(user.OpenId, cardJSON); err != nil {
		common.ApiError(c, fmt.Errorf("send off-hours violation notice: %w", err))
		return
	}

	common.ApiSuccess(c, nil)
}

// GetImageStudioAudit 管理员分页查看在线生图记录,支持时间范围与用户名/显示名模糊筛选。
func GetImageStudioAudit(c *gin.Context) {
	if !system_setting.GetAuditSetting().ImageStudio {
		common.ApiErrorMsg(c, "图片审计功能未启用")
		return
	}
	pageInfo := common.GetPageQuery(c)
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	now := time.Now().Unix()
	// 钳制未来时间,同时保证 model 层秒转毫秒不会溢出
	if endTimestamp <= 0 || endTimestamp > now+86400 {
		endTimestamp = now
	}
	if startTimestamp <= 0 {
		startTimestamp = endTimestamp - 30*86400
	}
	if startTimestamp > endTimestamp {
		common.ApiErrorMsg(c, "时间范围无效:开始时间必须早于结束时间")
		return
	}
	items, total, err := model.GetImageStudioAuditGenerations(startTimestamp, endTimestamp,
		c.Query("username"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// DeleteImageStudioAudit permanently removes the stored images and request record.
func DeleteImageStudioAudit(c *gin.Context) {
	err := model.DeleteImageStudioAuditGeneration(c.Param("id"), func(record *model.ImageStudioGeneration) error {
		if len(record.Images) == 0 {
			return nil
		}
		paths := make([]string, 0, len(record.Images))
		for _, asset := range record.Images {
			assetPath, err := cleanImageStudioAssetPath(asset.Path)
			if err != nil {
				return err
			}
			// Paths come from the locked generation record, not the request.
			// Storage folders use names and can predate a user's rename.
			paths = append(paths, assetPath)
		}
		storage, err := getImageStudioStorage()
		if err != nil {
			return err
		}
		for _, assetPath := range paths {
			if err := storage.Delete(c.Request.Context(), assetPath); err != nil {
				return fmt.Errorf("delete image studio asset: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
