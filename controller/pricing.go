package controller

import (
	"net/http"
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

const (
	modelSquareAESKeyEnv = "MODEL_SQUARE_AES_KEY"
	modelSquareAESAAD    = "new-api:model-square:v1"
)

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		// The pricing cache is shared by all viewers.
		groups := make([]string, 0, len(item.EnableGroup))
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok || group == "all" {
				groups = append(groups, group)
			}
		}
		if len(groups) > 0 {
			item.EnableGroup = groups
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	usableGroup := service.GetUserUsableGroups(userGroup)
	autoGroups := service.GetUserAutoGroup(userGroup)
	groupRatio := ratio_setting.GetGroupRatioCopy()
	groupVendorRatio := ratio_setting.GetGroupVendorRatioCopy()
	// 命中用户特殊倍率的分组（特殊倍率优先于供应商倍率，前端据此判定）
	groupSpecialRatios := make([]string, 0)
	if c.GetInt("role") >= common.RoleRootUser {
		for groupName := range groupRatio {
			if _, ok := usableGroup[groupName]; !ok {
				usableGroup[groupName] = setting.GetUsableGroupDescription(groupName)
			}
		}
		autoGroups = make([]string, 0)
		for _, groupName := range setting.GetAutoGroups() {
			if _, ok := usableGroup[groupName]; ok {
				autoGroups = append(autoGroups, groupName)
			}
		}
	}
	pricing := filterPricingByUsableGroups(model.GetPricing(), usableGroup)
	for group := range groupRatio {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
			continue
		}
		if userGroup != "" {
			if ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group); ok {
				groupRatio[group] = ratio
				groupSpecialRatios = append(groupSpecialRatios, group)
			}
		}
	}
	for group := range groupVendorRatio {
		if _, ok := usableGroup[group]; !ok {
			delete(groupVendorRatio, group)
		}
	}

	response := gin.H{
		"success":              true,
		"data":                 pricing,
		"recommendations":      model.GetModelSquareRecommendations(pricing),
		"vendors":              model.GetVendors(),
		"group_ratio":          groupRatio,
		"group_vendor_ratio":   groupVendorRatio,
		"group_special_ratios": groupSpecialRatios,
		"usable_group":         usableGroup,
		"supported_endpoint":   model.GetSupportedEndpointMap(),
		"auto_groups":          autoGroups,
		"model_order":          service.BuildModelSquareOrder(pricing),
		"pricing_version":      "a42d372ccf0b5dd13ecf71203521f9d2",
	}
	plaintext, err := common.Marshal(response)
	if err != nil {
		common.SysError("marshal model square pricing response failed: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to prepare model square response",
		})
		return
	}
	ciphertext, err := common.EncryptAESGCM(
		plaintext,
		os.Getenv(modelSquareAESKeyEnv),
		[]byte(modelSquareAESAAD),
	)
	if err != nil {
		common.SysError("encrypt model square pricing response failed: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "model square encryption is not configured",
		})
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(ciphertext))
}

type modelSquareUsage struct {
	ModelName  string `json:"model_name"`
	Icon       string `json:"icon,omitempty"`
	VendorName string `json:"vendor_name,omitempty"`
	VendorIcon string `json:"vendor_icon,omitempty"`
	Requests   int64  `json:"requests"`
	Tokens     int64  `json:"tokens"`
}

// GetModelSquareUsage lists every model of the model square, whichever group
// can see it, with its usage for the order preview.
func GetModelSquareUsage(c *gin.Context) {
	days := c.DefaultQuery("days", "7")
	if err := operation_setting.ValidateModelSquareOption("model_square_setting.sort_days", days); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, err)
		return
	}
	dayCount, _ := strconv.Atoi(days)
	totals, err := service.GetModelUsageTotals(dayCount)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usage := make(map[string]model.ModelUsageTotal, len(totals))
	for _, total := range totals {
		usage[total.ModelName] = total
	}
	pricing := model.GetPricing()
	vendors := make(map[int]model.PricingVendor)
	for _, vendor := range model.GetVendors() {
		vendors[vendor.ID] = vendor
	}
	rows := make([]modelSquareUsage, 0, len(pricing))
	for _, item := range pricing {
		vendor := vendors[item.VendorID]
		total := usage[item.ModelName]
		rows = append(rows, modelSquareUsage{
			ModelName:  item.ModelName,
			Icon:       item.Icon,
			VendorName: vendor.Name,
			VendorIcon: vendor.Icon,
			Requests:   total.Requests,
			Tokens:     total.Tokens,
		})
	}
	common.ApiSuccess(c, rows)
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Model ratios reset", nil)
}
