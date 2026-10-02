package controller

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

const imageStudioMaxImageBytes int64 = 50 << 20

type imageStudioStoreRequest struct {
	ID           string                  `json:"id"`
	CreatedAt    int64                   `json:"created_at"`
	Mode         string                  `json:"mode"`
	Prompt       string                  `json:"prompt"`
	ModelName    string                  `json:"model"`
	GroupName    string                  `json:"group"`
	Size         string                  `json:"size"`
	Quality      string                  `json:"quality"`
	Moderation   string                  `json:"moderation"`
	OutputFormat string                  `json:"output_format"`
	N            int                     `json:"n"`
	DurationMs   int64                   `json:"duration_ms"`
	Images       []imageStudioStoreImage `json:"images"`
}

type imageStudioStoreImage struct {
	Src           string `json:"src"`
	RevisedPrompt string `json:"revised_prompt"`
}

type imageStudioStoredImage struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
	Width    int    `json:"width,omitempty"`
	Height   int    `json:"height,omitempty"`
}

type imageStudioAppendImageRequest struct {
	Src           string `json:"src"`
	RevisedPrompt string `json:"revised_prompt"`
}

type imageStudioFavoriteRequest struct {
	Favorite bool `json:"favorite"`
}

type imageStudioUsageRequest struct {
	Quota            int `json:"quota"`
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	ChannelId        int `json:"channel_id"`
}

func GetImageStudioSetting(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, gin.H{"history_enabled": system_setting.GetAuditSetting().ImageStudio})
}

func StoreImageStudioImages(c *gin.Context) {
	if !system_setting.GetAuditSetting().ImageStudio {
		common.ApiSuccess(c, gin.H{"persisted": false})
		return
	}
	var req imageStudioStoreRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.ID) == "" {
		common.ApiError(c, errors.New("missing generation id"))
		return
	}
	if len(req.Images) == 0 {
		common.ApiError(c, errors.New("no images to store"))
		return
	}

	userID := c.GetInt("id")
	folderName, err := imageStudioUserFolderName(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	results := make([]imageStudioStoredImage, 0, len(req.Images))
	record := &model.ImageStudioGeneration{
		ID:           req.ID,
		UserId:       userID,
		CreatedAt:    req.CreatedAt,
		Mode:         req.Mode,
		Prompt:       req.Prompt,
		ModelName:    req.ModelName,
		GroupName:    req.GroupName,
		Size:         req.Size,
		Quality:      req.Quality,
		Moderation:   req.Moderation,
		OutputFormat: req.OutputFormat,
		N:            req.N,
		DurationMs:   req.DurationMs,
		ChannelId:    common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		UserAgent:    c.Request.UserAgent(),
		Images:       make([]model.ImageStudioAsset, 0, len(req.Images)),
	}
	for _, image := range req.Images {
		data, mimeType, err := loadImageStudioSource(c.Request.Context(), strings.TrimSpace(image.Src))
		if err != nil {
			deleteImageStudioStoredImages(results)
			common.ApiError(c, err)
			return
		}
		stored, err := writeImageStudioImage(c.Request.Context(), folderName, data, mimeType)
		if err != nil {
			deleteImageStudioStoredImages(results)
			common.ApiError(c, err)
			return
		}
		results = append(results, stored)
		record.Images = append(record.Images, model.ImageStudioAsset{
			ID:            stored.ID,
			Path:          stored.ID,
			URL:           stored.URL,
			MimeType:      stored.MimeType,
			SizeBytes:     stored.Size,
			Width:         stored.Width,
			Height:        stored.Height,
			RevisedPrompt: image.RevisedPrompt,
		})
	}

	// Recheck after downloads so disabling recording also cancels pending saves.
	if !system_setting.GetAuditSetting().ImageStudio {
		deleteImageStudioStoredImages(results)
		common.ApiSuccess(c, gin.H{"persisted": false})
		return
	}
	if err := model.CreateImageStudioGeneration(record); err != nil {
		deleteImageStudioStoredImages(results)
		common.ApiError(c, err)
		return
	}
	// Pass 0 so the model applies the admin-configured storage limit. Only this
	// pruning path permanently removes database records and stored image files.
	pruned, err := model.PruneUserImageStudioGenerations(userID, 0)
	if err != nil {
		common.SysLog("failed to prune image studio history: " + err.Error())
	} else {
		deleteImageStudioGenerationFiles(pruned)
	}

	common.ApiSuccess(c, record)
}

func AppendImageStudioGenerationImage(c *gin.Context) {
	if !system_setting.GetAuditSetting().ImageStudio {
		common.ApiSuccess(c, gin.H{"persisted": false})
		return
	}
	var req imageStudioAppendImageRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, mimeType, err := loadImageStudioSource(c.Request.Context(), strings.TrimSpace(req.Src))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	folderName, err := imageStudioUserFolderName(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	storedImage, err := writeImageStudioImage(c.Request.Context(), folderName, data, mimeType)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	asset := model.ImageStudioAsset{
		ID:            storedImage.ID,
		Path:          storedImage.ID,
		URL:           storedImage.URL,
		MimeType:      storedImage.MimeType,
		SizeBytes:     storedImage.Size,
		Width:         storedImage.Width,
		Height:        storedImage.Height,
		RevisedPrompt: req.RevisedPrompt,
	}
	if !system_setting.GetAuditSetting().ImageStudio {
		deleteImageStudioStoredImages([]imageStudioStoredImage{storedImage})
		common.ApiSuccess(c, gin.H{"persisted": false})
		return
	}
	record, err := model.AppendImageStudioGenerationImage(c.Param("id"), c.GetInt("id"), asset)
	if err != nil {
		deleteImageStudioStoredImages([]imageStudioStoredImage{storedImage})
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, record)
}

func ListImageStudioGenerations(c *gin.Context) {
	// Default limit 0 lets the model apply the admin-configured display limit.
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))
	records, err := model.GetUserImageStudioGenerations(c.GetInt("id"), limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("X-Image-Studio-Display-History-Limit", strconv.Itoa(system_setting.GetImageStudioDisplayHistoryLimit()))
	common.ApiSuccess(c, records)
}

func GetImageStudioImage(c *gin.Context) {
	relPath, err := cleanImageStudioAssetPath(c.Param("path"))
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	asset, err := model.GetImageStudioAsset(relPath)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	storage, err := getImageStudioStorage()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	storedObject, err := storage.Open(c.Request.Context(), asset.Path)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer storedObject.Body.Close()

	contentType := storedObject.ContentType
	if contentType == "" {
		contentType = asset.MimeType
	}
	if contentType != "" {
		c.Header("Content-Type", contentType)
	}
	c.Header("Cache-Control", "private, max-age=31536000, immutable")
	http.ServeContent(c.Writer, c.Request, path.Base(relPath), storedObject.ModTime, storedObject.Body)
}

func UpdateImageStudioGenerationFavorite(c *gin.Context) {
	var req imageStudioFavoriteRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateImageStudioGenerationFavorite(c.Param("id"), c.GetInt("id"), req.Favorite); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func UpdateImageStudioGenerationUsage(c *gin.Context) {
	var req imageStudioUsageRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateImageStudioGenerationUsage(c.Param("id"), c.GetInt("id"), req.Quota, req.PromptTokens, req.CompletionTokens, req.ChannelId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteImageStudioGeneration(c *gin.Context) {
	if err := model.HideImageStudioGeneration(c.Param("id"), c.GetInt("id"), c.GetInt("role") >= common.RoleAdminUser); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ClearImageStudioGenerations(c *gin.Context) {
	if err := model.HideUserImageStudioGenerations(c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteImageStudioImage(c *gin.Context) {
	relPath, err := cleanImageStudioAssetPath(c.Param("path"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canAccessImageStudioAsset(c, relPath) {
		c.Status(http.StatusForbidden)
		return
	}

	storage, err := getImageStudioStorage()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := storage.Delete(c.Request.Context(), relPath); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func loadImageStudioSource(ctx context.Context, src string) ([]byte, string, error) {
	if src == "" {
		return nil, "", errors.New("empty image source")
	}
	if strings.HasPrefix(src, "data:") {
		return decodeImageStudioDataURL(src)
	}
	return downloadImageStudioURL(ctx, src)
}

func decodeImageStudioDataURL(src string) ([]byte, string, error) {
	meta, payload, ok := strings.Cut(src, ",")
	if !ok || !strings.Contains(meta, ";base64") {
		return nil, "", errors.New("invalid image data URL")
	}
	mimeType := strings.TrimPrefix(strings.Split(meta, ";")[0], "data:")
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", errors.New("unsupported image MIME type")
	}
	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > imageStudioMaxImageBytes {
		return nil, "", errors.New("image is too large")
	}
	return data, mimeType, nil
}

func downloadImageStudioURL(ctx context.Context, src string) ([]byte, string, error) {
	parsed, err := url.Parse(src)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, "", errors.New("invalid image URL")
	}
	if err := validateImageStudioRemoteURL(parsed); err != nil {
		return nil, "", err
	}

	client := newImageStudioHTTPClient()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, src, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "new-api-image-studio/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("failed to fetch image: %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, imageStudioMaxImageBytes+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > imageStudioMaxImageBytes {
		return nil, "", errors.New("image is too large")
	}
	mimeType := strings.Split(resp.Header.Get("Content-Type"), ";")[0]
	if !strings.HasPrefix(mimeType, "image/") {
		mimeType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", errors.New("downloaded file is not an image")
	}
	return data, mimeType, nil
}

func newImageStudioHTTPClient() *http.Client {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			ips, err := net.LookupIP(host)
			if err != nil {
				return nil, err
			}
			for _, ip := range ips {
				if isImageStudioForbiddenIP(ip) {
					return nil, errors.New("unsupported image URL host")
				}
			}
			if len(ips) == 0 {
				return nil, errors.New("image URL host did not resolve")
			}
			dialer := &net.Dialer{Timeout: 30 * time.Second}
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
		},
	}
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("stopped after 10 redirects")
			}
			return validateImageStudioRemoteURL(req.URL)
		},
	}
}

func validateImageStudioRemoteURL(parsed *url.URL) error {
	host := parsed.Hostname()
	if host == "" {
		return errors.New("invalid image URL")
	}
	if strings.EqualFold(host, "localhost") {
		return errors.New("unsupported image URL host")
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return err
	}
	if len(ips) == 0 {
		return errors.New("image URL host did not resolve")
	}
	for _, ip := range ips {
		if isImageStudioForbiddenIP(ip) {
			return errors.New("unsupported image URL host")
		}
	}
	return nil
}

func isImageStudioForbiddenIP(ip net.IP) bool {
	return ip.IsLoopback() ||
		ip.IsUnspecified() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast()
}

func writeImageStudioImage(ctx context.Context, folderName string, data []byte, mimeType string) (imageStudioStoredImage, error) {
	name, err := randomImageStudioFileName(mimeType)
	if err != nil {
		return imageStudioStoredImage{}, err
	}
	relPath := path.Join(folderName, name)
	storage, err := getImageStudioStorage()
	if err != nil {
		return imageStudioStoredImage{}, err
	}
	if err := storage.Put(ctx, relPath, data, mimeType); err != nil {
		return imageStudioStoredImage{}, err
	}
	width, height := imageStudioImageDimensions(data)
	return imageStudioStoredImage{
		ID:       relPath,
		URL:      imageStudioAssetURL(relPath),
		MimeType: mimeType,
		Size:     int64(len(data)),
		Width:    width,
		Height:   height,
	}, nil
}

func imageStudioImageDimensions(data []byte) (int, int) {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0
	}
	return config.Width, config.Height
}

func deleteImageStudioGenerationFiles(records []model.ImageStudioGeneration) {
	storage, err := getImageStudioStorage()
	if err != nil {
		common.SysLog("failed to initialize image studio storage: " + err.Error())
		return
	}
	for _, record := range records {
		for _, image := range record.Images {
			if err := storage.Delete(context.Background(), image.Path); err != nil {
				common.SysLog("failed to delete image studio asset: " + err.Error())
			}
		}
	}
}

func deleteImageStudioStoredImages(images []imageStudioStoredImage) {
	storage, err := getImageStudioStorage()
	if err != nil {
		common.SysLog("failed to initialize image studio storage: " + err.Error())
		return
	}
	for _, image := range images {
		if err := storage.Delete(context.Background(), image.ID); err != nil {
			common.SysLog("failed to delete image studio asset: " + err.Error())
		}
	}
}

func imageStudioUserFolderName(userID int) (string, error) {
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return "", err
	}
	parts := []string{strings.TrimSpace(user.Username), strings.TrimSpace(user.DisplayName)}
	folderName := sanitizeImageStudioPathSegment(strings.Join(parts, "_"))
	if folderName == "" {
		folderName = strconv.Itoa(userID)
	}
	return folderName, nil
}

func sanitizeImageStudioPathSegment(value string) string {
	var builder strings.Builder
	previousUnderscore := false
	for _, r := range value {
		allowed := unicode.IsLetter(r) || unicode.IsNumber(r) || r == '-' || r == '_' || r == '.'
		if !allowed {
			if !previousUnderscore && builder.Len() > 0 {
				builder.WriteByte('_')
				previousUnderscore = true
			}
			continue
		}
		builder.WriteRune(r)
		previousUnderscore = r == '_'
	}
	folderName := strings.Trim(builder.String(), "._-")
	runes := []rune(folderName)
	if len(runes) > 80 {
		folderName = string(runes[:80])
		folderName = strings.Trim(folderName, "._-")
	}
	return folderName
}

func imageStudioAssetURL(relPath string) string {
	parts := strings.Split(relPath, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return "/api/image-studio/assets/" + strings.Join(parts, "/")
}

func randomImageStudioFileName(mimeType string) (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw) + imageStudioExtension(mimeType), nil
}

func imageStudioExtension(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
}

func cleanImageStudioAssetPath(rawPath string) (string, error) {
	trimmed := strings.TrimPrefix(rawPath, "/")
	if trimmed == "" {
		return "", errors.New("empty image path")
	}
	for _, segment := range strings.Split(trimmed, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return "", errors.New("invalid image path")
		}
	}
	return path.Clean(trimmed), nil
}

func canAccessImageStudioAsset(c *gin.Context, relPath string) bool {
	parts := strings.Split(relPath, "/")
	if len(parts) == 0 {
		return false
	}
	ownerID, err := strconv.Atoi(parts[0])
	if err != nil {
		return false
	}
	return ownerID == c.GetInt("id") || c.GetInt("role") >= common.RoleAdminUser
}
