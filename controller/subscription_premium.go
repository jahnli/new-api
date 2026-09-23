package controller

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

type premiumModelOption struct {
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
}

func subscriptionPremiumModelOptions() []premiumModelOption {
	aliases := make(map[string][]string)
	for _, item := range model.GetPricing() {
		name := helper.ResolveBillingModelName(item.ModelName)
		if name == "" {
			name = item.ModelName
		}
		if !slices.Contains(aliases[name], item.ModelName) {
			aliases[name] = append(aliases[name], item.ModelName)
		}
		// Task/plugin pricing keeps the concrete client identity.
		if name != item.ModelName && len(item.BillingPluginVariants) > 0 {
			aliases[item.ModelName] = append(aliases[item.ModelName], item.ModelName)
		}
	}
	options := make([]premiumModelOption, 0, len(aliases))
	for name, names := range aliases {
		slices.Sort(names)
		options = append(options, premiumModelOption{Name: name, Aliases: names})
	}
	slices.SortFunc(options, func(a, b premiumModelOption) int {
		if a.Name < b.Name {
			return -1
		}
		if a.Name > b.Name {
			return 1
		}
		return 0
	})
	return options
}

func GetSubscriptionPremiumModelOptions(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, subscriptionPremiumModelOptions())
}

func GetSubscriptionPremiumPolicy(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	policy, err := model.GetSubscriptionPremiumPolicy(model.DB)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, policy)
}

func UpdateSubscriptionPremiumPolicy(c *gin.Context) {
	var request struct {
		Enabled         *bool     `json:"enabled"`
		DefaultPercent  *float64  `json:"default_percent"`
		ModelNames      *[]string `json:"model_names"`
		ExpectedVersion int64     `json:"expected_version"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024*1024)
	body, readErr := io.ReadAll(c.Request.Body)
	if readErr != nil || common.Unmarshal(body, &request) != nil || request.Enabled == nil || request.DefaultPercent == nil || request.ModelNames == nil {
		common.ApiErrorMsg(c, "Invalid subscription premium policy")
		return
	}
	previous, err := model.GetSubscriptionPremiumPolicy(model.DB)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	names := []string{}
	for _, option := range subscriptionPremiumModelOptions() {
		names = append(names, option.Name)
	}
	policy, err := model.SaveSubscriptionPremiumPolicy(setting.SubscriptionPremiumPolicy{Enabled: *request.Enabled, DefaultPercent: *request.DefaultPercent, ModelNames: *request.ModelNames}, request.ExpectedVersion, names)
	if errors.Is(err, model.ErrSubscriptionPolicyConflict) {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "subscription.premium_policy", map[string]any{"from": previous, "to": policy})
	common.ApiSuccess(c, policy)
}

func GetUserSubscriptionPremiumPolicy(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "Invalid user ID")
		return
	}
	var user model.User
	if err := model.DB.Select("id", "subscription_premium_percent").First(&user, userID).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	policy, err := model.GetSubscriptionPremiumPolicy(model.DB)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	percent := policy.DefaultPercent
	if user.SubscriptionPremiumPercent != nil {
		percent = *user.SubscriptionPremiumPercent
	}
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, gin.H{"percent_override": user.SubscriptionPremiumPercent, "default_percent": policy.DefaultPercent, "effective_percent": percent})
}

func UpdateUserSubscriptionPremiumPolicy(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "Invalid user ID")
		return
	}
	var request map[string]json.RawMessage
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	body, readErr := io.ReadAll(c.Request.Body)
	if readErr != nil || common.Unmarshal(body, &request) != nil {
		common.ApiErrorMsg(c, "Invalid premium percentage")
		return
	}
	value, valueOK := request["percent_override"]
	expected, expectedOK := request["expected_percent_override"]
	var percent, previous *float64
	if !valueOK || !expectedOK || common.Unmarshal(value, &percent) != nil || common.Unmarshal(expected, &previous) != nil {
		common.ApiErrorMsg(c, "Both percentage fields are required (null inherits the default)")
		return
	}
	err = model.UpdateSubscriptionPremiumPercent(userID, percent, previous)
	if errors.Is(err, model.ErrSubscriptionPolicyConflict) {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "subscription.premium_percent", map[string]any{"target_user_id": userID, "from": previous, "to": percent})
	GetUserSubscriptionPremiumPolicy(c)
}
