package service

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"golang.org/x/sync/singleflight"
)

type overviewDepartment struct {
	ID           string
	ParentID     string
	Name         string
	LeaderUserID string
}

type overviewDirectory struct {
	OrganizationName string
	Departments      []overviewDepartment
}

type overviewMember struct {
	// OpenID is the provider's member ID: Feishu open_id or DingTalk userid.
	OpenID string
	Name   string
	// ObservedDepartmentID is the department that returned this open_id from the
	// provider. Used to place unregistered members into sub-department buckets
	// without a second Feishu details fetch.
	ObservedDepartmentID string
}

type companyOverviewCacheEntry struct {
	value     any
	expiresAt time.Time
}

var companyOverviewCache sync.Map
var companyOverviewSingleflight singleflight.Group

func companyOverviewCacheKey(companyID int, resource string, rawID string) string {
	return fmt.Sprintf("company:%d:%s:%s", companyID, resource, rawID)
}

func loadCompanyOverviewCache(key string) (any, bool) {
	value, ok := companyOverviewCache.Load(key)
	if !ok {
		return nil, false
	}
	entry := value.(companyOverviewCacheEntry)
	if time.Now().After(entry.expiresAt) {
		companyOverviewCache.Delete(key)
		return nil, false
	}
	return entry.value, true
}

func storeCompanyOverviewCache(key string, value any, ttl time.Duration) {
	companyOverviewCache.Store(key, companyOverviewCacheEntry{value: value, expiresAt: time.Now().Add(ttl)})
}

func InvalidateCompanyOverviewCache(companyID int) {
	prefix := fmt.Sprintf("company:%d:", companyID)
	companyOverviewCache.Range(func(key, _ any) bool {
		cacheKey, ok := key.(string)
		if ok && strings.HasPrefix(cacheKey, prefix) {
			companyOverviewCache.Delete(cacheKey)
			companyOverviewSingleflight.Forget(cacheKey)
		}
		return true
	})
}

var fetchCompanyDirectory = fetchCompanyDirectoryFromProvider
var fetchCompanyMembers = fetchCompanyMembersFromProvider
var fetchCompanyMemberDetails = fetchCompanyMemberDetailsFromProvider

var (
	requestCompanyFeishuToken         = feishuGetTenantAccessTokenWithExpiry
	requestCompanyFeishuDepartments   = feishuFetchAllDepartments
	requestCompanyDingTalkToken       = dingtalkGetAccessToken
	requestCompanyDingTalkRoot        = dingtalkFetchDeptDetail
	requestCompanyDingTalkDepartments = dingtalkFetchAllDepartments
)

func fetchCompanyDirectoryFromProvider(company *model.Company) (*overviewDirectory, error) {
	cacheKey := companyOverviewCacheKey(company.Id, "directory", "")
	if cached, ok := loadCompanyOverviewCache(cacheKey); ok {
		return cached.(*overviewDirectory), nil
	}
	value, err, _ := companyOverviewSingleflight.Do(cacheKey, func() (any, error) {
		config, err := company.GetConfig()
		if err != nil {
			return nil, err
		}
		var directory *overviewDirectory
		switch company.Platform {
		case model.CompanyPlatformFeishu:
			directory, err = fetchFeishuCompanyDirectory(company, config.Feishu)
		case model.CompanyPlatformDingTalk:
			directory, err = fetchDingTalkCompanyDirectory(company, config.DingTalk)
		default:
			return &overviewDirectory{OrganizationName: company.Name}, nil
		}
		if err != nil {
			return nil, err
		}
		storeCompanyOverviewCache(cacheKey, directory, departmentCacheTTL)
		return directory, nil
	})
	if err != nil {
		return nil, err
	}
	return value.(*overviewDirectory), nil
}

// fetchCompanyMembersFromProvider returns lightweight open_id members for
// stats/usage/rankings/sub-stats. Feishu uses contact/v3/users (open_id only),
// matching the pre-multi-company data overview path. Do not call find_by_department here.
func fetchCompanyMembersFromProvider(company *model.Company, departmentID string) ([]overviewMember, error) {
	cacheKey := companyOverviewCacheKey(company.Id, "member-ids", departmentID)
	if cached, ok := loadCompanyOverviewCache(cacheKey); ok {
		return cached.([]overviewMember), nil
	}
	value, err, _ := companyOverviewSingleflight.Do(cacheKey, func() (any, error) {
		config, err := company.GetConfig()
		if err != nil {
			return nil, err
		}
		var members []overviewMember
		switch company.Platform {
		case model.CompanyPlatformFeishu:
			openIDs, err := withRefreshedCompanyFeishuToken(company.Id, config.Feishu, func(token string) ([]string, error) {
				return getCachedDepartmentMembers(token, departmentID)
			})
			if err != nil {
				return nil, err
			}
			members = make([]overviewMember, 0, len(openIDs))
			for _, openID := range openIDs {
				if openID == "" {
					continue
				}
				members = append(members, overviewMember{OpenID: openID})
			}
		case model.CompanyPlatformDingTalk:
			members, err = withRefreshedCompanyDingTalkToken(company.Id, config.DingTalk, func(token string) ([]overviewMember, error) {
				return dingtalkFetchDepartmentMembers(
					config.DingTalk.ClientID,
					token,
					departmentID,
				)
			})
			if err != nil {
				return nil, err
			}
		}
		storeCompanyOverviewCache(cacheKey, members, departmentMemberCacheTTL)
		return members, nil
	})
	if err != nil {
		return nil, err
	}
	return value.([]overviewMember), nil
}

// fetchCompanyMemberDetailsFromProvider returns members with display names.
// Only the department users table should call this when unregistered names are needed.
func fetchCompanyMemberDetailsFromProvider(company *model.Company, departmentID string) ([]overviewMember, error) {
	cacheKey := companyOverviewCacheKey(company.Id, "member-details", departmentID)
	if cached, ok := loadCompanyOverviewCache(cacheKey); ok {
		return cached.([]overviewMember), nil
	}
	value, err, _ := companyOverviewSingleflight.Do(cacheKey, func() (any, error) {
		config, err := company.GetConfig()
		if err != nil {
			return nil, err
		}
		var members []overviewMember
		switch company.Platform {
		case model.CompanyPlatformFeishu:
			items, err := withRefreshedCompanyFeishuToken(company.Id, config.Feishu, func(token string) ([]feishuDeptMember, error) {
				return getCachedDepartmentMemberDetails(token, departmentID)
			})
			if err != nil {
				return nil, err
			}
			members = make([]overviewMember, 0, len(items))
			for _, item := range items {
				members = append(members, overviewMember{OpenID: item.OpenID, Name: item.Name})
			}
		case model.CompanyPlatformDingTalk:
			return fetchCompanyMembersFromProvider(company, departmentID)
		}
		storeCompanyOverviewCache(cacheKey, members, departmentMemberCacheTTL)
		return members, nil
	})
	if err != nil {
		return nil, err
	}
	return value.([]overviewMember), nil
}

func getCompanyFeishuToken(companyID int, config model.CompanyFeishuConfig) (string, error) {
	if config.AppID == "" || config.AppSecret == "" {
		return "", fmt.Errorf("company %d feishu credentials are incomplete", companyID)
	}
	cacheKey := companyOverviewCacheKey(companyID, "feishu-token", "")
	if cached, ok := loadCompanyOverviewCache(cacheKey); ok {
		return cached.(string), nil
	}
	token, expiresIn, err := requestCompanyFeishuToken(feishuSyncConfig{AppID: config.AppID, AppSecret: config.AppSecret})
	if err != nil {
		return "", err
	}
	cacheTTL := expiresIn - time.Minute
	if cacheTTL > 0 {
		storeCompanyOverviewCache(cacheKey, token, cacheTTL)
	}
	return token, nil
}

func fetchFeishuCompanyDirectory(company *model.Company, config model.CompanyFeishuConfig) (*overviewDirectory, error) {
	// Do not call /tenant/v2/tenant/query here. That API is optional for display
	// naming only. OrganizationName uses company.Name so the multi-company name
	// check stays consistent; connection testing still uses feishuFetchTenantInfo.
	departments, err := withRefreshedCompanyFeishuToken(company.Id, config, requestCompanyFeishuDepartments)
	if err != nil {
		return nil, err
	}
	result := &overviewDirectory{OrganizationName: company.Name, Departments: make([]overviewDepartment, 0, len(departments))}
	for _, department := range departments {
		result.Departments = append(result.Departments, overviewDepartment{
			ID:           department.OpenDepartmentID,
			ParentID:     department.ParentDepartmentID,
			Name:         department.Name,
			LeaderUserID: department.LeaderUserID,
		})
	}
	return result, nil
}

func getCompanyDingTalkToken(companyID int, config model.CompanyDingTalkConfig) (string, error) {
	if config.ClientID == "" || config.ClientSecret == "" {
		return "", fmt.Errorf("company %d dingtalk credentials are incomplete", companyID)
	}
	return requestCompanyDingTalkToken(dingtalkSyncConfig{ClientID: config.ClientID, ClientSecret: config.ClientSecret})
}

func fetchDingTalkCompanyDirectory(company *model.Company, config model.CompanyDingTalkConfig) (*overviewDirectory, error) {
	return withRefreshedCompanyDingTalkToken(company.Id, config, func(token string) (*overviewDirectory, error) {
		root, err := requestCompanyDingTalkRoot(token, dingTalkDeptRootID, make(map[int64]*dingtalkDeptDetail))
		if err != nil {
			return nil, err
		}
		departments, err := requestCompanyDingTalkDepartments(config.ClientID, token)
		if err != nil {
			return nil, err
		}
		return &overviewDirectory{OrganizationName: root.Name, Departments: departments}, nil
	})
}

func withRefreshedCompanyFeishuToken[T any](companyID int, config model.CompanyFeishuConfig, request func(string) (T, error)) (T, error) {
	var zero T
	for attempt := 0; attempt < 2; attempt++ {
		token, err := getCompanyFeishuToken(companyID, config)
		if err != nil {
			return zero, err
		}
		result, err := request(token)
		if err == nil {
			return result, nil
		}
		if attempt == 1 || !isFeishuInvalidAccessTokenError(err) {
			return zero, err
		}
		companyOverviewCache.Delete(companyOverviewCacheKey(companyID, "feishu-token", ""))
	}
	return zero, errors.New("feishu access token refresh failed")
}

func withRefreshedCompanyDingTalkToken[T any](companyID int, config model.CompanyDingTalkConfig, request func(string) (T, error)) (T, error) {
	var zero T
	for attempt := 0; attempt < 2; attempt++ {
		token, err := getCompanyDingTalkToken(companyID, config)
		if err != nil {
			return zero, err
		}
		result, err := request(token)
		if err == nil {
			return result, nil
		}
		if attempt == 1 || !isDingTalkInvalidAccessTokenError(err) {
			return zero, err
		}
		invalidateDingTalkAccessToken(config.ClientID)
	}
	return zero, errors.New("dingtalk access token refresh failed")
}

func isFeishuInvalidAccessTokenError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "99991663") ||
		strings.Contains(message, "9991663") ||
		strings.Contains(message, "Invalid access token for authorization")
}

func isDingTalkInvalidAccessTokenError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "40014") ||
		strings.Contains(message, "不合法的access_token") ||
		strings.Contains(message, "invalid access token")
}

type dingTalkRequestExecutor func(request func() ([]byte, int, error)) ([]byte, int, error)

func dingtalkFetchAllDepartments(clientID string, token string) ([]overviewDepartment, error) {
	return fetchDingTalkDepartments(token, func(request func() ([]byte, int, error)) ([]byte, int, error) {
		return executeDingTalkRateLimitedRequest(
			func() {
				waitForDingTalkRequest(
					clientID,
					dingTalkDepartmentListAPIPath,
					dingTalkDepartmentListRequestsPerSec,
				)
			},
			time.Sleep,
			request,
		)
	})
}

func fetchDingTalkDepartments(token string, execute dingTalkRequestExecutor) ([]overviewDepartment, error) {
	result := make([]overviewDepartment, 0)
	queue := []int64{dingTalkDeptRootID}
	seen := map[int64]bool{dingTalkDeptRootID: true}
	for len(queue) > 0 {
		parentID := queue[0]
		queue = queue[1:]
		urlValue := fmt.Sprintf("%s/topapi/v2/department/listsub?access_token=%s", dingTalkBaseURL, url.QueryEscape(token))
		body := map[string]any{"dept_id": parentID, "language": "zh_CN"}
		respBody, status, err := execute(func() ([]byte, int, error) {
			return dingtalkDoRequest(http.MethodPost, urlValue, body)
		})
		if err != nil {
			return nil, errors.New("dingtalk department request failed")
		}
		if status != http.StatusOK {
			return nil, fmt.Errorf("http %d: %s", status, string(respBody))
		}
		var response struct {
			Errcode int    `json:"errcode"`
			Errmsg  string `json:"errmsg"`
			Result  []struct {
				DeptID   int64  `json:"dept_id"`
				Name     string `json:"name"`
				ParentID int64  `json:"parent_id"`
			} `json:"result"`
		}
		if err := common.Unmarshal(respBody, &response); err != nil {
			return nil, err
		}
		if response.Errcode != 0 {
			return nil, fmt.Errorf("dingtalk errcode=%d msg=%s", response.Errcode, response.Errmsg)
		}
		for _, department := range response.Result {
			if seen[department.DeptID] {
				continue
			}
			seen[department.DeptID] = true
			queue = append(queue, department.DeptID)
			result = append(result, overviewDepartment{
				ID:       strconv.FormatInt(department.DeptID, 10),
				ParentID: strconv.FormatInt(department.ParentID, 10),
				Name:     department.Name,
			})
		}
	}
	return result, nil
}

func dingtalkFetchDepartmentMembers(clientID string, token string, departmentID string) ([]overviewMember, error) {
	deptID, err := strconv.ParseInt(departmentID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid dingtalk department id %q", departmentID)
	}
	cursor := int64(0)
	result := make([]overviewMember, 0)
	for {
		urlValue := fmt.Sprintf("%s/topapi/v2/user/list?access_token=%s", dingTalkBaseURL, url.QueryEscape(token))
		body := map[string]any{"dept_id": deptID, "cursor": cursor, "size": 100, "order_field": "entry_asc"}
		respBody, status, err := executeDingTalkRateLimitedRequest(
			func() {
				waitForDingTalkRequest(
					clientID,
					dingTalkMemberListAPIPath,
					dingTalkMemberListRequestsPerSec,
				)
			},
			time.Sleep,
			func() ([]byte, int, error) {
				return dingtalkDoRequest(http.MethodPost, urlValue, body)
			},
		)
		if err != nil {
			return nil, errors.New("dingtalk member request failed")
		}
		if status != http.StatusOK {
			return nil, fmt.Errorf("dingtalk member request returned http %d", status)
		}
		var response struct {
			Errcode int    `json:"errcode"`
			Errmsg  string `json:"errmsg"`
			Result  struct {
				HasMore    bool  `json:"has_more"`
				NextCursor int64 `json:"next_cursor"`
				List       []struct {
					UserID string `json:"userid"`
					Name   string `json:"name"`
				} `json:"list"`
			} `json:"result"`
		}
		if err := common.Unmarshal(respBody, &response); err != nil {
			return nil, err
		}
		if response.Errcode != 0 {
			return nil, fmt.Errorf("dingtalk member errcode=%d", response.Errcode)
		}
		for _, member := range response.Result.List {
			if member.UserID != "" {
				result = append(result, overviewMember{OpenID: member.UserID, Name: member.Name})
			}
		}
		if !response.Result.HasMore {
			return result, nil
		}
		cursor = response.Result.NextCursor
	}
}
