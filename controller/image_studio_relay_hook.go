package controller

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// imageAutoRecordTimeout bounds the background download+store work so a slow or
// stalled upstream image URL cannot leak a goroutine indefinitely.
const imageAutoRecordTimeout = 60 * time.Second

func init() {
	// Register the relay-side hook so image generations produced through the raw
	// API (not just the Image Studio UI) are persisted into the studio history.
	relay.RegisterImageAutoRecordHook(recordRelayImageGeneration)
}

// recordRelayImageGeneration downloads/decodes the generated images, stores them
// in the configured object storage, and writes an image studio history record.
// It runs in a detached goroutine, so all failures are logged rather than
// surfaced to the (already-completed) client request.
func recordRelayImageGeneration(ctx context.Context, input relay.ImageAutoRecordInput) {
	defer func() {
		if r := recover(); r != nil {
			common.SysLog("panic while auto-recording relay image generation: " + toLogString(r))
		}
	}()

	if len(input.Images) == 0 || !system_setting.GetAuditSetting().ImageStudio {
		return
	}

	// Fail fast when object storage is not configured, before downloading images.
	if _, err := getImageStudioStorage(); err != nil {
		common.SysLog("skip auto-recording relay image generation, storage unavailable: " + err.Error())
		return
	}

	folderName, err := imageStudioUserFolderName(input.UserID)
	if err != nil {
		common.SysLog("failed to resolve image studio folder for auto-record: " + err.Error())
		return
	}

	storeCtx, cancel := context.WithTimeout(ctx, imageAutoRecordTimeout)
	defer cancel()

	createdAt := time.Now().UnixMilli()
	record := &model.ImageStudioGeneration{
		ID:           generateImageAutoRecordID(createdAt),
		UserId:       input.UserID,
		CreatedAt:    createdAt,
		Mode:         input.Mode,
		Prompt:       input.Prompt,
		ModelName:    input.ModelName,
		GroupName:    input.Group,
		Size:         input.Size,
		Quality:      input.Quality,
		Moderation:   input.Moderation,
		OutputFormat: input.OutputFormat,
		N:            input.N,
		DurationMs:   input.DurationMs,
		ChannelId:    input.ChannelId,
		UserAgent:    input.UserAgent,
		Images:       make([]model.ImageStudioAsset, 0, len(input.Images)),
	}

	stored := make([]imageStudioStoredImage, 0, len(input.Images))
	for _, source := range input.Images {
		data, mimeType, err := loadImageStudioSource(storeCtx, strings.TrimSpace(source.Source))
		if err != nil {
			common.SysLog("failed to load relay image source for auto-record: " + err.Error())
			continue
		}
		asset, err := writeImageStudioImage(storeCtx, folderName, data, mimeType)
		if err != nil {
			common.SysLog("failed to store relay image for auto-record: " + err.Error())
			continue
		}
		stored = append(stored, asset)
		record.Images = append(record.Images, model.ImageStudioAsset{
			ID:            asset.ID,
			Path:          asset.ID,
			URL:           asset.URL,
			MimeType:      asset.MimeType,
			SizeBytes:     asset.Size,
			Width:         asset.Width,
			Height:        asset.Height,
			RevisedPrompt: source.RevisedPrompt,
		})
	}

	if len(record.Images) == 0 {
		return
	}

	if !system_setting.GetAuditSetting().ImageStudio {
		deleteImageStudioStoredImages(stored)
		return
	}
	if err := model.CreateImageStudioGeneration(record); err != nil {
		deleteImageStudioStoredImages(stored)
		common.SysLog("failed to persist relay image studio auto-record: " + err.Error())
		return
	}

	// Pass 0 so the model applies the admin-configured storage limit.
	pruned, err := model.PruneUserImageStudioGenerations(input.UserID, 0)
	if err != nil {
		common.SysLog("failed to prune image studio history after auto-record: " + err.Error())
		return
	}
	deleteImageStudioGenerationFiles(pruned)
}

// generateImageAutoRecordID mirrors the Image Studio frontend id scheme
// ("<createdAtMillis>-<random>") so both storage paths produce comparable ids.
func generateImageAutoRecordID(createdAt int64) string {
	raw := make([]byte, 6)
	if _, err := rand.Read(raw); err != nil {
		return strconv.FormatInt(createdAt, 10) + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return strconv.FormatInt(createdAt, 10) + "-" + hex.EncodeToString(raw)
}

func toLogString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	if err, ok := v.(error); ok {
		return err.Error()
	}
	return "unknown error"
}
