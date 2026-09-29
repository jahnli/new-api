package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func GetSalesUsers(c *gin.Context) {
	if !operation_setting.ExternalModeEnabled {
		common.ApiSuccess(c, []model.SalesUser{})
		return
	}
	users, err := model.GetSalesUsers()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, users)
}
