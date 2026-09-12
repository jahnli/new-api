package controller

import (
	"maps"
	"net/http"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
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
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	maps.Copy(groupRatio, ratio_setting.GetGroupRatioCopy())
	groupVendorRatio := ratio_setting.GetGroupVendorRatioCopy()
	// 命中用户特殊倍率的分组（特殊倍率优先于供应商倍率，前端据此判定）
	groupSpecialRatios := make([]string, 0)
	var group string
	var role int
	if exists {
		user, err := model.GetUserById(userId.(int), false)
		if err == nil {
			group = user.Group
			role = user.Role
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
					groupSpecialRatios = append(groupSpecialRatios, g)
				}
			}
		}
	}

	usableGroup = service.GetUserUsableGroups(group)
	autoGroups := service.GetUserAutoGroup(group)
	if role >= common.RoleRootUser {
		for groupName := range ratio_setting.GetGroupRatioCopy() {
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
	pricing = filterPricingByUsableGroups(pricing, usableGroup)
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
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

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
