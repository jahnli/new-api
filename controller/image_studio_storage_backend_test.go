package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageStudioS3ObjectNamePreservesAssetPath(t *testing.T) {
	storage := imageStudioS3Storage{}

	assert.Equal(t,
		"image/alice_admin/0123456789abcdef.png",
		storage.objectName("alice_admin/0123456789abcdef.png"),
	)
}

func TestNewImageStudioS3StorageUsesConfiguredBucket(t *testing.T) {
	t.Setenv(imageStudioStorageDSNEnv, "http://access-key:secret-key@127.0.0.1:9000/generated-images")

	storage, err := newImageStudioS3Storage()
	require.NoError(t, err)
	assert.Equal(t, "generated-images", storage.bucket)
}

func TestNewImageStudioS3StorageRejectsIncompleteDSN(t *testing.T) {
	t.Setenv(imageStudioStorageDSNEnv, "http://127.0.0.1:9000/generated-images")

	storage, err := newImageStudioS3Storage()

	require.Error(t, err)
	assert.Nil(t, storage)
}
