package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	feishuBaseURL     = "https://open.feishu.cn/open-apis"
	feishuHTTPTimeout = 10 * time.Second
)

type feishuSyncConfig struct {
	AppID       string
	AppSecret   string
	EmailSuffix string
}

// SyncFeishuUserAsync 在 goroutine 中同步飞书字段，不阻塞登录流程。失败仅记日志。
func SyncFeishuUserAsync(user *model.User) {
	if user == nil || user.Id == 0 {
		return
	}
	gopool.Go(func() {
		if err := SyncFeishuUser(user); err != nil {
			common.SysError(fmt.Sprintf("飞书字段同步失败 user=%s: %s", user.Username, err.Error()))
		}
	})
}

// feishuDirectoryData 是 directory/v1/employees/mget 接口 data 字段的结构。
type feishuDirectoryData struct {
	Employees []struct {
		BaseInfo struct {
			Avatar struct {
				Avatar640 string `json:"avatar_640"`
				Avatar240 string `json:"avatar_240"`
			} `json:"avatar"`
			BackgroundImage string `json:"background_image"`
			Description     string `json:"description"`
			Gender          int    `json:"gender"`
			LeaderId        string `json:"leader_id"`
			Mobile          string `json:"mobile"`
			ProfileFields   []struct {
				FieldKey  string `json:"field_key"`
				TextValue *struct {
					DefaultValue string `json:"default_value"`
				} `json:"text_value"`
			} `json:"custom_field_values"`
			Name struct {
				Name struct {
					DefaultValue string `json:"default_value"`
				} `json:"name"`
			} `json:"name"`
			Departments []struct {
				DepartmentId        string `json:"department_id"`
				DepartmentPathInfos []struct {
					DepartmentId   string `json:"department_id"`
					DepartmentName struct {
						DefaultValue string `json:"default_value"`
					} `json:"department_name"`
				} `json:"department_path_infos"`
				Leaders []struct {
					LeaderId   string `json:"leader_id"`
					LeaderType int    `json:"leader_type"`
				} `json:"leaders"`
				Name struct {
					DefaultValue string `json:"default_value"`
				} `json:"name"`
			} `json:"departments"`
		} `json:"base_info"`
		WorkInfo struct {
			JobNumber string `json:"job_number"`
			JoinDate  string `json:"join_date"`
			JobTitle  struct {
				JobTitleName struct {
					DefaultValue string `json:"default_value"`
				} `json:"job_title_name"`
			} `json:"job_title"`
		} `json:"work_info"`
	} `json:"employees"`
}

// deptSimplified 是写库时部门字段的简化结构。
type deptSimplified struct {
	DepartmentId        string             `json:"department_id"`
	DepartmentPathInfos []deptPathSimple   `json:"department_path_infos"`
	Leaders             []deptLeaderSimple `json:"leaders"`
	Name                string             `json:"name"`
}

type deptPathSimple struct {
	DepartmentId   string `json:"department_id"`
	DepartmentName string `json:"department_name"`
}

type deptLeaderSimple struct {
	LeaderId string `json:"leader_id"`
}

// SyncFeishuUser 以用户名拼邮箱 → 查 open_id → 通过 directory API 拉取员工信息 → 写回数据库。
func SyncFeishuUser(user *model.User) error {
	if user == nil || user.Username == "" {
		return nil
	}
	cfg, ok := resolveFeishuSyncConfig(user)
	if !ok {
		return nil
	}

	token, err := feishuGetTenantAccessToken(cfg)
	if err != nil {
		return fmt.Errorf("get tenant_access_token: %w", err)
	}

	email := buildFeishuEmail(user.Username, cfg.EmailSuffix)
	openId, err := feishuGetOpenIDByEmail(token, email)
	if err != nil {
		return fmt.Errorf("lookup open_id by email %s: %w", email, err)
	}
	if openId == "" {
		return fmt.Errorf("open_id not found for email %s", email)
	}

	rawData, err := feishuGetEmployeeDirectory(token, openId)
	if err != nil {
		return fmt.Errorf("get employee directory: %w", err)
	}

	var dirData feishuDirectoryData
	if err := common.Unmarshal(rawData, &dirData); err != nil {
		return fmt.Errorf("decode directory data: %w", err)
	}
	if len(dirData.Employees) == 0 {
		return fmt.Errorf("no employee found for open_id %s", openId)
	}

	emp := dirData.Employees[0]
	base := emp.BaseInfo
	work := emp.WorkInfo

	// 构建简化部门结构
	depts := make([]deptSimplified, 0, len(base.Departments))
	for _, d := range base.Departments {
		paths := make([]deptPathSimple, 0, len(d.DepartmentPathInfos))
		for _, p := range d.DepartmentPathInfos {
			paths = append(paths, deptPathSimple{
				DepartmentId:   p.DepartmentId,
				DepartmentName: p.DepartmentName.DefaultValue,
			})
		}
		leaders := make([]deptLeaderSimple, 0, len(d.Leaders))
		for _, l := range d.Leaders {
			leaders = append(leaders, deptLeaderSimple{LeaderId: l.LeaderId})
		}
		depts = append(depts, deptSimplified{
			DepartmentId:        d.DepartmentId,
			DepartmentPathInfos: paths,
			Leaders:             leaders,
			Name:                d.Name.DefaultValue,
		})
	}
	deptsJSON, err := common.Marshal(depts)
	if err != nil {
		return fmt.Errorf("marshal departments: %w", err)
	}

	// department_name：取第一个部门的 path 拼接为 "xx / xx / xx"
	var departmentName string
	if len(depts) > 0 {
		names := make([]string, 0, len(depts[0].DepartmentPathInfos))
		for _, p := range depts[0].DepartmentPathInfos {
			names = append(names, p.DepartmentName)
		}
		departmentName = strings.Join(names, " / ")
	}

	// Prefer the 640px avatar for large profile badges.
	avatarURL := strings.TrimSpace(base.Avatar.Avatar640)
	if avatarURL == "" {
		avatarURL = base.Avatar.Avatar240
	}
	updates := map[string]any{
		"avatar_url":       avatarURL,
		"background_image": base.BackgroundImage,
		"open_id":          openId,
		"display_name":     base.Name.Name.DefaultValue,
		"description":      base.Description,
		"gender":           base.Gender,
		"leader_id":        base.LeaderId,
		"mobile":           base.Mobile,
		"job_number":       work.JobNumber,
		"job_title":        work.JobTitle.JobTitleName.DefaultValue,
		"join_date":        work.JoinDate,
		"departments":      string(deptsJSON),
		"department_name":  departmentName,
		"job_level":        "",
		"job_description":  "",
		"birthday":         "",
		"hometown":         "",
		"ethnicity":        "",
	}
	// Feishu returns these profile values as custom fields; persist only the
	// dedicated columns used by the application.
	for _, field := range base.ProfileFields {
		if field.TextValue == nil {
			continue
		}
		var column string
		switch field.FieldKey {
		case "C-7434714811573665793":
			column = "job_level"
		case "C-7439269744984244227":
			column = "job_description"
		case "C-7613945054108945361":
			column = "birthday"
		case "C-7439630416690561028":
			column = "hometown"
		case "C-7439269636549230620":
			column = "ethnicity"
		default:
			continue
		}
		updates[column] = field.TextValue.DefaultValue
	}
	if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Updates(updates).Error; err != nil {
		return err
	}

	user.AvatarUrl = avatarURL
	user.DisplayName = base.Name.Name.DefaultValue
	common.SysLog(fmt.Sprintf("飞书字段同步完成 user_id=%d open_id=%s job_number=%s", user.Id, openId, work.JobNumber))
	return nil
}

// resolveFeishuSyncConfig 按用户所属公司解析飞书同步凭据。
// 凭据与邮箱后缀只来自 LDAP 公司同步配置：飞书按邮箱反查 open_id，
// 缺少后缀就无法拼出企业邮箱，因此后缀为空时视为未配置，不触发同步。
func resolveFeishuSyncConfig(user *model.User) (feishuSyncConfig, bool) {
	company := model.NormalizeCompany(user.Company)
	if company == "" {
		return feishuSyncConfig{}, false
	}
	cfg, ok := system_setting.GetLDAPCompanySyncConfig(company)
	if !ok {
		return feishuSyncConfig{}, false
	}
	if cfg.SyncPlatform != system_setting.LDAPSyncPlatformFeishu {
		return feishuSyncConfig{}, false
	}
	if cfg.FeishuAppID == "" || cfg.FeishuAppSecret == "" || cfg.FeishuEmailSuffix == "" {
		return feishuSyncConfig{}, false
	}
	return feishuSyncConfig{
		AppID:       cfg.FeishuAppID,
		AppSecret:   cfg.FeishuAppSecret,
		EmailSuffix: cfg.FeishuEmailSuffix,
	}, true
}

// buildFeishuEmail 用用户名拼接飞书邮箱后缀。
func buildFeishuEmail(username string, suffix string) string {
	return username + suffix
}

func feishuHTTPClient() *http.Client {
	return &http.Client{Timeout: feishuHTTPTimeout}
}

func feishuDoRequest(method, url string, body any, token string) ([]byte, int, error) {
	var reader io.Reader
	if body != nil {
		data, err := common.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := feishuHTTPClient().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	return respBody, resp.StatusCode, err
}

// feishuAPIResult 是飞书开放接口统一响应的壳。Data 用 json.RawMessage 保留原始字节，
// 由各调用方按需反序列化（规则 1：类型引用允许，反序列化通过 common.Unmarshal）。
type feishuAPIResult struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func feishuCheckResult(respBody []byte, status int) (*feishuAPIResult, error) {
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("http %d: %s", status, string(respBody))
	}
	var r feishuAPIResult
	if err := common.Unmarshal(respBody, &r); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if r.Code != 0 {
		return nil, fmt.Errorf("feishu code=%d msg=%s", r.Code, r.Msg)
	}
	return &r, nil
}

func feishuGetTenantAccessToken(cfg feishuSyncConfig) (string, error) {
	token, _, err := feishuGetTenantAccessTokenWithExpiry(cfg)
	return token, err
}

func feishuGetTenantAccessTokenWithExpiry(cfg feishuSyncConfig) (string, time.Duration, error) {
	body := map[string]string{
		"app_id":     cfg.AppID,
		"app_secret": cfg.AppSecret,
	}
	respBody, _, err := feishuDoRequest(http.MethodPost, feishuBaseURL+"/auth/v3/tenant_access_token/internal", body, "")
	if err != nil {
		return "", 0, err
	}
	// tenant_access_token 接口的响应不在标准 data 壳内，单独解析。
	var resp struct {
		Code              int    `json:"code"`
		Msg               string `json:"msg"`
		TenantAccessToken string `json:"tenant_access_token"`
		Expire            int    `json:"expire"`
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return "", 0, fmt.Errorf("decode token response: %w", err)
	}
	if resp.Code != 0 {
		return "", 0, fmt.Errorf("feishu code=%d msg=%s", resp.Code, resp.Msg)
	}
	if resp.TenantAccessToken == "" {
		return "", 0, fmt.Errorf("empty tenant_access_token")
	}
	return resp.TenantAccessToken, time.Duration(resp.Expire) * time.Second, nil
}

// feishuGetOpenIDByEmail 通过邮箱查询用户的 open_id。
func feishuGetOpenIDByEmail(token, email string) (string, error) {
	url := feishuBaseURL + "/contact/v3/users/batch_get_id?user_id_type=open_id"
	body := map[string]any{
		"emails":           []string{email},
		"include_resigned": false,
	}
	respBody, status, err := feishuDoRequest(http.MethodPost, url, body, token)
	if err != nil {
		return "", err
	}
	r, err := feishuCheckResult(respBody, status)
	if err != nil {
		return "", err
	}
	var data struct {
		UserList []struct {
			UserID string `json:"user_id"`
		} `json:"user_list"`
	}
	if err := common.Unmarshal(r.Data, &data); err != nil {
		return "", fmt.Errorf("decode user_list: %w", err)
	}
	if len(data.UserList) == 0 {
		return "", nil
	}
	return data.UserList[0].UserID, nil
}

var feishuDirectoryRequiredFields = []string{
	"base_info.name",
	"base_info.avatar",
	"base_info.background_image",
	"base_info.description",
	"base_info.mobile",
	"base_info.email",
	"base_info.gender",
	"base_info.department_path_infos",
	"base_info.leader_id",
	"base_info.custom_field_values",
	"base_info.departments.department_id",
	"base_info.departments.name",
	"base_info.departments.leaders",
	"base_info.departments.department_path_infos",
	"work_info.job_number",
	"work_info.join_date",
	"work_info.positions",
	"work_info.job_title.job_title_name",
}

// feishuGetEmployeeDirectory 通过 directory/v1/employees/mget 一次性获取员工信息。
// 返回原始 data 字段的 JSON 字节，供调用方按需解析。
func feishuGetEmployeeDirectory(token, openID string) (json.RawMessage, error) {
	body := map[string]any{
		"employee_ids":    []string{openID},
		"required_fields": feishuDirectoryRequiredFields,
	}
	respBody, status, err := feishuDoRequest(http.MethodPost, feishuBaseURL+"/directory/v1/employees/mget", body, token)
	if err != nil {
		return nil, err
	}
	r, err := feishuCheckResult(respBody, status)
	if err != nil {
		return nil, err
	}
	return r.Data, nil
}
