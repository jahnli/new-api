package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setModelSquareTestOption(t *testing.T, raw string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{setting.ModelSquareConfigKey: raw}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
}

func TestModelSquareUpdateRejectsInvalidBodies(t *testing.T) {
	for _, body := range []string{"null", "{}", `{"enabled":false,"recommendations":[]} {}`, strings.Repeat(" ", setting.ModelSquareMaxBodyBytes+1)} {
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(http.MethodPut, "/api/model-square/config", strings.NewReader(body))
		UpdateModelSquareConfig(context)
		assert.Equal(t, http.StatusBadRequest, recorder.Code)
		assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	}
}

func TestModelSquareAdminReportsCorruptSavedConfig(t *testing.T) {
	setModelSquareTestOption(t, "broken")
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	GetModelSquareConfig(context)
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	recorder = httptest.NewRecorder()
	context, _ = gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/model-square/config", strings.NewReader(`{"enabled":false,"recommendations":[]}`))
	UpdateModelSquareConfig(context)
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "invalid character")
}

func TestModelSquareUpdatePersistenceFailureReturnsSafeInternalError(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "live", ChannelId: 9104, Enabled: true}).Error)
	model.InvalidatePricingCache()
	const previous = `{"enabled":true,"recommendations":[]}`
	require.NoError(t, db.Create(&model.Option{Key: setting.ModelSquareConfigKey, Value: previous}).Error)
	setModelSquareTestOption(t, previous)
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:model_square_http_failure", func(tx *gorm.DB) {
		tx.AddError(errors.New("private database connection detail"))
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Update().Remove("test:model_square_http_failure")) })
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/model-square/config", strings.NewReader(`{"enabled":false,"recommendations":[]}`))
	UpdateModelSquareConfig(context)
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	assert.JSONEq(t, `{"success":false,"message":"failed to save model square config"}`, recorder.Body.String())
	assert.NotContains(t, recorder.Body.String(), "private database")
	config, err := setting.GetModelSquareConfig()
	require.NoError(t, err)
	assert.True(t, config.Enabled)
}

func TestModelSquareGenericOptionUpdateIsBlocked(t *testing.T) {
	setModelSquareTestOption(t, `{"enabled":false,"recommendations":[]}`)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(`{"key":"ModelSquareConfig","value":"{}"}`))
	UpdateOption(context)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	config, err := setting.GetModelSquareConfig()
	require.NoError(t, err)
	assert.False(t, config.Enabled)
}

func TestModelSquareConfigAPIRoundTrip(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "live", ChannelId: 9101, Enabled: true}).Error)
	model.InvalidatePricingCache()
	setModelSquareTestOption(t, `{"enabled":true,"recommendations":[{"model_name":"retired","scenario":"coding","reason":"old","enabled":true}]}`)
	body := `{"enabled":true,"recommendations":[{"model_name":"retired","scenarios":["Coding"],"reason":"edited","enabled":false},{"model_name":" live ","scenarios":["Daily chat","自定义"],"reason":" 推荐 ","enabled":true}]}`
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/model-square/config", strings.NewReader(body))
	UpdateModelSquareConfig(context)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var response struct {
		Success bool                      `json:"success"`
		Data    setting.ModelSquareConfig `json:"data"`
		Models  []string                  `json:"models"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, "推荐", response.Data.Recommendations[1].Reason)
	assert.Equal(t, "live", response.Data.Recommendations[1].ModelName)
	assert.Equal(t, []string{"Daily chat", "自定义"}, response.Data.Recommendations[1].Scenarios)
	recorder = httptest.NewRecorder()
	context, _ = gin.CreateTestContext(recorder)
	GetModelSquareConfig(context)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Contains(t, response.Models, "live")
	assert.NotContains(t, response.Models, "retired")
	assert.Len(t, response.Data.Recommendations, 2)

	recorder = httptest.NewRecorder()
	context, _ = gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/model-square/config", strings.NewReader(strings.Replace(body, " live ", "unknown", 1)))
	UpdateModelSquareConfig(context)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "unknown")
}

func TestModelSquarePricingRecommendationsStayEncryptedAndRespectGroups(t *testing.T) {
	const key = "test-only-model-square-key-32-bytes"
	t.Setenv(modelSquareAESKeyEnv, key)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "visible", ChannelId: 9102, Enabled: true},
		{Group: "restricted-model-square-test", Model: "secret", ChannelId: 9103, Enabled: true},
	}).Error)
	model.InvalidatePricingCache()
	setModelSquareTestOption(t, `{"enabled":true,"recommendations":[{"model_name":"visible","scenarios":["Coding","自定义"],"reason":"visible reason","enabled":true},{"model_name":"secret","scenario":"chat","reason":"secret reason","enabled":true}]}`)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/pricing", nil)
	GetPricing(context)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "visible reason")
	plaintext, err := common.DecryptAESGCM(recorder.Body.String(), key, []byte(modelSquareAESAAD))
	require.NoError(t, err)
	var response struct {
		Recommendations []setting.ModelSquareRecommendation `json:"recommendations"`
	}
	require.NoError(t, common.Unmarshal(plaintext, &response))
	require.Len(t, response.Recommendations, 1)
	assert.Equal(t, "visible", response.Recommendations[0].ModelName)
	assert.Equal(t, []string{"Coding", "自定义"}, response.Recommendations[0].Scenarios)
	assert.NotContains(t, string(plaintext), "secret reason")
}
