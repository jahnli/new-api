package service

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	dingTalkBaseURL                      = "https://oapi.dingtalk.com"
	dingTalkHTTPTimeout                  = 10 * time.Second
	dingTalkTokenRefreshMarginSeconds    = 300
	dingTalkDeptRootID                   = int64(1)
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
