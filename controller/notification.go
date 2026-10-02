package controller

import (
	"context"
	"encoding/base64"
	"encoding/csv"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/notificationstore"
	"github.com/QuantumNous/new-api/pkg/objectstorage"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func notificationCanSend(c *gin.Context) bool {
	return c.GetInt("role") >= common.RoleAdminUser && authz.Can(c.GetInt("id"), c.GetInt("role"), authz.NotificationSend)
}

func notificationCanViewAll(c *gin.Context) bool {
	return c.GetInt("role") >= common.RoleAdminUser && authz.Can(c.GetInt("id"), c.GetInt("role"), authz.NotificationView)
}

func notificationError(c *gin.Context, err error) {
	status, message := http.StatusInternalServerError, "notification operation failed"
	if errors.Is(err, objectstorage.ErrNotConfigured) {
		status, message = http.StatusServiceUnavailable, "notification storage requires IMAGE_STUDIO_S3_DSN"
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		status, message = http.StatusNotFound, "notification not found"
	}
	if errors.Is(err, model.ErrNotificationActive) || errors.Is(err, model.ErrNotificationConflict) {
		status, message = http.StatusConflict, err.Error()
	}
	var validationError *service.NotificationValidationError
	if errors.As(err, &validationError) {
		status, message = http.StatusBadRequest, validationError.Error()
	}
	var deliveryUnknown *service.NotificationDeliveryUnknownError
	if errors.As(err, &deliveryUnknown) {
		status, message = http.StatusBadGateway, "发送结果未能确认，请先检查发送历史和收件情况，不要重复发送"
	}
	c.JSON(status, gin.H{"success": false, "message": message})
}

func notificationBind(c *gin.Context, body any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.NotificationMaxBodyBytes)
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		var sizeError *http.MaxBytesError
		status := http.StatusBadRequest
		if errors.As(err, &sizeError) {
			status = http.StatusRequestEntityTooLarge
		}
		c.JSON(status, gin.H{"success": false, "message": "invalid notification request or request exceeds 72 MB"})
		return false
	}
	if err := common.Unmarshal(payload, body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid notification request"})
		return false
	}
	return true
}

func notificationID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid notification ID"})
		return 0, false
	}
	return id, true
}

func GetNotificationConfig(c *gin.Context) {
	companies, err := model.ListEnabledCompanies()
	if err != nil {
		notificationError(c, err)
		return
	}
	items := make([]gin.H, 0, len(companies))
	for _, company := range companies {
		if company.Platform == model.CompanyPlatformFeishu || company.Platform == model.CompanyPlatformDingTalk {
			items = append(items, gin.H{"id": company.Id, "name": company.Name, "platform": company.Platform})
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"companies": items, "can_send": notificationCanSend(c)}})
}

func SendNotification(c *gin.Context) {
	isTest := strings.HasSuffix(c.FullPath(), "/test")
	if !isTest && !notificationCanSend(c) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "notification send permission is required"})
		return
	}
	var message service.NotificationMessage
	if !notificationBind(c, &message) {
		return
	}
	if err := resolveNotificationImages(c, &message); err != nil {
		notificationError(c, err)
		return
	}
	record, err := service.DeliverNotificationMessage(c.Request.Context(), message, c.GetInt("id"), c.GetString("username"), isTest)
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": record})
}

func GetNotificationAudience(c *gin.Context) {
	if !notificationCanSend(c) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "notification send permission is required"})
		return
	}
	companyID, err := strconv.Atoi(c.Query("company_id"))
	if err != nil || companyID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid company ID"})
		return
	}
	audience, err := service.ResolveNotificationAudience(c.Query("channel"), companyID)
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": audience})
}

func notificationFilter(c *gin.Context) (model.NotificationFilter, bool) {
	filter := model.NotificationFilter{ViewerID: c.GetInt("id"), Admin: notificationCanViewAll(c), IncludeTests: c.Query("include_tests") == "true", Page: 1, PageSize: 20,
		Channel: c.Query("channel"), Status: c.Query("status"), Keyword: c.Query("keyword"), Sender: c.Query("sender")}
	for _, item := range []struct {
		key    string
		target *int
		max    int
	}{{"page", &filter.Page, 1000000}, {"page_size", &filter.PageSize, 100}} {
		if value := c.Query(item.key); value != "" {
			n, err := strconv.Atoi(value)
			if err != nil || n < 1 || n > item.max {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid pagination"})
				return filter, false
			}
			*item.target = n
		}
	}
	for _, item := range []struct {
		key    string
		target **time.Time
	}{{"from", &filter.From}, {"to", &filter.To}} {
		value := c.Query(item.key)
		if value == "" {
			continue
		}
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			parsed, err = time.Parse("2006-01-02", value)
			if err == nil && item.key == "to" {
				parsed = parsed.Add(24*time.Hour - time.Nanosecond)
			}
		}
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "dates must use ISO 8601"})
			return filter, false
		}
		*item.target = &parsed
	}
	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid date range"})
		return filter, false
	}
	if len(filter.Keyword) > 512 || len(filter.Sender) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "search text is too long"})
		return filter, false
	}
	return filter, true
}

func ListNotificationRecords(c *gin.Context) {
	filter, ok := notificationFilter(c)
	if !ok {
		return
	}
	items, total, err := model.ListNotifications(filter)
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items, "total": total}})
}

func GetNotificationRecord(c *gin.Context) {
	id, ok := notificationID(c)
	if !ok {
		return
	}
	record, err := model.GetNotification(id, c.GetInt("id"), notificationCanViewAll(c), false)
	if err != nil {
		notificationError(c, err)
		return
	}
	if c.Query("include_message") != "false" {
		ctx, cancel := context.WithTimeout(c.Request.Context(), time.Minute)
		defer cancel()
		record.Message, err = notificationstore.Read(ctx, record.StorageKey, record.ID, false)
		if err != nil {
			notificationError(c, err)
			return
		}
	}
	attempts, err := model.NotificationAttempts(id)
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": record.ID, "user_id": record.SenderID, "sender_name": record.Sender, "channel": record.Channel, "company_id": record.CompanyID, "title": record.Title, "is_test": record.IsTest, "status": record.Status, "total": record.Total, "success_count": record.SuccessCount, "failed_count": record.FailedCount, "unknown_count": record.UnknownCount, "created_at": record.CreatedAt, "updated_at": record.UpdatedAt, "message": record.Message, "deliveries": record.Deliveries, "attempts": attempts}})
}

func DeleteNotificationRecords(c *gin.Context) {
	var request struct {
		IDs []int `json:"ids"`
	}
	if !notificationBind(c, &request) {
		return
	}
	if len(request.IDs) < 1 || len(request.IDs) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "select between 1 and 50 notification records"})
		return
	}
	seen := make(map[int]bool, len(request.IDs))
	for _, id := range request.IDs {
		if id <= 0 || seen[id] {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid or duplicate notification IDs"})
			return
		}
		seen[id] = true
	}
	if err := model.DeleteNotifications(request.IDs, c.GetInt("id"), notificationCanViewAll(c)); err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
}

func RetryNotificationRecord(c *gin.Context) {
	id, ok := notificationID(c)
	if !ok {
		return
	}
	record, err := service.RetryNotificationMessage(c.Request.Context(), id, c.GetInt("id"), notificationCanSend(c))
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": record})
}

func RetryNotificationRecords(c *gin.Context) {
	var request struct {
		IDs []int `json:"ids"`
	}
	if !notificationBind(c, &request) {
		return
	}
	if len(request.IDs) < 1 || len(request.IDs) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "select between 1 and 50 notification records"})
		return
	}
	results := make([]gin.H, 0, len(request.IDs))
	seen := make(map[int]bool)
	for _, id := range request.IDs {
		if id <= 0 || seen[id] {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid or duplicate notification IDs"})
			return
		}
		seen[id] = true
	}
	for _, id := range request.IDs {
		record, err := service.RetryNotificationMessage(c.Request.Context(), id, c.GetInt("id"), notificationCanSend(c))
		result := gin.H{"id": id, "success": err == nil}
		if err != nil {
			result["message"] = "record is inaccessible, active, or has no failed recipients"
		} else {
			result["success"] = record.Status == model.NotificationSuccess
			result["status"] = record.Status
			for _, delivery := range record.Deliveries {
				if delivery.Error != "" {
					result["message"] = delivery.Error
					break
				}
			}
		}
		results = append(results, result)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": results})
}

func ExportNotificationRecords(c *gin.Context) {
	if !notificationCanViewAll(c) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "notification view permission is required"})
		return
	}
	filter, ok := notificationFilter(c)
	if !ok {
		return
	}
	filter.Page, filter.PageSize = 1, 100
	items, total, err := model.ListNotifications(filter)
	if err != nil {
		notificationError(c, err)
		return
	}
	if total > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "narrow the export to 10000 records or fewer"})
		return
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="notifications.csv"`)
	c.Header("X-Content-Type-Options", "nosniff")
	writer := csv.NewWriter(c.Writer)
	if err := writer.Write([]string{"ID", "Channel", "Title", "Summary", "Sender", "Status", "Recipient", "Delivery status", "Failure reason", "Message ID", "Attempts", "Created at", "Test"}); err != nil {
		return
	}
	for {
		for _, record := range items {
			deliveries, err := model.ListNotificationDeliveries(record.ID)
			if err != nil {
				return
			}
			for _, delivery := range deliveries {
				row := []string{strconv.Itoa(record.ID), record.Channel, record.Title, record.Summary, record.Sender, record.Status, delivery.Recipient, delivery.Status, delivery.Error, delivery.MessageID, strconv.Itoa(delivery.Attempts), record.CreatedAt.UTC().Format(time.RFC3339), strconv.FormatBool(record.IsTest)}
				for i, value := range row {
					trimmed := strings.TrimLeftFunc(value, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) || r == '\ufeff' })
					if strings.ContainsAny(value, "\t\r\n") || (len(trimmed) > 0 && strings.ContainsRune("=+-@", rune(trimmed[0]))) {
						row[i] = "'" + value
					}
				}
				if err := writer.Write(row); err != nil {
					return
				}
			}
		}
		writer.Flush()
		if writer.Error() != nil || filter.Page*filter.PageSize >= int(total) || c.Request.Context().Err() != nil {
			return
		}
		filter.Page++
		items, _, err = model.ListNotifications(filter)
		if err != nil {
			return
		}
	}
}

func ListNotificationSaved(c *gin.Context) {
	filter, ok := notificationFilter(c)
	if !ok {
		return
	}
	items, total, err := model.ListNotificationSaved("template", c.GetInt("id"), filter.Page, filter.PageSize, filter.Keyword, "")
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items, "total": total}})
}

func GetNotificationSaved(c *gin.Context) {
	id, ok := notificationID(c)
	if !ok {
		return
	}
	item, err := model.GetNotificationSaved(id, "template", c.GetInt("id"))
	if err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

func SaveNotificationMessage(c *gin.Context) {
	var request struct {
		Name    string                      `json:"name"`
		Message service.NotificationMessage `json:"message"`
	}
	if !notificationBind(c, &request) {
		return
	}
	request.Name = strings.TrimSpace(request.Name)
	if request.Name == "" || utf8.RuneCountInString(request.Name) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "name must contain between 1 and 128 characters"})
		return
	}
	if request.Message.Channel != "email" {
		request.Message.Recipients = nil
	}
	copies := make(map[string]notificationstore.ImageCopy)
	if err := resolveNotificationImages(c, &request.Message, copies); err != nil {
		notificationError(c, err)
		return
	}
	if err := service.PrepareNotificationMessage(&request.Message, 1000, false, copies); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	contentRunes := []rune(strings.Join(strings.Fields(request.Message.Content), " "))
	item := model.NotificationSavedMessage{Kind: "template", Name: request.Name, Channel: request.Message.Channel, Summary: string(contentRunes[:min(len(contentRunes), 200)])}
	if c.Param("id") != "" {
		id, ok := notificationID(c)
		if !ok {
			return
		}
		item.ID = id
	}
	payload, err := common.Marshal(request.Message)
	if err != nil {
		notificationError(c, err)
		return
	}
	if err := model.SaveNotificationMessage(c.Request.Context(), &item, payload, c.GetInt("id"), notificationCanSend(c), copies); err != nil {
		notificationError(c, err)
		return
	}
	for i := range request.Message.Images {
		image := &request.Message.Images[i]
		if source, ok := copies[image.URL]; ok {
			image.URL = source.URL(item.ID)
		}
	}
	payload, err = common.Marshal(request.Message)
	if err != nil {
		notificationError(c, err)
		return
	}
	item.Message = payload
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// Stored images can be reused without returning their base64 bytes to the
// browser. Never fetch a client-supplied URL: resolve an authorized local record
// and require the filename to be present in its immutable manifest.
func resolveNotificationImages(c *gin.Context, message *service.NotificationMessage, copies ...map[string]notificationstore.ImageCopy) error {
	if len(message.Images) > 10 {
		return &service.NotificationValidationError{Err: errors.New("at most 10 images are allowed")}
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()
	manifests := make(map[string]map[string]notificationstore.ImageCopy)
	for i := range message.Images {
		image := &message.Images[i]
		if image.URL == "" {
			continue
		}
		reference, valid := strings.CutPrefix(image.URL, "/api/notification/messages/")
		parts := strings.Split(reference, "/")
		if !valid || len(parts) != 3 || parts[1] != "images" || image.Data != "" {
			return &service.NotificationValidationError{Err: errors.New("invalid notification image reference")}
		}
		id, err := strconv.Atoi(parts[0])
		if err != nil || id <= 0 {
			return &service.NotificationValidationError{Err: errors.New("invalid notification image reference")}
		}
		key, err := model.NotificationImageKey(id, c.GetInt("id"), notificationCanViewAll(c))
		if err != nil {
			return err
		}
		if len(copies) > 0 {
			images, cached := manifests[key]
			if !cached {
				images, err = notificationstore.ResolveImageCopies(ctx, key)
				if err != nil {
					return err
				}
				manifests[key] = images
			}
			source, found := images[parts[2]]
			if !found || !source.Matches(*image) {
				return &service.NotificationValidationError{Err: errors.New("invalid notification image reference")}
			}
			copies[0][image.URL] = source
			continue
		}
		data, contentType, err := notificationstore.Image(ctx, key, parts[2])
		if err != nil {
			return err
		}
		image.Data, image.ContentType, image.URL = base64.StdEncoding.EncodeToString(data), contentType, ""
	}
	return nil
}

func GetNotificationImage(c *gin.Context) {
	id, ok := notificationID(c)
	if !ok {
		return
	}
	key, err := model.NotificationImageKey(id, c.GetInt("id"), notificationCanViewAll(c))
	if err != nil {
		notificationError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Minute)
	defer cancel()
	data, contentType, err := notificationstore.Image(ctx, key, c.Param("image"))
	if err != nil {
		notificationError(c, err)
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(http.StatusOK, contentType, data)
}

func DeleteNotificationSaved(c *gin.Context) {
	id, ok := notificationID(c)
	if !ok {
		return
	}
	if err := model.DeleteNotificationSaved(id, "template", c.GetInt("id"), notificationCanSend(c)); err != nil {
		notificationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
