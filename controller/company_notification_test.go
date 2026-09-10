package controller

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseRequiredNotificationBoolFailsClosed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, testCase := range []struct {
		name      string
		value     string
		include   bool
		wantValue bool
		wantError bool
	}{
		{name: "true", value: "true", include: true, wantValue: true},
		{name: "false", value: "false", include: true},
		{name: "missing", wantError: true},
		{name: "invalid", value: "on", include: true, wantError: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			form := url.Values{}
			if testCase.include {
				form.Set("test_mode", testCase.value)
			}
			request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(form.Encode()))
			request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = request

			value, err := parseRequiredNotificationBool(context, "test_mode")

			if testCase.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, testCase.wantValue, value)
		})
	}
}

func TestNotificationRecipientListCannotExpandDingTalkTargets(t *testing.T) {
	values, err := parseNotificationStringList(`["user-1,user-2"]`)
	require.NoError(t, err)
	require.Len(t, values, 1)
	require.Error(t, validateNotificationPlatformIDs(values))
}

func TestReadCompanyNotificationImagesUsesDetectedSafeExtension(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("images", "payload.exe")
	require.NoError(t, err)
	imageData := image.NewRGBA(image.Rect(0, 0, 2, 2))
	imageData.Set(0, 0, color.White)
	require.NoError(t, png.Encode(part, imageData))
	require.NoError(t, writer.Close())

	request := httptest.NewRequest(http.MethodPost, "/", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, request.ParseMultipartForm(companyNotificationMultipartMemory))
	t.Cleanup(func() { _ = request.MultipartForm.RemoveAll() })
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request

	images, err := readCompanyNotificationImages(context)

	require.NoError(t, err)
	require.Len(t, images, 1)
	assert.Equal(t, "payload.png", images[0].Filename)
	assert.Equal(t, "image/png", images[0].ContentType)
}
