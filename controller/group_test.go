package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetGroupsCanIncludeBaseRatios(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/api/group/?with_ratio=true", nil)

	GetGroups(context)

	require.Equal(t, 200, recorder.Code)
	var response struct {
		Success bool               `json:"success"`
		Data    map[string]float64 `json:"data"`
	}
	require.NoError(t, common.DecodeJson(recorder.Body, &response))
	require.True(t, response.Success)
	require.Equal(t, 1.0, response.Data["default"])
}
