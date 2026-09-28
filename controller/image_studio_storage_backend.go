package controller

import (
	"context"
	"path"
	"sync"

	"github.com/QuantumNous/new-api/pkg/objectstorage"
	"github.com/minio/minio-go/v7"
)

const (
	imageStudioObjectPrefix  = "image"
	imageStudioStorageDSNEnv = objectstorage.DSNEnv
)

type imageStudioStoredObject = objectstorage.Object

type imageStudioS3Storage struct {
	client *minio.Client
	bucket string
}

func (storage imageStudioS3Storage) Put(ctx context.Context, objectName string, data []byte, contentType string) error {
	backend := objectstorage.Storage{Client: storage.client, Bucket: storage.bucket}
	return backend.Put(ctx, storage.objectName(objectName), data, contentType)
}

func (storage imageStudioS3Storage) Open(ctx context.Context, objectName string) (*imageStudioStoredObject, error) {
	backend := objectstorage.Storage{Client: storage.client, Bucket: storage.bucket}
	return backend.Open(ctx, storage.objectName(objectName))
}

func (storage imageStudioS3Storage) Delete(ctx context.Context, objectName string) error {
	backend := objectstorage.Storage{Client: storage.client, Bucket: storage.bucket}
	return backend.Delete(ctx, storage.objectName(objectName))
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
	backend, err := objectstorage.FromEnv()
	if err != nil {
		return nil, err
	}
	return &imageStudioS3Storage{client: backend.Client, bucket: backend.Bucket}, nil
}
