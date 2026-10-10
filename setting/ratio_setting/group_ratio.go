package ratio_setting

import (
	"encoding/json"
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

var defaultGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var groupRatioMap = types.NewRWMap[string, float64]()

var defaultGroupGroupRatio = map[string]map[string]float64{
	"vip": {
		"edit_this": 0.9,
	},
}

var groupGroupRatioMap = types.NewRWMap[string, map[string]float64]()

// groupVendorRatioMap 存储 分组 -> {供应商ID(字符串): 倍率}。
// 命中时直接替换该分组的基础倍率，而非叠乘。内层键为字符串形式的
// vendors.id（JSON 对象键只能是字符串）。
var groupVendorRatioMap = types.NewRWMap[string, map[string]float64]()

var defaultGroupSpecialUsableGroup = map[string]map[string]string{}

type GroupRatioSetting struct {
	GroupRatio              *types.RWMap[string, float64]            `json:"group_ratio"`
	GroupGroupRatio         *types.RWMap[string, map[string]float64] `json:"group_group_ratio"`
	GroupVendorRatio        *types.RWMap[string, map[string]float64] `json:"group_vendor_ratio"`
	GroupSpecialUsableGroup *types.RWMap[string, map[string]string]  `json:"group_special_usable_group"`
}

var groupRatioSetting GroupRatioSetting

func init() {
	groupSpecialUsableGroup := types.NewRWMap[string, map[string]string]()
	groupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)

	groupRatioMap.AddAll(defaultGroupRatio)
	groupGroupRatioMap.AddAll(defaultGroupGroupRatio)

	groupRatioSetting = GroupRatioSetting{
		GroupSpecialUsableGroup: groupSpecialUsableGroup,
		GroupRatio:              groupRatioMap,
		GroupGroupRatio:         groupGroupRatioMap,
		GroupVendorRatio:        groupVendorRatioMap,
	}

	config.GlobalConfig.Register("group_ratio_setting", &groupRatioSetting)
}

func GetGroupRatioSetting() *GroupRatioSetting {
	if groupRatioSetting.GroupSpecialUsableGroup == nil {
		groupRatioSetting.GroupSpecialUsableGroup = types.NewRWMap[string, map[string]string]()
		groupRatioSetting.GroupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)
	}
	return &groupRatioSetting
}

func GetGroupRatioCopy() map[string]float64 {
	return groupRatioMap.ReadAll()
}

func ContainsGroupRatio(name string) bool {
	_, ok := groupRatioMap.Get(name)
	return ok
}

func GroupRatio2JSONString() string {
	return groupRatioMap.MarshalJSONString()
}

func UpdateGroupRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupRatioMap, jsonStr)
}

func GetGroupRatio(name string) float64 {
	ratio, ok := groupRatioMap.Get(name)
	if !ok {
		common.SysLog(common.LogText("group ratio not found: %s", name))
		return 1
	}
	return ratio
}

func GetGroupGroupRatio(userGroup, usingGroup string) (float64, bool) {
	gp, ok := groupGroupRatioMap.Get(userGroup)
	if !ok {
		return -1, false
	}
	ratio, ok := gp[usingGroup]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func GroupGroupRatio2JSONString() string {
	return groupGroupRatioMap.MarshalJSONString()
}

func UpdateGroupGroupRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupGroupRatioMap, jsonStr)
}

// GetGroupVendorRatio 返回分组针对某供应商配置的倍率。
// 未配置时返回 (-1, false)，调用方应回退到分组基础倍率。
func GetGroupVendorRatio(group string, vendorID int) (float64, bool) {
	vendorRatios, ok := groupVendorRatioMap.Get(group)
	if !ok {
		return -1, false
	}
	ratio, ok := vendorRatios[strconv.Itoa(vendorID)]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func GetGroupVendorRatioCopy() map[string]map[string]float64 {
	all := groupVendorRatioMap.ReadAll()
	result := make(map[string]map[string]float64, len(all))
	for group, vendorRatios := range all {
		inner := make(map[string]float64, len(vendorRatios))
		for vendorKey, ratio := range vendorRatios {
			inner[vendorKey] = ratio
		}
		result[group] = inner
	}
	return result
}

func GroupVendorRatio2JSONString() string {
	return groupVendorRatioMap.MarshalJSONString()
}

func UpdateGroupVendorRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupVendorRatioMap, jsonStr)
}

func CheckGroupVendorRatio(jsonStr string) error {
	checkMap := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(jsonStr), &checkMap); err != nil {
		return err
	}
	for groupName, vendorRatios := range checkMap {
		for vendorKey, ratio := range vendorRatios {
			vendorID, err := strconv.Atoi(vendorKey)
			if err != nil || vendorID <= 0 {
				return errors.New("group vendor ratio key must be a positive vendor id: " + groupName + "." + vendorKey)
			}
			if ratio < 0 {
				return errors.New("group vendor ratio must be not less than 0: " + groupName + "." + vendorKey)
			}
		}
	}
	return nil
}

// ResolveGroupRatio 按 用户特殊倍率 > 分组供应商倍率 > 分组基础倍率 的优先级
// 返回最终分组倍率。供应商倍率命中时直接替换基础倍率，不叠乘。
// vendorID 为 0 表示模型无供应商归属，此时跳过供应商倍率。
func ResolveGroupRatio(userGroup, usingGroup string, vendorID int) types.GroupRatioInfo {
	info := types.GroupRatioInfo{
		GroupRatio:        1.0,
		GroupSpecialRatio: -1,
	}
	if ratio, ok := GetGroupGroupRatio(userGroup, usingGroup); ok {
		info.GroupRatio = ratio
		info.GroupSpecialRatio = ratio
		info.HasSpecialRatio = true
		return info
	}
	if vendorID > 0 {
		if ratio, ok := GetGroupVendorRatio(usingGroup, vendorID); ok {
			info.GroupRatio = ratio
			info.VendorID = vendorID
			info.HasVendorRatio = true
			return info
		}
	}
	info.GroupRatio = GetGroupRatio(usingGroup)
	return info
}

func CheckGroupRatio(jsonStr string) error {
	checkGroupRatio := make(map[string]float64)
	err := json.Unmarshal([]byte(jsonStr), &checkGroupRatio)
	if err != nil {
		return err
	}
	for name, ratio := range checkGroupRatio {
		if ratio < 0 {
			return errors.New("group ratio must be not less than 0: " + name)
		}
	}
	return nil
}
