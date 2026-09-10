package controller

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/mail"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	_ "golang.org/x/image/webp"
)

const (
	companyNotificationMaxImages       = 5
	companyNotificationMaxImageBytes   = 5 * 1024 * 1024
	companyNotificationMaxBodyBytes    = 26 * 1024 * 1024
	companyNotificationMaxTitleRunes   = 200
	companyNotificationMaxTextRunes    = 5000
	companyNotificationMaxTestUsers    = 20
	companyNotificationMaxImagePixels  = 40_000_000
	companyNotificationMultipartMemory = 1024 * 1024
)

var companyNotificationImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

func SendCompanyNotification(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, companyNotificationMaxBodyBytes)
	if err := c.Request.ParseMultipartForm(companyNotificationMultipartMemory); err != nil {
		common.ApiErrorMsg(c, "通知请求过大或格式无效")
		return
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}

	title := strings.TrimSpace(c.PostForm("title"))
	content := strings.TrimSpace(c.PostForm("content"))
	if title == "" || len([]rune(title)) > companyNotificationMaxTitleRunes {
		common.ApiErrorMsg(c, "通知标题不能为空且不能超过 200 个字符")
		return
	}
	if content == "" || len([]rune(content)) > companyNotificationMaxTextRunes {
		common.ApiErrorMsg(c, "通知内容不能为空且不能超过 5000 个字符")
		return
	}

	sendPlatform, err := parseRequiredNotificationBool(c, "send_platform")
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	sendEmail, err := parseRequiredNotificationBool(c, "send_email")
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	testMode, err := parseRequiredNotificationBool(c, "test_mode")
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if !sendPlatform && !sendEmail {
		common.ApiErrorMsg(c, "请至少选择一种通知渠道")
		return
	}
	companyID := 0
	var company *model.Company
	if sendPlatform {
		companyID, err = strconv.Atoi(c.PostForm("company_id"))
		if err != nil || companyID <= 0 {
			common.ApiErrorMsg(c, "无效的公司 ID")
			return
		}
		company, err = model.GetEnabledCompanyByID(companyID)
		if err != nil {
			common.ApiErrorMsg(c, "公司不存在或未启用")
			return
		}
		if err := validateCompanyNotificationPlatform(company); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}

	testPlatformIDs, err := parseNotificationStringList(c.PostForm("test_platform_ids"))
	if err != nil {
		common.ApiErrorMsg(c, "测试平台账号格式无效")
		return
	}
	testEmails, err := parseNotificationStringList(c.PostForm("test_emails"))
	if err != nil {
		common.ApiErrorMsg(c, "测试邮箱格式无效")
		return
	}
	if testMode {
		if sendPlatform && len(testPlatformIDs) == 0 {
			common.ApiErrorMsg(c, "测试发送需要至少一个平台账号 ID")
			return
		}
		if sendEmail && len(testEmails) == 0 {
			common.ApiErrorMsg(c, "测试发送需要至少一个邮箱地址")
			return
		}
		if len(testPlatformIDs) > companyNotificationMaxTestUsers || len(testEmails) > companyNotificationMaxTestUsers {
			common.ApiErrorMsg(c, "每种测试收件人最多 20 个")
			return
		}
		if err := validateNotificationPlatformIDs(testPlatformIDs); err != nil {
			common.ApiErrorMsg(c, "测试平台账号格式无效")
			return
		}
		for _, address := range testEmails {
			parsed, err := mail.ParseAddress(address)
			if err != nil || parsed.Address != address {
				common.ApiErrorMsg(c, "测试邮箱地址无效")
				return
			}
		}
	}

	images, err := readCompanyNotificationImages(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	result, err := service.SendCompanyNotification(service.CompanyNotificationRequest{
		Company:         company,
		Title:           title,
		Content:         content,
		SendPlatform:    sendPlatform,
		SendEmail:       sendEmail,
		TestMode:        testMode,
		TestPlatformIDs: testPlatformIDs,
		TestEmails:      testEmails,
		Images:          images,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.SysLog(fmt.Sprintf(
		"company notification completed company_id=%d test_mode=%t platform=%t email=%t total=%d success=%d failed=%d skipped=%d",
		companyID, testMode, sendPlatform, sendEmail, result.Total, result.Success, result.Failed, result.Skipped,
	))
	common.ApiSuccess(c, result)
}

func parseRequiredNotificationBool(c *gin.Context, field string) (bool, error) {
	value, exists := c.GetPostForm(field)
	if !exists || (value != "true" && value != "false") {
		return false, fmt.Errorf("字段 %s 必须为 true 或 false", field)
	}
	return value == "true", nil
}

func validateCompanyNotificationPlatform(company *model.Company) error {
	config, err := company.GetConfig()
	if err != nil {
		return err
	}
	switch company.Platform {
	case model.CompanyPlatformFeishu:
		if config.Feishu.AppID == "" || config.Feishu.AppSecret == "" {
			return fmt.Errorf("飞书应用凭据未完整配置")
		}
	case model.CompanyPlatformDingTalk:
		if config.DingTalk.ClientID == "" || config.DingTalk.ClientSecret == "" || config.DingTalk.AgentID <= 0 {
			return fmt.Errorf("钉钉 Client ID、Client Secret 和 Agent ID 未完整配置")
		}
	default:
		return fmt.Errorf("所选公司未配置可发送通知的平台")
	}
	return nil
}

func parseNotificationStringList(value string) ([]string, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	var values []string
	if err := common.UnmarshalJsonStr(value, &values); err != nil {
		return nil, err
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, item := range values {
		item = strings.TrimSpace(item)
		if item == "" || strings.ContainsAny(item, "\r\n") {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result, nil
}

func validateNotificationPlatformIDs(identifiers []string) error {
	for _, identifier := range identifiers {
		if len(identifier) > 128 || strings.ContainsAny(identifier, ",; \t") {
			return fmt.Errorf("invalid platform recipient identifier")
		}
	}
	return nil
}

func readCompanyNotificationImages(c *gin.Context) ([]service.CompanyNotificationImage, error) {
	if c.Request.MultipartForm == nil || c.Request.MultipartForm.File == nil {
		return nil, nil
	}
	files := c.Request.MultipartForm.File["images"]
	if len(files) > companyNotificationMaxImages {
		return nil, fmt.Errorf("每条通知最多添加 5 张图片")
	}
	images := make([]service.CompanyNotificationImage, 0, len(files))
	for index, fileHeader := range files {
		if fileHeader.Size <= 0 || fileHeader.Size > companyNotificationMaxImageBytes {
			return nil, fmt.Errorf("每张图片大小必须在 5 MiB 以内")
		}
		file, err := fileHeader.Open()
		if err != nil {
			return nil, fmt.Errorf("无法读取图片")
		}
		data, readErr := io.ReadAll(io.LimitReader(file, companyNotificationMaxImageBytes+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil || len(data) == 0 || len(data) > companyNotificationMaxImageBytes {
			return nil, fmt.Errorf("无法读取图片或图片过大")
		}
		contentType := http.DetectContentType(data)
		extension, allowed := companyNotificationImageTypes[contentType]
		if !allowed {
			return nil, fmt.Errorf("仅支持 JPEG、PNG、GIF 和 WebP 图片")
		}
		imageConfig, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || imageConfig.Width <= 0 || imageConfig.Height <= 0 || imageConfig.Width > companyNotificationMaxImagePixels/imageConfig.Height {
			return nil, fmt.Errorf("图片内容无效或像素尺寸过大")
		}
		baseName := strings.TrimSuffix(strings.TrimSpace(filepath.Base(fileHeader.Filename)), filepath.Ext(fileHeader.Filename))
		baseName = strings.Map(func(r rune) rune {
			if r < 32 || r == 127 || strings.ContainsRune(`<>:"/\\|?*`, r) {
				return -1
			}
			return r
		}, baseName)
		if baseName == "" || baseName == "." {
			baseName = fmt.Sprintf("image-%d", index+1)
		}
		nameRunes := []rune(baseName)
		if len(nameRunes) > 80 {
			baseName = string(nameRunes[:80])
		}
		images = append(images, service.CompanyNotificationImage{
			Filename:    baseName + extension,
			ContentType: contentType,
			Data:        data,
		})
	}
	return images, nil
}
