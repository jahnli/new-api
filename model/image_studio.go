package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
)

// ImageStudioHistoryLimit 是在线生图历史每用户默认展示条数的兼容常量。
const ImageStudioHistoryLimit = system_setting.DefaultImageStudioDisplayHistoryLimit

type ImageStudioGeneration struct {
	ID               string             `json:"id" gorm:"type:varchar(64);primaryKey"`
	UserId           int                `json:"user_id" gorm:"index"`
	CreatedAt        int64              `json:"created_at" gorm:"index"`
	UpdatedAt        int64              `json:"updated_at"`
	Mode             string             `json:"mode" gorm:"type:varchar(20);index"`
	Prompt           string             `json:"prompt" gorm:"type:text"`
	ModelName        string             `json:"model" gorm:"type:varchar(191);column:model_name;index"`
	GroupName        string             `json:"group" gorm:"type:varchar(100);column:group_name;index"`
	Size             string             `json:"size" gorm:"type:varchar(50)"`
	Quality          string             `json:"quality,omitempty" gorm:"type:varchar(50)"`
	Moderation       string             `json:"moderation,omitempty" gorm:"type:varchar(50)"`
	OutputFormat     string             `json:"output_format,omitempty" gorm:"type:varchar(20)"`
	N                int                `json:"n"`
	DurationMs       int64              `json:"duration_ms"`
	Quota            int                `json:"quota,omitempty"`
	PromptTokens     int                `json:"prompt_tokens,omitempty"`
	CompletionTokens int                `json:"completion_tokens,omitempty"`
	UserAgent        string             `json:"user_agent,omitempty" gorm:"type:varchar(512)"`
	ChannelId        int                `json:"channel_id,omitempty" gorm:"index"`
	Favorite         bool               `json:"favorite" gorm:"index"`
	HiddenFromStudio bool               `json:"-" gorm:"index"`
	ImagesText       string             `json:"-" gorm:"type:text;column:images"`
	Images           []ImageStudioAsset `json:"images" gorm:"-"`
}

type ImageStudioAsset struct {
	ID            string `json:"id"`
	Path          string `json:"path,omitempty"`
	URL           string `json:"url"`
	MimeType      string `json:"mime_type"`
	SizeBytes     int64  `json:"size_bytes"`
	Width         int    `json:"width,omitempty"`
	Height        int    `json:"height,omitempty"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

func GetImageStudioAsset(id string) (*ImageStudioAsset, error) {
	var records []ImageStudioGeneration
	if err := DB.Where("images LIKE ?", "%"+id+"%").Find(&records).Error; err != nil {
		return nil, err
	}
	for i := range records {
		if err := loadImageStudioGenerationImages(&records[i]); err != nil {
			return nil, err
		}
		for j := range records[i].Images {
			asset := records[i].Images[j]
			if asset.ID == id || asset.Path == id {
				return &asset, nil
			}
		}
	}
	return nil, errors.New("image studio asset not found")
}

func CreateImageStudioGeneration(record *ImageStudioGeneration) error {
	now := time.Now().UnixMilli()
	if record.CreatedAt == 0 {
		record.CreatedAt = now
	}
	record.UpdatedAt = now
	if err := saveImageStudioGenerationImages(record); err != nil {
		return err
	}
	return DB.Create(record).Error
}

func AppendImageStudioGenerationImage(id string, userID int, asset ImageStudioAsset) (*ImageStudioGeneration, error) {
	var updatedRecord ImageStudioGeneration
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", id, userID).First(&updatedRecord).Error; err != nil {
			return err
		}
		if err := loadImageStudioGenerationImages(&updatedRecord); err != nil {
			return err
		}
		if len(updatedRecord.Images) >= updatedRecord.N {
			return errors.New("generation already contains all requested images")
		}
		updatedRecord.Images = append(updatedRecord.Images, asset)
		if err := saveImageStudioGenerationImages(&updatedRecord); err != nil {
			return err
		}
		updatedRecord.UpdatedAt = time.Now().UnixMilli()
		return tx.Model(&ImageStudioGeneration{}).
			Where("id = ? AND user_id = ?", id, userID).
			Updates(map[string]any{
				"images":     updatedRecord.ImagesText,
				"updated_at": updatedRecord.UpdatedAt,
			}).Error
	})
	if err != nil {
		return nil, err
	}
	return &updatedRecord, nil
}

func GetUserImageStudioGenerations(userID int, limit int) ([]ImageStudioGeneration, error) {
	maxLimit := system_setting.GetImageStudioDisplayHistoryLimit()
	if limit <= 0 || limit > maxLimit {
		limit = maxLimit
	}
	var records []ImageStudioGeneration
	if err := DB.Where("user_id = ?", userID).
		Where("hidden_from_studio = ? OR hidden_from_studio IS NULL", false).
		Order("created_at DESC").Limit(limit).Find(&records).Error; err != nil {
		return nil, err
	}
	return records, loadImageStudioGenerationListImages(records)
}

func GetImageStudioGeneration(id string, userID int, isAdmin bool) (*ImageStudioGeneration, error) {
	var record ImageStudioGeneration
	query := DB.Where("id = ?", id)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.First(&record).Error; err != nil {
		return nil, err
	}
	return &record, loadImageStudioGenerationImages(&record)
}

func HideImageStudioGeneration(id string, userID int, isAdmin bool) error {
	query := DB.Model(&ImageStudioGeneration{}).Where("id = ?", id)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	result := query.Updates(map[string]any{
		"hidden_from_studio": true,
		"updated_at":         time.Now().UnixMilli(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("generation not found")
	}
	return nil
}

// DeleteImageStudioAuditGeneration keeps the asset paths available for retry if
// object cleanup fails. The row lock serializes deletion with image appends.
func DeleteImageStudioAuditGeneration(id string, deleteAssets func(*ImageStudioGeneration) error) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var record ImageStudioGeneration
		if err := lockForUpdate(tx).Where("id = ?", id).First(&record).Error; err != nil {
			return err
		}
		if err := loadImageStudioGenerationImages(&record); err != nil {
			return err
		}
		if err := deleteAssets(&record); err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&ImageStudioGeneration{}).Error
	})
}

func HideUserImageStudioGenerations(userID int) error {
	return DB.Model(&ImageStudioGeneration{}).Where("user_id = ?", userID).Updates(map[string]any{
		"hidden_from_studio": true,
		"updated_at":         time.Now().UnixMilli(),
	}).Error
}

func PruneUserImageStudioGenerations(userID int, limit int) ([]ImageStudioGeneration, error) {
	if limit <= 0 {
		limit = system_setting.GetImageStudioMaxHistory()
	}
	var records []ImageStudioGeneration
	if err := DB.Where("user_id = ?", userID).Order("created_at DESC").Offset(limit).Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return records, nil
	}
	if err := loadImageStudioGenerationListImages(records); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(records))
	for _, record := range records {
		ids = append(ids, record.ID)
	}
	return records, DB.Where("id IN ?", ids).Delete(&ImageStudioGeneration{}).Error
}

func UpdateImageStudioGenerationFavorite(id string, userID int, favorite bool) error {
	res := DB.Model(&ImageStudioGeneration{}).Where("id = ? AND user_id = ?", id, userID).Updates(map[string]any{
		"favorite":   favorite,
		"updated_at": time.Now().UnixMilli(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("generation not found")
	}
	return nil
}

func UpdateImageStudioGenerationUsage(id string, userID int, quota int, promptTokens int, completionTokens int, channelID int) error {
	updates := map[string]any{
		"quota":             quota,
		"prompt_tokens":     promptTokens,
		"completion_tokens": completionTokens,
		"updated_at":        time.Now().UnixMilli(),
	}
	if channelID > 0 {
		updates["channel_id"] = channelID
	}
	return DB.Model(&ImageStudioGeneration{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates).Error
}

func saveImageStudioGenerationImages(record *ImageStudioGeneration) error {
	for i := range record.Images {
		if record.Images[i].Path == "" {
			record.Images[i].Path = record.Images[i].ID
		}
	}
	data, err := common.Marshal(record.Images)
	if err != nil {
		return err
	}
	record.ImagesText = string(data)
	return nil
}

func loadImageStudioGenerationListImages(records []ImageStudioGeneration) error {
	for i := range records {
		if err := loadImageStudioGenerationImages(&records[i]); err != nil {
			return err
		}
	}
	return nil
}

func loadImageStudioGenerationImages(record *ImageStudioGeneration) error {
	if record.ImagesText == "" {
		record.Images = []ImageStudioAsset{}
		return nil
	}
	var images []ImageStudioAsset
	if err := common.UnmarshalJsonStr(record.ImagesText, &images); err != nil {
		return err
	}
	for i := range images {
		if images[i].Path == "" {
			images[i].Path = images[i].ID
		}
	}
	record.Images = images
	return nil
}

// ImageStudioAuditItem 安全审计视图:生成记录附带用户展示信息。
type ImageStudioAuditItem struct {
	ImageStudioGeneration
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarUrl   string `json:"avatar_url"`
	ChannelName string `json:"channel_name,omitempty"`
}

// GetImageStudioAuditGenerations 分页查询 [startTs, endTs](Unix 秒,含端)内全部用户的
// 图片生成记录,keyword 对 username/display_name 模糊匹配。created_at 以毫秒存储,
// 调用方需保证 endTs 已钳制在当前时间附近,避免毫秒换算溢出。
func GetImageStudioAuditGenerations(startTs, endTs int64, keyword string, startIdx int, num int) ([]ImageStudioAuditItem, int64, error) {
	query := DB.Model(&ImageStudioGeneration{}).
		Where("created_at >= ? AND created_at < ?", startTs*1000, (endTs+1)*1000)
	trimmedKeyword := strings.TrimSpace(keyword)
	if trimmedKeyword != "" {
		likeKeyword := "%" + trimmedKeyword + "%"
		var matchedUserIds []int
		if err := DB.Table("users").
			Where("username LIKE ? OR display_name LIKE ?", likeKeyword, likeKeyword).
			Pluck("id", &matchedUserIds).Error; err != nil {
			return nil, 0, err
		}
		if len(matchedUserIds) == 0 {
			return []ImageStudioAuditItem{}, 0, nil
		}
		query = query.Where("user_id IN ?", matchedUserIds)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []ImageStudioGeneration
	if err := query.Order("created_at DESC").Offset(startIdx).Limit(num).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	if err := loadImageStudioGenerationListImages(records); err != nil {
		return nil, 0, err
	}

	items := make([]ImageStudioAuditItem, len(records))
	userIdSet := make(map[int]struct{}, len(records))
	channelIdSet := make(map[int]struct{}, len(records))
	for i := range records {
		items[i] = ImageStudioAuditItem{ImageStudioGeneration: records[i]}
		userIdSet[records[i].UserId] = struct{}{}
		if records[i].ChannelId > 0 {
			channelIdSet[records[i].ChannelId] = struct{}{}
		}
	}
	if len(channelIdSet) > 0 {
		channelIds := make([]int, 0, len(channelIdSet))
		for channelId := range channelIdSet {
			channelIds = append(channelIds, channelId)
		}
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
			return nil, 0, err
		}
		channelNameMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelNameMap[channel.Id] = channel.Name
		}
		for i := range items {
			items[i].ChannelName = channelNameMap[items[i].ChannelId]
		}
	}
	if len(userIdSet) == 0 {
		return items, total, nil
	}

	userIds := make([]int, 0, len(userIdSet))
	for id := range userIdSet {
		userIds = append(userIds, id)
	}
	// 生成记录在主库,但仍按 ID 回填而非 JOIN,与 off_hours 审计保持同一套用户信息口径
	var infos []struct {
		Id          int    `gorm:"column:id"`
		Username    string `gorm:"column:username"`
		DisplayName string `gorm:"column:display_name"`
		AvatarUrl   string `gorm:"column:avatar_url"`
	}
	if err := DB.Table("users").Select("id, username, display_name, avatar_url").Where("id IN ?", userIds).Find(&infos).Error; err != nil {
		return nil, 0, err
	}
	infoMap := make(map[int]struct {
		Username    string
		DisplayName string
		AvatarUrl   string
	}, len(infos))
	for _, info := range infos {
		infoMap[info.Id] = struct {
			Username    string
			DisplayName string
			AvatarUrl   string
		}{info.Username, info.DisplayName, info.AvatarUrl}
	}
	for i := range items {
		if info, ok := infoMap[items[i].UserId]; ok {
			items[i].Username = info.Username
			items[i].DisplayName = info.DisplayName
			items[i].AvatarUrl = info.AvatarUrl
		}
	}
	return items, total, nil
}
