package service

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	dingTalkBaseURL                      = "https://oapi.dingtalk.com"
	dingTalkHTTPTimeout                  = 10 * time.Second
	dingTalkTokenRefreshMarginSeconds    = 300
	dingTalkDeptRootID                   = int64(1)
	dingTalkDeptPathMaxDepth             = 20
	dingTalkDepartmentListRequestsPerSec = 30
	dingTalkMemberListRequestsPerSec     = 30
	dingTalkRateLimitRetryAttempts       = 3
	dingTalkRateLimitRetryBaseDelay      = time.Second
	dingTalkDepartmentListAPIPath        = "dingtalk.oapi.v2.department.listsub"
	dingTalkMemberListAPIPath            = "dingtalk.oapi.v2.user.list"
)

// dingtalkTokenEntry caches an access token together with its expiry time.
type dingtalkTokenEntry struct {
	token     string
	expiresAt time.Time
}

var (
	dingtalkTokenCacheMap        = make(map[string]*dingtalkTokenEntry)
	dingtalkTokenCacheMutex      sync.Mutex
	dingTalkLimiterMutex         sync.Mutex
	dingTalkLimiterByAppAndAPI   = make(map[string]<-chan time.Time)
	errDingTalkRateLimitExceeded = errors.New("dingtalk rate limit exceeded after retries")
)

type dingtalkSyncConfig struct {
	ClientID     string
	ClientSecret string
}

// SyncDingTalkUserAsync runs SyncDingTalkUser in a goroutine pool.
// Failures are logged and do not affect the caller.
func SyncDingTalkUserAsync(user *model.User, dingTalkUserID string) {
	if user == nil || user.Id == 0 || dingTalkUserID == "" {
		return
	}
	gopool.Go(func() {
		if err := SyncDingTalkUser(user, dingTalkUserID); err != nil {
			common.SysError(fmt.Sprintf("钉钉字段同步失败 user=%s: %s", user.Username, err.Error()))
		}
	})
}

// SyncDingTalkUser fetches user and department data from the DingTalk API
// and writes the results back to the users table. dingTalkUserID is the
// value from LDAP extensionAttribute12.
//
// API call plan (minimal):
//  1. GET /gettoken                 — access token (package-level cached)
//  2. POST /topapi/v2/user/get      — user detail (name, avatar, email, mobile,
//     job_number, title, manager, hired_date,
//     dept_id_list, leader_in_dept)
//  3. POST /topapi/v2/department/get — one call per unique dept node in the
//     ancestry chain, de-duplicated by a per-sync
//     in-memory cache.
func SyncDingTalkUser(user *model.User, dingTalkUserID string) error {
	if user == nil || user.Username == "" || dingTalkUserID == "" {
		return nil
	}
	if strings.HasPrefix(dingTalkUserID, "ou_") {
		return errors.New("DingTalk user ID must not use the Feishu ou_ prefix")
	}
	cfg, ok := resolveDingTalkSyncConfig(user)
	if !ok {
		return nil
	}

	token, err := dingtalkGetAccessToken(cfg)
	if err != nil {
		return fmt.Errorf("get access_token: %w", err)
	}

	userDetail, err := dingtalkFetchUserDetail(token, dingTalkUserID)
	if err != nil {
		return fmt.Errorf("get user detail: %w", err)
	}

	// Per-sync cache: each dept node is fetched at most once even when multiple
	// departments in the same user share ancestry.
	deptCache := make(map[int64]*dingtalkDeptDetail)

	departments, departmentName, err := buildDingTalkDepartments(token, userDetail, deptCache)
	if err != nil {
		return fmt.Errorf("build departments: %w", err)
	}

	deptsJSON, err := common.Marshal(departments)
	if err != nil {
		return fmt.Errorf("marshal departments: %w", err)
	}

	joinDate := ""
	if userDetail.HiredDate > 0 {
		joinDate = time.UnixMilli(userDetail.HiredDate).UTC().Format("2006-01-02")
	}

	// Prefer org email (enterprise mailbox) over personal email.
	email := userDetail.OrgEmail
	if email == "" {
		email = userDetail.Email
	}

	updates := map[string]any{
		"dingding_id":     dingTalkUserID,
		"avatar_url":      userDetail.Avatar,
		"display_name":    userDetail.Name,
		"mobile":          userDetail.Mobile,
		"job_number":      userDetail.JobNumber,
		"job_title":       userDetail.Title,
		"leader_id":       userDetail.ManagerUserID,
		"join_date":       joinDate,
		"departments":     string(deptsJSON),
		"department_name": departmentName,
	}
	if email != "" {
		updates["email"] = email
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Updates(updates).Error; err != nil {
		return err
	}

	user.DingdingId = dingTalkUserID
	user.AvatarUrl = userDetail.Avatar
	user.DisplayName = userDetail.Name
	if email != "" {
		user.Email = email
	}

	common.SysLog(common.LogText("DingTalk user fields synced user_id=%d dingding_id=%s job_number=%s", user.Id, dingTalkUserID, userDetail.JobNumber))
	return nil
}

func resolveDingTalkSyncConfig(user *model.User) (dingtalkSyncConfig, bool) {
	company := model.NormalizeCompany(user.Company)
	if company == "" {
		return dingtalkSyncConfig{}, false
	}
	companyCfg, ok := system_setting.GetLDAPCompanySyncConfig(company)
	if !ok {
		return dingtalkSyncConfig{}, false
	}
	if companyCfg.SyncPlatform != system_setting.LDAPSyncPlatformDingTalk {
		return dingtalkSyncConfig{}, false
	}
	if companyCfg.DingTalkClientID == "" || companyCfg.DingTalkClientSecret == "" {
		return dingtalkSyncConfig{}, false
	}
	return dingtalkSyncConfig{
		ClientID:     companyCfg.DingTalkClientID,
		ClientSecret: companyCfg.DingTalkClientSecret,
	}, true
}

// --- Token ---

func dingtalkGetAccessToken(cfg dingtalkSyncConfig) (string, error) {
	cacheKey := cfg.ClientID

	dingtalkTokenCacheMutex.Lock()
	defer dingtalkTokenCacheMutex.Unlock()

	if entry, ok := dingtalkTokenCacheMap[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
		return entry.token, nil
	}

	token, expiresIn, err := dingtalkFetchNewToken(cfg.ClientID, cfg.ClientSecret)
	if err != nil {
		return "", err
	}

	safeExpiry := time.Now().Add(time.Duration(expiresIn-dingTalkTokenRefreshMarginSeconds) * time.Second)
	dingtalkTokenCacheMap[cacheKey] = &dingtalkTokenEntry{token: token, expiresAt: safeExpiry}
	return token, nil
}

func invalidateDingTalkAccessToken(clientID string) {
	dingtalkTokenCacheMutex.Lock()
	delete(dingtalkTokenCacheMap, clientID)
	dingtalkTokenCacheMutex.Unlock()
}

func dingtalkFetchNewToken(appKey, appSecret string) (token string, expiresIn int64, err error) {
	url := fmt.Sprintf("%s/gettoken?appkey=%s&appsecret=%s", dingTalkBaseURL, appKey, appSecret)
	respBody, status, reqErr := dingtalkDoRequest(http.MethodGet, url, nil)
	if reqErr != nil {
		return "", 0, reqErr
	}
	if status != http.StatusOK {
		return "", 0, fmt.Errorf("http %d: %s", status, string(respBody))
	}
	var resp struct {
		Errcode     int    `json:"errcode"`
		Errmsg      string `json:"errmsg"`
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return "", 0, fmt.Errorf("decode token response: %w", err)
	}
	if resp.Errcode != 0 {
		return "", 0, fmt.Errorf("dingtalk errcode=%d msg=%s", resp.Errcode, resp.Errmsg)
	}
	return resp.AccessToken, resp.ExpiresIn, nil
}

// --- User detail ---

type dingtalkUserDetail struct {
	UserID        string  `json:"userid"`
	Name          string  `json:"name"`
	Avatar        string  `json:"avatar"`
	Mobile        string  `json:"mobile"`
	Email         string  `json:"email"`
	OrgEmail      string  `json:"org_email"`
	JobNumber     string  `json:"job_number"`
	Title         string  `json:"title"`
	ManagerUserID string  `json:"manager_userid"`
	HiredDate     int64   `json:"hired_date"`
	DeptIDList    []int64 `json:"dept_id_list"`
	LeaderInDept  []struct {
		DeptID int64 `json:"dept_id"`
		Leader bool  `json:"leader"`
	} `json:"leader_in_dept"`
}

func dingtalkFetchUserDetail(token, userID string) (*dingtalkUserDetail, error) {
	url := fmt.Sprintf("%s/topapi/v2/user/get?access_token=%s", dingTalkBaseURL, token)
	body := map[string]any{
		"userid":   userID,
		"language": "zh_CN",
	}
	respBody, status, err := dingtalkDoRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("http %d: %s", status, string(respBody))
	}
	var resp struct {
		Errcode int                `json:"errcode"`
		Errmsg  string             `json:"errmsg"`
		Result  dingtalkUserDetail `json:"result"`
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("decode user detail: %w", err)
	}
	if resp.Errcode != 0 {
		return nil, fmt.Errorf("dingtalk errcode=%d msg=%s", resp.Errcode, resp.Errmsg)
	}
	return &resp.Result, nil
}

// --- Department ---

type dingtalkDeptDetail struct {
	DeptID   int64  `json:"dept_id"`
	Name     string `json:"name"`
	ParentID int64  `json:"parent_id"`
}

func dingtalkFetchDeptDetail(token string, deptID int64, cache map[int64]*dingtalkDeptDetail) (*dingtalkDeptDetail, error) {
	if dept, ok := cache[deptID]; ok {
		return dept, nil
	}
	url := fmt.Sprintf("%s/topapi/v2/department/get?access_token=%s", dingTalkBaseURL, token)
	body := map[string]any{
		"dept_id":  deptID,
		"language": "zh_CN",
	}
	respBody, status, err := dingtalkDoRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("http %d for dept %d: %s", status, deptID, string(respBody))
	}
	var resp struct {
		Errcode int                `json:"errcode"`
		Errmsg  string             `json:"errmsg"`
		Result  dingtalkDeptDetail `json:"result"`
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("decode dept %d: %w", deptID, err)
	}
	if resp.Errcode != 0 {
		return nil, fmt.Errorf("dingtalk dept errcode=%d msg=%s", resp.Errcode, resp.Errmsg)
	}
	cache[deptID] = &resp.Result
	return &resp.Result, nil
}

// buildDingTalkDeptPath walks parent_id from deptID up to the root (dept_id=1),
// collecting each node into a root-to-leaf ordered slice.
// Each node fetched is stored in cache so sibling paths reuse earlier results.
func buildDingTalkDeptPath(token string, leafDeptID int64, cache map[int64]*dingtalkDeptDetail) ([]deptPathSimple, error) {
	var reverseChain []deptPathSimple

	currentID := leafDeptID
	for currentID > dingTalkDeptRootID && len(reverseChain) < dingTalkDeptPathMaxDepth {
		dept, err := dingtalkFetchDeptDetail(token, currentID, cache)
		if err != nil {
			return nil, err
		}
		reverseChain = append(reverseChain, deptPathSimple{
			DepartmentId:   strconv.FormatInt(dept.DeptID, 10),
			DepartmentName: dept.Name,
		})
		currentID = dept.ParentID
	}

	// Reverse so the slice runs from root (outermost) to leaf (innermost).
	for left, right := 0, len(reverseChain)-1; left < right; left, right = left+1, right-1 {
		reverseChain[left], reverseChain[right] = reverseChain[right], reverseChain[left]
	}
	return reverseChain, nil
}

// buildDingTalkDepartments converts the DingTalk user's dept_id_list and
// leader_in_dept into the deptSimplified structure used by GetLeaderDepartmentIDs.
func buildDingTalkDepartments(
	token string,
	userDetail *dingtalkUserDetail,
	deptCache map[int64]*dingtalkDeptDetail,
) ([]deptSimplified, string, error) {
	leaderDeptIDs := make(map[int64]bool, len(userDetail.LeaderInDept))
	for _, entry := range userDetail.LeaderInDept {
		if entry.Leader {
			leaderDeptIDs[entry.DeptID] = true
		}
	}

	departments := make([]deptSimplified, 0, len(userDetail.DeptIDList))
	for _, deptID := range userDetail.DeptIDList {
		dept, err := dingtalkFetchDeptDetail(token, deptID, deptCache)
		if err != nil {
			return nil, "", err
		}

		pathInfos, err := buildDingTalkDeptPath(token, deptID, deptCache)
		if err != nil {
			return nil, "", err
		}

		var leaders []deptLeaderSimple
		if leaderDeptIDs[deptID] {
			leaders = []deptLeaderSimple{{LeaderId: userDetail.UserID}}
		}

		departments = append(departments, deptSimplified{
			DepartmentId:        strconv.FormatInt(dept.DeptID, 10),
			DepartmentPathInfos: pathInfos,
			Leaders:             leaders,
			Name:                dept.Name,
		})
	}

	// department_name: full path of the first department, joined by " / ".
	departmentName := ""
	if len(departments) > 0 {
		names := make([]string, 0, len(departments[0].DepartmentPathInfos))
		for _, p := range departments[0].DepartmentPathInfos {
			names = append(names, p.DepartmentName)
		}
		departmentName = strings.Join(names, " / ")
	}

	return departments, departmentName, nil
}

func executeDingTalkRateLimitedRequest(
	wait func(),
	sleep func(time.Duration),
	request func() ([]byte, int, error),
) ([]byte, int, error) {
	for attempt := 0; attempt < dingTalkRateLimitRetryAttempts; attempt++ {
		wait()
		body, status, err := request()
		if err != nil || status != http.StatusOK || !isDingTalkRateLimitResponse(body) {
			return body, status, err
		}
		if attempt == dingTalkRateLimitRetryAttempts-1 {
			return nil, status, errDingTalkRateLimitExceeded
		}
		delay := dingTalkRateLimitRetryBaseDelay * time.Duration(1<<attempt)
		sleep(delay)
	}
	return nil, 0, errors.New("dingtalk rate limit retry failed")
}

func isDingTalkRateLimitResponse(body []byte) bool {
	var response struct {
		Errcode int    `json:"errcode"`
		Errmsg  string `json:"errmsg"`
		SubCode string `json:"sub_code"`
		Subcode string `json:"subcode"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return false
	}
	if response.Errcode != 88 {
		return false
	}
	return response.SubCode == "90018" ||
		response.Subcode == "90018" ||
		strings.Contains(response.Errmsg, "subcode=90018")
}

func waitForDingTalkRequest(clientID string, apiPath string, requestsPerSecond int) {
	limiterKey := clientID + "\x00" + apiPath
	dingTalkLimiterMutex.Lock()
	ticks, ok := dingTalkLimiterByAppAndAPI[limiterKey]
	if !ok {
		ticks = time.NewTicker(time.Second / time.Duration(requestsPerSecond)).C
		dingTalkLimiterByAppAndAPI[limiterKey] = ticks
	}
	dingTalkLimiterMutex.Unlock()
	<-ticks
}

// --- HTTP helper ---

func dingtalkDoRequest(method, url string, body any) ([]byte, int, error) {
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
		return nil, 0, errors.New("dingtalk request creation failed")
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
	}

	client := &http.Client{Timeout: dingTalkHTTPTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, errors.New("dingtalk request failed")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, errors.New("dingtalk response read failed")
	}
	return respBody, resp.StatusCode, nil
}
