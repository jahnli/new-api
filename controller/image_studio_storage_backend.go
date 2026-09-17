package controller

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const (
	imageStudioObjectPrefix = "image"

	imageStudioStorageDSNEnv = "IMAGE_STUDIO_S3_DSN"
)

type imageStudioReadSeekCloser interface {
	io.Reader
	io.Seeker
	io.Closer
}

type imageStudioStoredObject struct {
	Body        imageStudioReadSeekCloser
	ContentType string
	ModTime     time.Time
}

type imageStudioS3Storage struct {
	client *minio.Client
	bucket string
}

func (storage imageStudioS3Storage) Put(ctx context.Context, objectName string, data []byte, contentType string) error {
	_, err := storage.client.PutObject(ctx, storage.bucket, storage.objectName(objectName), bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

func (storage imageStudioS3Storage) Open(ctx context.Context, objectName string) (*imageStudioStoredObject, error) {
	object, err := storage.client.GetObject(ctx, storage.bucket, storage.objectName(objectName), minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	info, err := object.Stat()
	if err != nil {
		_ = object.Close()
		return nil, err
	}
	return &imageStudioStoredObject{
		Body:        object,
		ContentType: info.ContentType,
		ModTime:     info.LastModified,
	}, nil
}

func (storage imageStudioS3Storage) Delete(ctx context.Context, objectName string) error {
	return storage.client.RemoveObject(ctx, storage.bucket, storage.objectName(objectName), minio.RemoveObjectOptions{})
}

func (storage imageStudioS3Storage) objectName(objectName string) string {
	return path.Join(imageStudioObjectPrefix, objectName)
}

var (
	imageStudioStorageOnce    sync.Once
	imageStudioStorage        *imageStudioS3Storage
	imageStudioStorageInitErr error
)

func getImageStudioStorage() (*imageStudioS3Storage, error) {
	imageStudioStorageOnce.Do(func() {
		imageStudioStorage, imageStudioStorageInitErr = newImageStudioS3Storage()
	})
	return imageStudioStorage, imageStudioStorageInitErr
}

func newImageStudioS3Storage() (*imageStudioS3Storage, error) {
	dsn := strings.TrimSpace(os.Getenv(imageStudioStorageDSNEnv))
	if dsn == "" {
		return nil, errors.New("missing image studio S3-compatible storage DSN")
	}

	parsed, err := url.Parse(dsn)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("invalid image studio S3-compatible storage DSN")
	}
	if parsed.User == nil {
		return nil, errors.New("image studio S3-compatible storage DSN must include access key, secret key, and bucket")
	}
	accessKey := parsed.User.Username()
	secretKey, hasSecretKey := parsed.User.Password()
	bucket := strings.TrimPrefix(parsed.Path, "/")
	if accessKey == "" || !hasSecretKey || secretKey == "" || bucket == "" || strings.Contains(bucket, "/") {
		return nil, errors.New("image studio S3-compatible storage DSN must include access key, secret key, and bucket")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("image studio S3-compatible storage DSN must not contain a query or fragment")
	}

	client, err := minio.New(parsed.Host, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: parsed.Scheme == "https",
	})
	if err != nil {
		return nil, err
	}
	return &imageStudioS3Storage{
		client: client,
		bucket: bucket,
	}, nil
}
