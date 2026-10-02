// Package notificationstore stores immutable notification snapshots and their
// binary images in notification/<timestamp>/. Database ownership is enforced by callers.
package notificationstore

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/objectstorage"
	"github.com/google/uuid"
)

const MaxImageBytes = 15 * 1024 * 1024
const maxManifestBytes = 16 * 1024 * 1024
const snapshotTimeLayout = "20060102-150405.000"

type storedImage struct {
	dto.NotificationImage
	ObjectName string `json:"object_name"`
	Size       int64  `json:"size"`
	SHA256     string `json:"sha256"`
}

// ImageCopy is a validated image from an immutable snapshot. Callers must
// authorize the source record before resolving its manifest.
type ImageCopy struct {
	key        string
	image      storedImage
	objectName string
}

func (source ImageCopy) Matches(image dto.NotificationImage) bool {
	return source.key != "" && image.URL != "" && image.Data == "" && image.ContentType == source.image.ContentType
}

func (source ImageCopy) URL(recordID int) string {
	return fmt.Sprintf("/api/notification/messages/%d/images/%s", recordID, source.objectName)
}

// ResolveImageCopies reads one manifest for all images in a source snapshot;
// image bytes stay in object storage.
func ResolveImageCopies(ctx context.Context, key string) (map[string]ImageCopy, error) {
	storage, err := objectstorage.FromEnv()
	if err != nil {
		return nil, err
	}
	_, images, err := readManifest(ctx, storage, key)
	if err != nil {
		return nil, err
	}
	copies := make(map[string]ImageCopy, len(images))
	for _, image := range images {
		copies[image.ObjectName] = ImageCopy{key: key, image: image, objectName: uuid.NewString() + path.Ext(image.ObjectName)}
	}
	return copies, nil
}

// Use the server's local timezone (TZ=Asia/Shanghai in docker-compose). The
// timestamp records submission/save time, before uploading or contacting a
// provider. All recipients of a notification share this single snapshot.
func NewKey() string {
	return "notification/" + time.Now().Format(snapshotTimeLayout) + "/message.json"
}

func validKey(key string) bool {
	parts := strings.Split(key, "/")
	if len(parts) != 3 || parts[0] != "notification" || parts[2] != "message.json" {
		return false
	}
	directory := parts[1]
	if timestamp, err := time.Parse(snapshotTimeLayout, directory); err == nil && timestamp.Format(snapshotTimeLayout) == directory {
		return true
	}
	if timestamp, suffix, found := strings.Cut(directory, "_"); found {
		parsed, err := time.Parse(snapshotTimeLayout, timestamp)
		if err != nil || parsed.Format(snapshotTimeLayout) != timestamp {
			return false
		}
		directory = suffix
	}
	// Existing S3 snapshots keep their stored UUID directory so they remain
	// readable and deletable without moving objects or changing database rows.
	id, err := uuid.Parse(directory)
	return err == nil && id.String() == directory
}

// Write uploads images first and publishes the manifest last. The caller must
// durably register key before this call so interrupted uploads can be collected.
func Write(ctx context.Context, key string, payload []byte, copies ...map[string]ImageCopy) error {
	if !validKey(key) {
		return errors.New("invalid notification storage key")
	}
	var message map[string]json.RawMessage
	if err := common.Unmarshal(payload, &message); err != nil {
		return err
	}
	if message == nil {
		return errors.New("invalid notification message")
	}
	var images []dto.NotificationImage
	if err := common.Unmarshal(message["images"], &images); err != nil {
		return err
	}
	if len(images) > 10 {
		return errors.New("too many notification images")
	}
	storage, err := objectstorage.FromEnv()
	if err != nil {
		return err
	}
	stored := make([]storedImage, 0, len(images))
	for _, image := range images {
		if image.URL != "" && len(copies) > 0 {
			source, ok := copies[0][image.URL]
			if !ok || !source.Matches(image) {
				return errors.New("invalid notification image reference")
			}
			name := source.objectName
			if err := storage.Copy(ctx, path.Dir(source.key)+"/"+source.image.ObjectName, path.Dir(key)+"/"+name); err != nil {
				return err
			}
			image.URL = ""
			stored = append(stored, storedImage{NotificationImage: image, ObjectName: name, Size: source.image.Size, SHA256: source.image.SHA256})
			continue
		}
		if image.URL != "" || len(image.Data) > base64.StdEncoding.EncodedLen(MaxImageBytes) {
			return errors.New("invalid notification image data")
		}
		data, err := base64.StdEncoding.Strict().DecodeString(image.Data)
		if err != nil || len(data) == 0 || len(data) > MaxImageBytes {
			return errors.New("invalid notification image data")
		}
		extension := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}[image.ContentType]
		if extension == "" || http.DetectContentType(data) != image.ContentType {
			return errors.New("invalid notification image type")
		}
		name := uuid.NewString() + extension
		if err := storage.Put(ctx, path.Dir(key)+"/"+name, data, image.ContentType); err != nil {
			return err
		}
		digest := sha256.Sum256(data)
		image.Data = ""
		stored = append(stored, storedImage{NotificationImage: image, ObjectName: name, Size: int64(len(data)), SHA256: hex.EncodeToString(digest[:])})
	}
	message["images"], err = common.Marshal(stored)
	if err != nil {
		return err
	}
	manifest, err := common.Marshal(message)
	if err != nil {
		return err
	}
	if len(manifest) > maxManifestBytes {
		return errors.New("notification manifest is too large")
	}
	return storage.Put(ctx, key, manifest, "application/json")
}

func readManifest(ctx context.Context, storage *objectstorage.Storage, key string) (map[string]json.RawMessage, []storedImage, error) {
	if !validKey(key) {
		return nil, nil, errors.New("invalid notification storage key")
	}
	object, err := storage.Open(ctx, key)
	if err != nil {
		return nil, nil, err
	}
	defer object.Body.Close()
	data, err := io.ReadAll(io.LimitReader(object.Body, maxManifestBytes+1))
	if err != nil {
		return nil, nil, err
	}
	if len(data) > maxManifestBytes {
		return nil, nil, errors.New("notification manifest is too large")
	}
	var message map[string]json.RawMessage
	if err := common.Unmarshal(data, &message); err != nil {
		return nil, nil, err
	}
	var images []storedImage
	if err := common.Unmarshal(message["images"], &images); err != nil {
		return nil, nil, err
	}
	if len(images) > 10 {
		return nil, nil, errors.New("too many notification images")
	}
	for _, image := range images {
		extension := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}[image.ContentType]
		id, err := uuid.Parse(strings.TrimSuffix(image.ObjectName, extension))
		if err != nil || extension == "" || id.String()+extension != image.ObjectName || image.Size <= 0 || image.Size > MaxImageBytes || len(image.SHA256) != 64 {
			return nil, nil, errors.New("invalid stored notification image")
		}
	}
	return message, images, nil
}

func readImage(ctx context.Context, storage *objectstorage.Storage, key string, image storedImage) ([]byte, error) {
	object, err := storage.Open(ctx, path.Dir(key)+"/"+image.ObjectName)
	if err != nil {
		return nil, err
	}
	defer object.Body.Close()
	data, err := io.ReadAll(io.LimitReader(object.Body, image.Size+1))
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	if int64(len(data)) != image.Size || hex.EncodeToString(digest[:]) != image.SHA256 {
		return nil, errors.New("notification image integrity check failed")
	}
	return data, nil
}

// Read returns the existing message contract. Delivery needs base64 data;
// browser previews receive authenticated image URLs and no embedded image bytes.
func Read(ctx context.Context, key string, recordID int, hydrate bool) ([]byte, error) {
	storage, err := objectstorage.FromEnv()
	if err != nil {
		return nil, err
	}
	message, stored, err := readManifest(ctx, storage, key)
	if err != nil {
		return nil, err
	}
	images := make([]dto.NotificationImage, 0, len(stored))
	for _, image := range stored {
		attachment := image.NotificationImage
		attachment.Data, attachment.URL = "", ""
		if hydrate {
			data, err := readImage(ctx, storage, key, image)
			if err != nil {
				return nil, err
			}
			attachment.Data = base64.StdEncoding.EncodeToString(data)
		} else {
			attachment.URL = fmt.Sprintf("/api/notification/messages/%d/images/%s", recordID, image.ObjectName)
		}
		images = append(images, attachment)
	}
	message["images"], err = common.Marshal(images)
	if err != nil {
		return nil, err
	}
	return common.Marshal(message)
}

// Image accepts only a filename present in this notification's manifest.
func Image(ctx context.Context, key, name string) ([]byte, string, error) {
	storage, err := objectstorage.FromEnv()
	if err != nil {
		return nil, "", err
	}
	_, images, err := readManifest(ctx, storage, key)
	if err != nil {
		return nil, "", err
	}
	for _, image := range images {
		if image.ObjectName != name {
			continue
		}
		data, err := readImage(ctx, storage, key, image)
		return data, image.ContentType, err
	}
	return nil, "", errors.New("notification image not found")
}

func Delete(ctx context.Context, key string) error {
	if !validKey(key) {
		return errors.New("invalid notification storage key")
	}
	storage, err := objectstorage.FromEnv()
	if err != nil {
		return err
	}
	return storage.DeletePrefix(ctx, path.Dir(key)+"/")
}
