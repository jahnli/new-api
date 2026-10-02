// Package objectstorage provides the shared S3-compatible media backend.
package objectstorage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const DSNEnv = "IMAGE_STUDIO_S3_DSN"

var ErrNotConfigured = errors.New("missing IMAGE_STUDIO_S3_DSN for media storage")

var storageCache struct {
	sync.Mutex
	dsn     string
	storage *Storage
}

type ReadSeekCloser interface {
	io.Reader
	io.Seeker
	io.Closer
}

type Object struct {
	Body        ReadSeekCloser
	ContentType string
	ModTime     time.Time
}

type Storage struct {
	Client *minio.Client
	Bucket string
}

// FromEnv deliberately does not cache initialization errors: configuration can
// become available later without poisoning every subsequent notification.
func FromEnv() (*Storage, error) {
	dsn := strings.TrimSpace(os.Getenv(DSNEnv))
	if dsn == "" {
		return nil, ErrNotConfigured
	}
	storageCache.Lock()
	defer storageCache.Unlock()
	if storageCache.storage != nil && storageCache.dsn == dsn {
		return storageCache.storage, nil
	}
	parsed, err := url.Parse(dsn)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("invalid S3-compatible storage DSN")
	}
	if parsed.User == nil {
		return nil, errors.New("S3-compatible storage DSN must include access key, secret key, and bucket")
	}
	accessKey := parsed.User.Username()
	secretKey, hasSecretKey := parsed.User.Password()
	bucket := strings.TrimPrefix(parsed.Path, "/")
	if accessKey == "" || !hasSecretKey || secretKey == "" || bucket == "" || strings.Contains(bucket, "/") {
		return nil, errors.New("S3-compatible storage DSN must include access key, secret key, and bucket")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("S3-compatible storage DSN must not contain a query or fragment")
	}
	client, err := minio.New(parsed.Host, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: parsed.Scheme == "https",
	})
	if err != nil {
		return nil, errors.New("cannot initialize S3-compatible storage")
	}
	storageCache.dsn = dsn
	storageCache.storage = &Storage{Client: client, Bucket: bucket}
	return storageCache.storage, nil
}

func (storage *Storage) Put(ctx context.Context, key string, data []byte, contentType string) error {
	_, err := storage.Client.PutObject(ctx, storage.Bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{ContentType: contentType})
	return err
}

// Copy keeps image bytes inside the bucket while creating an independent
// object that can outlive cleanup of the source snapshot.
func (storage *Storage) Copy(ctx context.Context, sourceKey, key string) error {
	_, err := storage.Client.CopyObject(ctx,
		minio.CopyDestOptions{Bucket: storage.Bucket, Object: key},
		minio.CopySrcOptions{Bucket: storage.Bucket, Object: sourceKey},
	)
	return err
}

func (storage *Storage) Open(ctx context.Context, key string) (*Object, error) {
	object, err := storage.Client.GetObject(ctx, storage.Bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	info, err := object.Stat()
	if err != nil {
		_ = object.Close()
		return nil, err
	}
	return &Object{Body: object, ContentType: info.ContentType, ModTime: info.LastModified}, nil
}

func (storage *Storage) Delete(ctx context.Context, key string) error {
	return storage.Client.RemoveObject(ctx, storage.Bucket, key, minio.RemoveObjectOptions{})
}

// DeletePrefix is reserved for application-owned, validated directories.
func (storage *Storage) DeletePrefix(ctx context.Context, prefix string) error {
	listCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	for object := range storage.Client.ListObjects(listCtx, storage.Bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true}) {
		if object.Err != nil {
			return object.Err
		}
		if err := storage.Delete(ctx, object.Key); err != nil {
			return err
		}
	}
	return ctx.Err()
}
