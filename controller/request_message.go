package controller

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// 单次批量查询的 request_id 数量上限，与日志页最大分页大小对齐
const maxRequestMessageBatchSize = 100

type requestMessagesBatchRequest struct {
	RequestIds []string `json:"request_ids"`
}

type notifyRequestMessageViolationRequest struct {
	NotificationType string `json:"notification_type"`
	Language         string `json:"language"`
	Client           string `json:"client"`
	RequestId        string `json:"request_id"`
	UserId           int    `json:"user_id"`
	ModelName        string `json:"model_name"`
	CreatedAt        int64  `json:"created_at"`
}

func parseRequestIds(c *gin.Context) []string {
	raw := strings.Split(c.Query("request_ids"), ",")
	requestIds := make([]string, 0, len(raw))
	for _, id := range raw {
		if id = strings.TrimSpace(id); id != "" {
			requestIds = append(requestIds, id)
		}
	}
	if len(requestIds) > maxRequestMessageBatchSize {
		requestIds = requestIds[:maxRequestMessageBatchSize]
	}
	return requestIds
}

func parseRequestIdsFromBody(c *gin.Context) ([]string, error) {
	var request requestMessagesBatchRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		return nil, err
	}

	requestIds := make([]string, 0, len(request.RequestIds))
	for _, requestId := range request.RequestIds {
		requestId = strings.TrimSpace(requestId)
		if requestId != "" {
			requestIds = append(requestIds, requestId)
		}
	}
	if len(requestIds) > maxRequestMessageBatchSize {
		requestIds = requestIds[:maxRequestMessageBatchSize]
	}
	return requestIds, nil
}

func GetRequestMessages(c *gin.Context) {
	messages, err := model.GetRequestMessagesByRequestIds(parseRequestIds(c), 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, messages)
}

func GetRequestMessagesBatch(c *gin.Context) {
	requestIds, err := parseRequestIdsFromBody(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	messages, err := model.GetRequestMessagesByRequestIds(requestIds, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, messages)
}

func GetUserRequestMessages(c *gin.Context) {
	messages, err := model.GetRequestMessagesByRequestIds(parseRequestIds(c), c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, messages)
}

func GetUserRequestMessagesBatch(c *gin.Context) {
	requestIds, err := parseRequestIdsFromBody(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	messages, err := model.GetRequestMessagesByRequestIds(requestIds, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, messages)
}

func NotifyRequestMessageViolation(c *gin.Context) {
	requestMessageNotice(c, false)
}

func PreviewRequestMessageNotice(c *gin.Context) {
	requestMessageNotice(c, true)
}

func requestMessageNotice(c *gin.Context, previewOnly bool) {
	var request notifyRequestMessageViolationRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}

	request.RequestId = strings.TrimSpace(request.RequestId)
	if request.RequestId == "" || request.UserId <= 0 {
		common.ApiErrorMsg(c, "request_id and user_id are required")
		return
	}
	switch request.NotificationType {
	case "", service.RequestNoticeNonWorkContent, service.RequestNoticeSecurityRisk:
	default:
		common.ApiErrorT(c, "Invalid notification type")
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

	requestTime := "-"
	if request.CreatedAt > 0 {
		requestTime = time.Unix(request.CreatedAt, 0).Local().Format("2006-01-02 15:04:05")
	}

	lang := strings.TrimSpace(request.Language)
	if lang == "" {
		lang = i18n.StatedLang(c)
	}
	if previewOnly {
		preview, err := service.BuildRequestNoticePreview(requestTime, request.RequestId, request.ModelName, request.NotificationType, request.Client, lang)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, preview)
		return
	}
	cardJSON, err := service.BuildRequestNoticeCard(requestTime, request.RequestId, request.ModelName, request.NotificationType, request.Client, lang)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.SendFeishuCardMessage(user.OpenId, cardJSON); err != nil {
		common.ApiError(c, fmt.Errorf("send request notification: %w", err))
		return
	}

	common.ApiSuccess(c, nil)
}
