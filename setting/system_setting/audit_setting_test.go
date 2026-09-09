package system_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestImageStudioHistoryLimitDefaults(t *testing.T) {
	assert.Equal(t, 20, DefaultImageStudioDisplayHistoryLimit)
	assert.Equal(t, 50, DefaultImageStudioMaxHistory)
}

func TestImageStudioHistoryLimitsAreNormalizedIndependently(t *testing.T) {
	setting := GetAuditSetting()
	originalDisplayLimit := setting.ImageStudioDisplayHistoryLimit
	originalStorageLimit := setting.ImageStudioMaxHistory
	t.Cleanup(func() {
		setting.ImageStudioDisplayHistoryLimit = originalDisplayLimit
		setting.ImageStudioMaxHistory = originalStorageLimit
	})

	tests := []struct {
		name            string
		displayLimit    int
		storageLimit    int
		expectedDisplay int
		expectedStorage int
	}{
		{
			name:            "configured values stay independent",
			displayLimit:    25,
			storageLimit:    400,
			expectedDisplay: 25,
			expectedStorage: 400,
		},
		{
			name:            "invalid values use their defaults",
			displayLimit:    0,
			storageLimit:    -1,
			expectedDisplay: DefaultImageStudioDisplayHistoryLimit,
			expectedStorage: DefaultImageStudioMaxHistory,
		},
		{
			name:            "oversized values are clamped",
			displayLimit:    MaxImageStudioMaxHistory + 1,
			storageLimit:    MaxImageStudioMaxHistory + 2,
			expectedDisplay: MaxImageStudioMaxHistory,
			expectedStorage: MaxImageStudioMaxHistory,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setting.ImageStudioDisplayHistoryLimit = test.displayLimit
			setting.ImageStudioMaxHistory = test.storageLimit

			assert.Equal(t, test.expectedDisplay, GetImageStudioDisplayHistoryLimit())
			assert.Equal(t, test.expectedStorage, GetImageStudioMaxHistory())
		})
	}
}
