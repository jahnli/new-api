package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	feishuBaseURL     = "https://open.feishu.cn/open-apis"
	feishuHTTPTimeout = 10 * time.Second
)

type feishuSyncConfig struct {
	AppID     string
	AppSecret string
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
