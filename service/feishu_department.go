package service

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/sync/singleflight"
)

// ── Feishu tenant_access_token cache ──────────────────────────────

var (
	tokenMu     sync.RWMutex
	cachedToken string
	tokenExpiry time.Time
)

// feishuGetCachedTenantAccessToken returns a cached token or refreshes it.
// The token is considered expired 60 seconds before the Feishu-reported expiry.
func feishuGetCachedTenantAccessToken() (string, error) {
	tokenMu.RLock()
	if cachedToken != "" && time.Now().Before(tokenExpiry) {
		t := cachedToken
		tokenMu.RUnlock()
		return t, nil
	}
	tokenMu.RUnlock()

	tokenMu.Lock()
	defer tokenMu.Unlock()

	// double-check after acquiring write lock
	if cachedToken != "" && time.Now().Before(tokenExpiry) {
		return cachedToken, nil
	}

	body := map[string]string{
		"app_id":     system_setting.FeishuAppID(),
		"app_secret": system_setting.FeishuAppSecret(),
	}
	respBody, _, err := feishuDoRequest(http.MethodPost, feishuBaseURL+"/auth/v3/tenant_access_token/internal", body, "")
	if err != nil {
		return "", fmt.Errorf("request tenant_access_token: %w", err)
	}
	var resp struct {
		Code              int    `json:"code"`
		Msg               string `json:"msg"`
		TenantAccessToken string `json:"tenant_access_token"`
		Expire            int    `json:"expire"` // seconds
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if resp.Code != 0 {
		return "", fmt.Errorf("feishu code=%d msg=%s", resp.Code, resp.Msg)
	}
	if resp.TenantAccessToken == "" {
		return "", fmt.Errorf("empty tenant_access_token")
	}

	cachedToken = resp.TenantAccessToken
	tokenExpiry = time.Now().Add(time.Duration(resp.Expire)*time.Second - 60*time.Second)
	return cachedToken, nil
}

// ── Feishu department list cache ──────────────────────────────────

const departmentCacheTTL = 5 * time.Minute

// departmentMemberCacheTTL is the TTL for per-department member caches (open_id list and details).
// Using a longer TTL (30 min) since member lists rarely change within short intervals.
const departmentMemberCacheTTL = 30 * time.Minute

type feishuDeptItem struct {
	OpenDepartmentID       string `json:"open_department_id"`
	DepartmentID           string `json:"department_id"`
	Name                   string `json:"name"`
	I18nName               any    `json:"i18n_name"`
	ParentDepartmentID     string `json:"parent_department_id"`
	LeaderUserID           string `json:"leader_user_id"`
	MemberCount            int    `json:"member_count"`
	DirectMemberCount      int    `json:"direct_member_count"`
	ChatID                 string `json:"chat_id"`
	Status                 any    `json:"status"`
	UnitIDs                any    `json:"unit_ids"`
	DepartmentHrbps        any    `json:"department_hrbps"`
	PrimaryMemberCount     int    `json:"primary_member_count"`
	TripartiteMemberCount  int    `json:"tripartite_member_count"`
	DepartmentGroupLeaders any    `json:"department_group_leaders"`
}

type feishuTenantInfo struct {
	Name      string `json:"name"`
	TenantKey string `json:"tenant_key"`
}

var (
	deptCacheMu  sync.RWMutex
	deptCache    []feishuDeptItem
	deptCacheAt  time.Time
	tenantCache  *feishuTenantInfo
	tenantCached bool
)

func getCachedDepartments(token string) ([]feishuDeptItem, error) {
	deptCacheMu.RLock()
	if deptCache != nil && time.Since(deptCacheAt) < departmentCacheTTL {
		result := make([]feishuDeptItem, len(deptCache))
		copy(result, deptCache)
		deptCacheMu.RUnlock()
		return result, nil
	}
	deptCacheMu.RUnlock()

	deptCacheMu.Lock()
	defer deptCacheMu.Unlock()

	// double-check
	if deptCache != nil && time.Since(deptCacheAt) < departmentCacheTTL {
		result := make([]feishuDeptItem, len(deptCache))
		copy(result, deptCache)
		return result, nil
	}

	items, err := feishuFetchAllDepartments(token)
	if err != nil {
		return nil, err
	}

	deptCache = items
	deptCacheAt = time.Now()
	return items, nil
}

func getCachedTenantInfo(token string) (*feishuTenantInfo, error) {
	deptCacheMu.RLock()
	if tenantCached {
		info := tenantCache
		deptCacheMu.RUnlock()
		return info, nil
	}
	deptCacheMu.RUnlock()

	deptCacheMu.Lock()
	defer deptCacheMu.Unlock()

	if tenantCached {
		return tenantCache, nil
	}

	info, err := feishuFetchTenantInfo(token)
	if err != nil {
		return nil, err
	}

	tenantCache = info
	tenantCached = true
	return info, nil
}

// ── Feishu API calls ──────────────────────────────────────────────

const feishuMaxRetries = 2

func feishuFetchAllDepartments(token string) ([]feishuDeptItem, error) {
	var allItems []feishuDeptItem
	pageToken := ""

	for {
		url := feishuBaseURL + "/contact/v3/departments/0/children?" +
			"department_id_type=open_department_id" +
			"&fetch_child=true" +
			"&user_id_type=open_id" +
			"&page_size=50"
		if pageToken != "" {
			url += "&page_token=" + pageToken
		}

		respBody, err := feishuRequestWithRetry(http.MethodGet, url, nil, token)
		if err != nil {
			return nil, fmt.Errorf("fetch departments: %w", err)
		}

		var result feishuAPIResult
		if err := common.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("decode department response: %w", err)
		}
		if result.Code != 0 {
			return nil, fmt.Errorf("feishu code=%d msg=%s", result.Code, result.Msg)
		}

		var page struct {
			HasMore   bool             `json:"has_more"`
			PageToken string           `json:"page_token"`
			Items     []feishuDeptItem `json:"items"`
		}
		if err := common.Unmarshal(result.Data, &page); err != nil {
			return nil, fmt.Errorf("decode department data: %w", err)
		}

		allItems = append(allItems, page.Items...)

		if !page.HasMore {
			break
		}
		pageToken = page.PageToken
	}

	return allItems, nil
}

func feishuFetchTenantInfo(token string) (*feishuTenantInfo, error) {
	url := feishuBaseURL + "/tenant/v2/tenant/query"
	respBody, err := feishuRequestWithRetry(http.MethodGet, url, nil, token)
	if err != nil {
		return nil, fmt.Errorf("fetch tenant info: %w", err)
	}
	var result feishuAPIResult
	if err := common.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode tenant response: %w", err)
	}
	if result.Code != 0 {
		return nil, fmt.Errorf("feishu code=%d msg=%s", result.Code, result.Msg)
	}
	var data struct {
		Tenant struct {
			Name      string `json:"name"`
			TenantKey string `json:"tenant_key"`
		} `json:"tenant"`
	}
	if err := common.Unmarshal(result.Data, &data); err != nil {
		return nil, fmt.Errorf("decode tenant data: %w", err)
	}
	return &feishuTenantInfo{
		Name:      data.Tenant.Name,
		TenantKey: data.Tenant.TenantKey,
	}, nil
}

func feishuRequestWithRetry(method, url string, body any, token string) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt <= feishuMaxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * time.Second)
		}
		respBody, status, err := feishuDoRequest(method, url, body, token)
		if err != nil {
			lastErr = err
			continue
		}
		if status == 429 || status >= 500 {
			lastErr = fmt.Errorf("http %d: %s", status, string(respBody))
			continue
		}
		if status < 200 || status >= 300 {
			return nil, fmt.Errorf("http %d: %s", status, string(respBody))
		}
		return respBody, nil
	}
	return nil, fmt.Errorf("max retries exceeded: %w", lastErr)
}

func SendFeishuCardMessage(openID string, cardJSON string) error {
	token, err := feishuGetCachedTenantAccessToken()
	if err != nil {
		return err
	}

	body := map[string]string{
		"receive_id": openID,
		"msg_type":   "interactive",
		"content":    cardJSON,
	}
	respBody, err := feishuRequestWithRetry(http.MethodPost, feishuBaseURL+"/im/v1/messages?receive_id_type=open_id", body, token)
	if err != nil {
		return err
	}

	var result feishuAPIResult
	if err := common.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("decode message response: %w", err)
	}
	if result.Code != 0 {
		return fmt.Errorf("feishu code=%d msg=%s", result.Code, result.Msg)
	}
	return nil
}

func BuildViolationNoticeCard(requestTime string, requestID string, modelName string) (string, error) {
	if modelName == "" {
		modelName = "-"
	}

	card := map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
		},
		"header": map[string]any{
			"template": "red",
			"title": map[string]string{
				"tag":     "plain_text",
				"content": "安全审计提醒",
			},
		},
		"elements": []map[string]any{
			{
				"tag":     "markdown",
				"content": "你的 API 请求疑似包含非工作或违规内容，请及时调整使用方式。",
			},
			{
				"tag": "div",
				"fields": []map[string]any{
					{
						"is_short": true,
						"text": map[string]string{
							"tag":     "lark_md",
							"content": "**请求时间**\n" + requestTime,
						},
					},
					{
						"is_short": true,
						"text": map[string]string{
							"tag":     "lark_md",
							"content": "**模型**\n" + modelName,
						},
					},
				},
			},
			{
				"tag": "div",
				"text": map[string]string{
					"tag":     "lark_md",
					"content": "**Request ID**\n" + requestID,
				},
			},
			{
				"tag":     "markdown",
				"content": "如误告警，忽略即可",
			},
		},
	}

	data, err := common.Marshal(card)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func BuildOffHoursViolationNoticeCard(requestTime string, requestCount int64) (string, error) {
	card := map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
		},
		"header": map[string]any{
			"template": "red",
			"title": map[string]string{
				"tag":     "plain_text",
				"content": "安全审计提醒",
			},
		},
		"elements": []map[string]any{
			{
				"tag":     "markdown",
				"content": "系统监测到您在非工作时间内较频繁地使用了中转站服务，请确认相关请求，并合理调整使用时间",
			},
			{
				"tag": "div",
				"fields": []map[string]any{
					{
						"is_short": true,
						"text": map[string]string{
							"tag":     "lark_md",
							"content": "**请求时间**\n" + requestTime,
						},
					},
					{
						"is_short": true,
						"text": map[string]string{
							"tag":     "lark_md",
							"content": "**请求次数**\n" + strconv.FormatInt(requestCount, 10),
						},
					},
				},
			},
			{
				"tag":     "markdown",
				"content": "如上述请求属于正常业务使用，忽略即可；如非本人或非预期操作，请及时检查相关账号、密钥及调用配置",
			},
		},
	}

	data, err := common.Marshal(card)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ── Tree building ─────────────────────────────────────────────────

// DeptTreeNode is the frontend-ready tree node.
type DeptTreeNode struct {
	Value        string          `json:"value"`
	Label        string          `json:"label"`
	Disabled     bool            `json:"disabled"`
	Loading      bool            `json:"loading,omitempty"`
	CompanyID    int             `json:"company_id,omitempty"`
	Platform     string          `json:"platform,omitempty"`
	NodeType     string          `json:"node_type,omitempty"`
	DepartmentID string          `json:"department_id,omitempty"`
	Error        string          `json:"error,omitempty"`
	LeaderUserID string          `json:"-"`
	Children     []*DeptTreeNode `json:"children"`
}

func buildDeptTree(items []feishuDeptItem) []*DeptTreeNode {
	nodeMap := make(map[string]*DeptTreeNode, len(items))
	childrenMap := make(map[string][]string, len(items))

	for _, item := range items {
		nodeMap[item.OpenDepartmentID] = &DeptTreeNode{
			Value:        item.OpenDepartmentID,
			Label:        item.Name,
			LeaderUserID: item.LeaderUserID,
			Children:     []*DeptTreeNode{},
		}
		childrenMap[item.ParentDepartmentID] = append(childrenMap[item.ParentDepartmentID], item.OpenDepartmentID)
	}

	var roots []*DeptTreeNode
	for _, item := range items {
		node := nodeMap[item.OpenDepartmentID]
		if childIDs, ok := childrenMap[item.OpenDepartmentID]; ok {
			for _, childID := range childIDs {
				if childNode, exists := nodeMap[childID]; exists {
					node.Children = append(node.Children, childNode)
				}
			}
		}
		// root departments: parent is "0" or parent not in our list
		if item.ParentDepartmentID == "0" || item.ParentDepartmentID == "" {
			roots = append(roots, node)
		} else if _, exists := nodeMap[item.ParentDepartmentID]; !exists {
			roots = append(roots, node)
		}
	}

	return roots
}

// ── Permission trimming ───────────────────────────────────────────

// ParseOverviewDeptIDs returns the configured department node values, removing
// empty and duplicate entries before permission matching.
func ParseOverviewDeptIDs(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	seenValues := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seenValues[value] {
			continue
		}
		seenValues[value] = true
		result = append(result, value)
	}
	return result
}

// trimTreeForUser returns the permission-trimmed tree and the list of department IDs the user leads.
func trimTreeForUser(fullTree []*DeptTreeNode, userRole int, userOpenID string, leaderDeptIDs []string, overviewDeptIDs []string) ([]*DeptTreeNode, []string) {
	// Super admin: full tree, no disabled
	if userRole >= common.RoleRootUser {
		if len(leaderDeptIDs) == 0 {
			leaderDeptIDs = collectAllLeaderDepts(fullTree, userOpenID)
		}
		return fullTree, leaderDeptIDs
	}

	// Admin: leader-based permission trimming
	if userRole >= common.RoleAdminUser {
		if len(leaderDeptIDs) == 0 {
			leaderDeptIDs = collectAllLeaderDepts(fullTree, userOpenID)
		}
		if len(leaderDeptIDs) == 0 {
			return markAllDisabled(fullTree), nil
		}
		leaderSet := make(map[string]bool, len(leaderDeptIDs))
		for _, id := range leaderDeptIDs {
			leaderSet[id] = true
		}
		trimmed := trimNodes(fullTree, leaderSet)
		return trimmed, leaderDeptIDs
	}

	// BP role: scope driven by explicitly configured department node values.
	if userRole == common.RoleBUBP {
		return trimTreeForExplicitDepts(fullTree, overviewDeptIDs)
	}

	// Dept leader (role=1): sees departments where their OpenId is the leader_id.
	if len(leaderDeptIDs) == 0 {
		leaderDeptIDs = collectAllLeaderDepts(fullTree, userOpenID)
	}
	if len(leaderDeptIDs) > 0 {
		leaderSet := make(map[string]bool, len(leaderDeptIDs))
		for _, id := range leaderDeptIDs {
			leaderSet[id] = true
		}
		trimmed := trimNodes(fullTree, leaderSet)
		return trimmed, leaderDeptIDs
	}

	return markAllDisabled(fullTree), nil
}

// trimTreeForExplicitDepts trims the tree so only the explicitly listed node
// values (and their entire sub-trees) are enabled. Used for BP users with
// admin-configured visible departments.
func trimTreeForExplicitDepts(fullTree []*DeptTreeNode, deptNodeValues []string) ([]*DeptTreeNode, []string) {
	if len(deptNodeValues) == 0 {
		return markAllDisabled(fullTree), nil
	}
	targetSet := make(map[string]bool, len(deptNodeValues))
	for _, nodeValue := range deptNodeValues {
		targetSet[nodeValue] = true
	}
	trimmed := trimNodes(fullTree, targetSet)
	return trimmed, deptNodeValues
}

// splitDepartmentName splits "数智产品中心 / AI应用技术部 / AI工程效率科" into
// ["数智产品中心", "AI应用技术部", "AI工程效率科"].
func splitDepartmentName(name string) []string {
	if name == "" {
		return nil
	}
	parts := strings.Split(name, " / ")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// findNodeByLabel searches the tree recursively for a node with the given label.
func findNodeByLabel(nodes []*DeptTreeNode, label string) *DeptTreeNode {
	for _, node := range nodes {
		if node.Label == label {
			return node
		}
		if found := findNodeByLabel(node.Children, label); found != nil {
			return found
		}
	}
	return nil
}

// findNodeByPath walks labels level by level from the given roots, returning the
// node at the end of the path. Unlike findNodeByLabel it requires the full
// ancestor chain, so duplicate names under different parents resolve to the
// branch that actually matches the path.
func findNodeByPath(nodes []*DeptTreeNode, path []string) *DeptTreeNode {
	if len(path) == 0 {
		return nil
	}
	currentNodes := nodes
	var matched *DeptTreeNode
	for _, label := range path {
		matched = nil
		for _, node := range currentNodes {
			if node.Label == label {
				matched = node
				break
			}
		}
		if matched == nil {
			return nil
		}
		currentNodes = matched.Children
	}
	return matched
}

func collectAllLeaderDepts(nodes []*DeptTreeNode, userOpenID string) []string {
	if userOpenID == "" {
		return nil
	}
	var result []string
	var walk func([]*DeptTreeNode)
	walk = func(nodes []*DeptTreeNode) {
		for _, node := range nodes {
			if node.LeaderUserID == userOpenID {
				result = append(result, node.Value)
			}
			walk(node.Children)
		}
	}
	walk(nodes)
	return result
}

func markAllDisabled(nodes []*DeptTreeNode) []*DeptTreeNode {
	result := make([]*DeptTreeNode, len(nodes))
	for i, node := range nodes {
		cloned := *node
		cloned.Disabled = true
		cloned.Children = markAllDisabled(node.Children)
		result[i] = &cloned
	}
	return result
}

// trimNodes returns a tree containing only:
// 1. Nodes where the user is leader → entire subtree enabled
// 2. Ancestor nodes of such nodes → disabled (for path context)
// Branches with no leader nodes are pruned entirely.
func trimNodes(nodes []*DeptTreeNode, leaderSet map[string]bool) []*DeptTreeNode {
	var result []*DeptTreeNode

	for _, node := range nodes {
		if leaderSet[node.Value] {
			// This node and its entire subtree are accessible
			cloned := *node
			cloned.Disabled = false
			cloned.Children = enableSubtree(node.Children)
			result = append(result, &cloned)
		} else {
			// Check if any descendant is a leader node
			trimmedChildren := trimNodes(node.Children, leaderSet)
			if len(trimmedChildren) > 0 {
				cloned := *node
				cloned.Disabled = true
				cloned.Children = trimmedChildren
				result = append(result, &cloned)
			}
		}
	}

	return result
}

func enableSubtree(nodes []*DeptTreeNode) []*DeptTreeNode {
	result := make([]*DeptTreeNode, len(nodes))
	for i, node := range nodes {
		cloned := *node
		cloned.Disabled = false
		cloned.Children = enableSubtree(node.Children)
		result[i] = &cloned
	}
	return result
}

// ── Public API ────────────────────────────────────────────────────

// DepartmentTreeResponse is the API response structure.
type DepartmentTreeResponse struct {
	TreeData      []*DeptTreeNode   `json:"tree_data"`
	LeaderDeptIDs []string          `json:"leader_dept_ids"`
	TenantInfo    *feishuTenantInfo `json:"tenant_info"`
}

// GetDepartmentTree fetches the department tree, caches raw data, and trims by user permissions.
func GetDepartmentTree(userID int, userRole int) (*DepartmentTreeResponse, error) {
	return getCompanyDepartmentTree(userID, userRole)
}

// GetFullDepartmentTree returns the complete department tree for all configured
// companies without any permission trimming. Used by admin users when configuring
// visible departments for BP users.
func GetFullDepartmentTree() (*DepartmentTreeResponse, error) {
	companies, err := model.ListEnabledCompanies()
	if err != nil {
		return nil, fmt.Errorf("get companies: %w", err)
	}

	response := &DepartmentTreeResponse{
		TreeData:      make([]*DeptTreeNode, 0, len(companies)),
		LeaderDeptIDs: []string{},
	}

	for _, company := range companies {
		label := company.Name
		if company.Alias != "" {
			label = company.Alias
		}
		companyNode := &DeptTreeNode{
			Value:     companyNodeValue(company.Id),
			Label:     label,
			CompanyID: company.Id,
			Platform:  company.Platform,
			NodeType:  "company",
			Children:  []*DeptTreeNode{},
		}
		if company.Platform == model.CompanyPlatformNone {
			response.TreeData = append(response.TreeData, companyNode)
			continue
		}
		directory, loadErr := fetchCompanyDirectory(company)
		if loadErr != nil {
			companyNode.Disabled = true
			companyNode.Error = loadErr.Error()
			response.TreeData = append(response.TreeData, companyNode)
			continue
		}
		if directory.OrganizationName != company.Name {
			companyNode.Disabled = true
			companyNode.Error = fmt.Sprintf("organization name %q does not exactly match company name %q", directory.OrganizationName, company.Name)
			response.TreeData = append(response.TreeData, companyNode)
			continue
		}
		companyNode.Children = buildOverviewDepartmentTree(company.Id, company.Platform, directory.Departments)
		response.TreeData = append(response.TreeData, companyNode)
	}

	return response, nil
}

type activeUserThreshold struct {
	RequestCount int64
	TokenCount   int64
	Formula      activeUserThresholdFormula
}

type activeUserThresholdFormula [3]float64

func getActiveUserThreshold(startTimestamp, endTimestamp int64) activeUserThreshold {
	formula := activeUserThresholdFormula{10, 1_000_000, 0.85}
	rawFormula := common.GetEnvOrDefaultString("DATA_OVERVIEW_ACTIVE_USER_THRESHOLD_FORMULA", "")
	if strings.TrimSpace(rawFormula) != "" {
		var configuredFormula activeUserThresholdFormula
		if err := common.UnmarshalJsonStr(rawFormula, &configuredFormula); err != nil {
			common.SysError(fmt.Sprintf("failed to parse DATA_OVERVIEW_ACTIVE_USER_THRESHOLD_FORMULA: %s, using default values", err.Error()))
		} else {
			validFormula := true
			for _, parameter := range configuredFormula {
				if math.IsNaN(parameter) || math.IsInf(parameter, 0) || parameter <= 0 {
					validFormula = false
					break
				}
			}
			if validFormula {
				formula = configuredFormula
			} else {
				common.SysError("DATA_OVERVIEW_ACTIVE_USER_THRESHOLD_FORMULA must contain three positive finite numbers, using default values")
			}
		}
	}

	const secondsPerDay int64 = 24 * 60 * 60
	queryDays := int64(1)
	if startTimestamp > 0 && endTimestamp >= startTimestamp {
		queryDays = (endTimestamp-startTimestamp)/secondsPerDay + 1
	}
	multiplier := math.Pow(float64(queryDays), formula[2])
	return activeUserThreshold{
		RequestCount: int64(math.Ceil(formula[0] * multiplier)),
		TokenCount:   int64(math.Ceil(formula[1] * multiplier)),
		Formula:      formula,
	}
}

// DepartmentStatsRequest is the request body for department stats.
type DepartmentStatsRequest struct {
	CompanyID       int    `json:"company_id"`
	DepartmentID    string `json:"department_id"`
	StartTimestamp  int64  `json:"start_timestamp"`
	EndTimestamp    int64  `json:"end_timestamp"`
	RequestUserID   int    `json:"-"`
	RequestUserRole int    `json:"-"`
}

// DepartmentLogsRequest is the request body for department usage logs.
type DepartmentLogsRequest struct {
	CompanyID         int    `json:"company_id"`
	DepartmentID      string `json:"department_id"`
	StartTimestamp    int64  `json:"start_timestamp"`
	EndTimestamp      int64  `json:"end_timestamp"`
	Page              int    `json:"p"`
	PageSize          int    `json:"page_size"`
	LogType           int    `json:"type"`
	Username          string `json:"username"`
	TokenName         string `json:"token_name"`
	ModelName         string `json:"model_name"`
	Channel           int    `json:"channel"`
	Group             string `json:"group"`
	RequestID         string `json:"request_id"`
	UpstreamRequestID string `json:"upstream_request_id"`
	RequestUserID     int    `json:"-"`
	RequestUserRole   int    `json:"-"`
}

// DepartmentUserLogsRequest is the request body for one user's usage logs.
type DepartmentUserLogsRequest struct {
	CompanyID       int    `json:"company_id"`
	DepartmentID    string `json:"department_id"`
	UserID          int    `json:"user_id"`
	StartTimestamp  int64  `json:"start_timestamp"`
	EndTimestamp    int64  `json:"end_timestamp"`
	Page            int    `json:"p"`
	PageSize        int    `json:"page_size"`
	RequestUserID   int    `json:"-"`
	RequestUserRole int    `json:"-"`
}

// GetDepartmentLogs fetches usage logs for registered users under a department.
func GetDepartmentLogs(req *DepartmentLogsRequest) (*common.PageInfo, error) {
	return getCompanyDepartmentLogs(req)
}

// GetDepartmentUserLogs fetches logs by immutable user ID for the user statistics dialog.
func GetDepartmentUserLogs(req *DepartmentUserLogsRequest) (*common.PageInfo, error) {
	if err := authorizeCompanyOverviewUser(req.CompanyID, req.DepartmentID, req.UserID, req.RequestUserID, req.RequestUserRole); err != nil {
		return nil, err
	}
	pageInfo := departmentLogsPageInfo(req.Page, req.PageSize)
	logs, total, err := model.GetLogsByUserIds(
		[]int{req.UserID},
		model.LogTypeUnknown,
		req.StartTimestamp,
		req.EndTimestamp,
		"",
		"",
		"",
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
		0,
		"",
		"",
		"",
	)
	if err != nil {
		return nil, err
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	return pageInfo, nil
}

func departmentLogsPageInfo(page int, pageSize int) *common.PageInfo {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return &common.PageInfo{Page: page, PageSize: pageSize}
}

// GetDepartmentStats fetches stats for users belonging to a department (and its sub-departments).
// It uses the Feishu Users API to get the real-time member list of each department,
// then matches open_id against the user table to find registered usernames,
// and finally aggregates logs for those usernames.
func GetDepartmentStats(req *DepartmentStatsRequest) (*model.DepartmentStat, error) {
	return getCompanyDepartmentStats(req)
}

// SubDepartmentStatItem holds stats for one sub-department.
type SubDepartmentStatItem struct {
	DepartmentID             string  `json:"department_id"`
	DepartmentName           string  `json:"department_name"`
	RegisteredUsers          int64   `json:"registered_users"`
	TotalUsers               int64   `json:"total_users"`
	TotalQuota               int64   `json:"total_quota"`
	TotalAmountCNY           float64 `json:"total_amount_cny"`
	UnitPricePer100MTokens   float64 `json:"unit_price_per_100m_tokens"`
	TotalTokens              int64   `json:"total_tokens"`
	TotalRequests            int64   `json:"total_requests"`
	ActiveUsers              int64   `json:"active_users"`
	ActiveUserRate           float64 `json:"active_user_rate"`
	AvgTokensPerActiveUserMT float64 `json:"avg_tokens_per_active_user_mt"`
}

// GetSubDepartmentStats returns per-child-department statistics for the given parent department.
func GetSubDepartmentStats(req *DepartmentStatsRequest) ([]SubDepartmentStatItem, error) {
	return getCompanySubDepartmentStats(req)
}

// getDirectChildren returns the immediate child departments of the given parent.
func getDirectChildren(items []feishuDeptItem, parentOpenDeptID string) []feishuDeptItem {
	if parentOpenDeptID == "__tenant__" {
		knownIDs := make(map[string]bool, len(items))
		for _, item := range items {
			knownIDs[item.OpenDepartmentID] = true
		}
		var roots []feishuDeptItem
		for _, item := range items {
			if item.ParentDepartmentID == "0" || item.ParentDepartmentID == "" || !knownIDs[item.ParentDepartmentID] {
				roots = append(roots, item)
			}
		}
		return roots
	}
	var children []feishuDeptItem
	for _, item := range items {
		if item.ParentDepartmentID == parentOpenDeptID {
			children = append(children, item)
		}
	}
	return children
}

// collectOpenDeptIDsUnder returns the open_department_id values for a given open_department_id
// and all its descendants. If deptOpenID is "__tenant__", returns all open_department_ids.
func collectOpenDeptIDsUnder(items []feishuDeptItem, deptOpenID string) []string {
	if deptOpenID == "__tenant__" {
		ids := make([]string, 0, len(items))
		for _, item := range items {
			ids = append(ids, item.OpenDepartmentID)
		}
		return ids
	}

	childrenMap := make(map[string][]string, len(items))
	knownIDs := make(map[string]bool, len(items))
	for _, item := range items {
		childrenMap[item.ParentDepartmentID] = append(childrenMap[item.ParentDepartmentID], item.OpenDepartmentID)
		knownIDs[item.OpenDepartmentID] = true
	}

	var result []string
	queue := []string{deptOpenID}
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		if knownIDs[curr] {
			result = append(result, curr)
		}
		queue = append(queue, childrenMap[curr]...)
	}
	return result
}

// deptMembersCacheEntry holds cached open_id list for one department.
type deptMembersCacheEntry struct {
	openIDs  []string
	cachedAt time.Time
}

type deptMemberDetailsCacheEntry struct {
	members  []feishuDeptMember
	cachedAt time.Time
}

type feishuDeptMember struct {
	OpenID string `json:"open_id"`
	Name   string `json:"name"`
}

var deptMembersCache sync.Map
var deptMemberDetailsCache sync.Map

// deptMembersSF suppresses duplicate concurrent fetches for the same department.
var deptMembersSF singleflight.Group

func getCachedDepartmentMembers(token, openDeptID string) ([]string, error) {
	if v, ok := deptMembersCache.Load(openDeptID); ok {
		entry := v.(deptMembersCacheEntry)
		if time.Since(entry.cachedAt) < departmentMemberCacheTTL {
			return entry.openIDs, nil
		}
	}
	// singleflight: 相同 deptID 的并发请求只发一次飞书 API，防止缓存击穿
	v, err, _ := deptMembersSF.Do(openDeptID, func() (any, error) {
		return fetchDepartmentMembers(token, openDeptID)
	})
	if err != nil {
		return nil, err
	}
	openIDs := v.([]string)
	deptMembersCache.Store(openDeptID, deptMembersCacheEntry{openIDs: openIDs, cachedAt: time.Now()})
	return openIDs, nil
}

func fetchDepartmentMembers(token, openDeptID string) ([]string, error) {
	var allOpenIDs []string
	pageToken := ""
	for {
		url := feishuBaseURL + "/contact/v3/users?department_id=" + openDeptID +
			"&user_id_type=open_id&department_id_type=open_department_id&page_size=50"
		if pageToken != "" {
			url += "&page_token=" + pageToken
		}
		respBody, err := feishuRequestWithRetry(http.MethodGet, url, nil, token)
		if err != nil {
			return nil, fmt.Errorf("fetch department members: %w", err)
		}
		var result feishuAPIResult
		if err := common.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("decode members response: %w", err)
		}
		if result.Code != 0 {
			return nil, fmt.Errorf("feishu code=%d msg=%s", result.Code, result.Msg)
		}
		var page struct {
			HasMore   bool   `json:"has_more"`
			PageToken string `json:"page_token"`
			Items     []struct {
				OpenID string `json:"open_id"`
			} `json:"items"`
		}
		if err := common.Unmarshal(result.Data, &page); err != nil {
			return nil, fmt.Errorf("decode members data: %w", err)
		}
		for _, item := range page.Items {
			if item.OpenID != "" {
				allOpenIDs = append(allOpenIDs, item.OpenID)
			}
		}
		if !page.HasMore {
			break
		}
		pageToken = page.PageToken
	}
	return allOpenIDs, nil
}

func getCachedDepartmentMemberDetails(token, openDeptID string) ([]feishuDeptMember, error) {
	if v, ok := deptMemberDetailsCache.Load(openDeptID); ok {
		entry := v.(deptMemberDetailsCacheEntry)
		if time.Since(entry.cachedAt) < departmentMemberCacheTTL {
			return entry.members, nil
		}
	}

	v, err, _ := deptMembersSF.Do(openDeptID+":details", func() (any, error) {
		return fetchDepartmentMemberDetails(token, openDeptID)
	})
	if err != nil {
		return nil, err
	}
	members := v.([]feishuDeptMember)
	deptMemberDetailsCache.Store(openDeptID, deptMemberDetailsCacheEntry{members: members, cachedAt: time.Now()})
	return members, nil
}

func fetchDepartmentMemberDetails(token, openDeptID string) ([]feishuDeptMember, error) {
	var allMembers []feishuDeptMember
	pageToken := ""
	for {
		url := feishuBaseURL + "/contact/v3/users/find_by_department?department_id=" + openDeptID +
			"&user_id_type=open_id&department_id_type=open_department_id&page_size=50"
		if pageToken != "" {
			url += "&page_token=" + pageToken
		}
		respBody, err := feishuRequestWithRetry(http.MethodGet, url, nil, token)
		if err != nil {
			return nil, fmt.Errorf("fetch department member details: %w", err)
		}
		var result feishuAPIResult
		if err := common.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("decode member details response: %w", err)
		}
		if result.Code != 0 {
			return nil, fmt.Errorf("feishu code=%d msg=%s", result.Code, result.Msg)
		}
		var page struct {
			HasMore   bool               `json:"has_more"`
			PageToken string             `json:"page_token"`
			Items     []feishuDeptMember `json:"items"`
		}
		if err := common.Unmarshal(result.Data, &page); err != nil {
			return nil, fmt.Errorf("decode member details data: %w", err)
		}
		allMembers = append(allMembers, page.Items...)
		if !page.HasMore {
			break
		}
		pageToken = page.PageToken
	}
	return allMembers, nil
}

// deptMembersFetchConcurrency limits how many departments are fetched
// from the Feishu API in parallel.
const deptMembersFetchConcurrency = 5

func getAllMembersUnderDepts(token string, openDeptIDs []string) ([]string, error) {
	seen := make(map[string]bool)
	var result []string
	var mu sync.Mutex
	var firstErr error
	var errOnce sync.Once

	sem := make(chan struct{}, deptMembersFetchConcurrency)
	var wg sync.WaitGroup

	for _, deptID := range openDeptIDs {
		wg.Add(1)
		go func(deptID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			// singleflight in getCachedDepartmentMembers ensures concurrent
			// calls for the same deptID share one Feishu API fetch
			members, err := getCachedDepartmentMembers(token, deptID)
			if err != nil {
				errOnce.Do(func() { firstErr = err })
				return
			}

			mu.Lock()
			for _, openID := range members {
				if !seen[openID] {
					seen[openID] = true
					result = append(result, openID)
				}
			}
			mu.Unlock()
		}(deptID)
	}
	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}
	return result, nil
}

func findRegisteredUserIdsByOpenIDs(openIDs []string, registeredBefore int64) ([]int, error) {
	if len(openIDs) == 0 {
		return nil, nil
	}
	query := model.DB.Model(&model.User{}).
		Select("id").
		Where("open_id IN ?", openIDs)
	if registeredBefore > 0 {
		query = query.Where("created_at <= ?", registeredBefore)
	}
	var userIds []int
	if err := query.Scan(&userIds).Error; err != nil {
		return nil, err
	}
	return userIds, nil
}

// UsageAnalysisResponse holds all usage analysis data returned in one response.
type UsageAnalysisResponse struct {
	ModelStats            []model.ModelStatRow      `json:"model_stats"`
	ModelSeriesStats      []model.ModelStatRow      `json:"model_series_stats"`
	DailyStats            []model.DailyStatRow      `json:"daily_stats"`
	ModelDailyStats       []model.ModelDailyStatRow `json:"model_daily_stats"`
	ModelSeriesDailyStats []model.ModelDailyStatRow `json:"model_series_daily_stats"`
	QuotaToCNY            float64                   `json:"quota_to_cny"`
}

const usageAnalysisModelLimit = 10

var dataOverviewModelMapping = sync.OnceValue(func() map[string]string {
	raw := common.GetEnvOrDefaultString("DATA_OVERVIEW_MODEL_MAPPING", "")
	mapping, err := parseDataOverviewModelMapping(raw)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to parse DATA_OVERVIEW_MODEL_MAPPING: %s, model names will not be merged", err.Error()))
		return nil
	}
	return mapping
})

type dataOverviewModelSeriesKeyword struct {
	displayName string
	keyword     string
}

var dataOverviewModelSeriesKeywords = sync.OnceValue(func() []dataOverviewModelSeriesKeyword {
	raw := common.GetEnvOrDefaultString("DATA_OVERVIEW_MODEL_SERIES_KEYWORDS", "")
	keywords, err := parseDataOverviewModelSeriesKeywords(raw)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to parse DATA_OVERVIEW_MODEL_SERIES_KEYWORDS: %s, model series statistics will be empty", err.Error()))
		return nil
	}
	return keywords
})

func parseDataOverviewModelSeriesKeywords(raw string) ([]dataOverviewModelSeriesKeyword, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var configured map[string][]string
	if err := common.UnmarshalJsonStr(raw, &configured); err != nil {
		return nil, err
	}

	canonicalNames := make(map[string]string, len(configured))
	for displayName := range configured {
		displayName = strings.TrimSpace(displayName)
		if displayName == "" {
			return nil, fmt.Errorf("model series display name cannot be empty")
		}
		normalizedDisplayName := strings.ToLower(displayName)
		if existing, ok := canonicalNames[normalizedDisplayName]; ok && existing != displayName {
			return nil, fmt.Errorf("model series display names %q and %q differ only by case", existing, displayName)
		}
		canonicalNames[normalizedDisplayName] = displayName
	}

	keywordOwners := make(map[string]string)
	keywords := make([]dataOverviewModelSeriesKeyword, 0)
	for displayName, configuredKeywords := range configured {
		canonicalName := canonicalNames[strings.ToLower(strings.TrimSpace(displayName))]
		if len(configuredKeywords) == 0 {
			return nil, fmt.Errorf("model series %q must contain at least one keyword", canonicalName)
		}
		for _, keyword := range configuredKeywords {
			keyword = strings.ToLower(strings.TrimSpace(keyword))
			if keyword == "" {
				return nil, fmt.Errorf("model series keyword for %q cannot be empty", canonicalName)
			}
			if existing, ok := keywordOwners[keyword]; ok {
				return nil, fmt.Errorf("model series keyword %q is assigned more than once to %q and %q", keyword, existing, canonicalName)
			}
			keywordOwners[keyword] = canonicalName
			keywords = append(keywords, dataOverviewModelSeriesKeyword{
				displayName: canonicalName,
				keyword:     keyword,
			})
		}
	}

	sort.Slice(keywords, func(i, j int) bool {
		if len(keywords[i].keyword) != len(keywords[j].keyword) {
			return len(keywords[i].keyword) > len(keywords[j].keyword)
		}
		if keywords[i].displayName != keywords[j].displayName {
			return keywords[i].displayName < keywords[j].displayName
		}
		return keywords[i].keyword < keywords[j].keyword
	})
	return keywords, nil
}

func parseDataOverviewModelMapping(raw string) (map[string]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var configured map[string][]string
	if err := common.UnmarshalJsonStr(raw, &configured); err != nil {
		return nil, err
	}

	canonicalNames := make(map[string]string, len(configured))
	for displayName := range configured {
		displayName = strings.TrimSpace(displayName)
		if displayName == "" {
			return nil, fmt.Errorf("mapping display name cannot be empty")
		}
		normalizedDisplayName := strings.ToLower(displayName)
		if existing, ok := canonicalNames[normalizedDisplayName]; ok && existing != displayName {
			return nil, fmt.Errorf("mapping display names %q and %q differ only by case", existing, displayName)
		}
		canonicalNames[normalizedDisplayName] = displayName
	}

	mapping := make(map[string]string, len(configured))
	for displayName, aliases := range configured {
		canonicalName := canonicalNames[strings.ToLower(strings.TrimSpace(displayName))]
		names := make([]string, 0, len(aliases)+1)
		names = append(names, canonicalName)
		names = append(names, aliases...)
		for _, source := range names {
			source = strings.TrimSpace(source)
			if source == "" {
				return nil, fmt.Errorf("model alias for %q cannot be empty", canonicalName)
			}

			normalizedSource := strings.ToLower(source)
			if existing, ok := mapping[normalizedSource]; ok && existing != canonicalName {
				return nil, fmt.Errorf("model alias %q is assigned to both %q and %q", source, existing, canonicalName)
			}
			mapping[normalizedSource] = canonicalName
		}
	}

	return mapping, nil
}

func usageAnalysisModelName(modelName string, mapping map[string]string) string {
	modelName = strings.TrimSpace(modelName)
	if mapped, ok := mapping[strings.ToLower(modelName)]; ok {
		return mapped
	}
	return modelName
}

func usageAnalysisModelSeriesName(modelName string, keywords []dataOverviewModelSeriesKeyword) (string, bool) {
	normalizedModelName := strings.ToLower(strings.TrimSpace(modelName))
	if normalizedModelName == "" {
		return "", false
	}
	for _, candidate := range keywords {
		if strings.Contains(normalizedModelName, candidate.keyword) {
			return candidate.displayName, true
		}
	}
	return "", false
}

func mergeUsageAnalysisModelSeriesStats(rows []model.ModelStatRow, keywords []dataOverviewModelSeriesKeyword) []model.ModelStatRow {
	aggregated := make(map[string]*model.ModelStatRow)
	for _, row := range rows {
		seriesName, ok := usageAnalysisModelSeriesName(row.ModelName, keywords)
		if !ok {
			continue
		}
		current, ok := aggregated[seriesName]
		if !ok {
			current = &model.ModelStatRow{ModelName: seriesName}
			aggregated[seriesName] = current
		}
		current.TotalTokens += row.TotalTokens
		current.TotalQuota += row.TotalQuota
		current.TotalReqs += row.TotalReqs
		current.UncachedInputTokens += row.UncachedInputTokens
		current.CacheReadTokens += row.CacheReadTokens
		current.CacheWriteTokens += row.CacheWriteTokens
	}

	merged := make([]model.ModelStatRow, 0, len(aggregated))
	for _, row := range aggregated {
		merged = append(merged, *row)
	}
	sort.Slice(merged, func(i, j int) bool {
		if merged[i].TotalQuota != merged[j].TotalQuota {
			return merged[i].TotalQuota > merged[j].TotalQuota
		}
		return merged[i].ModelName < merged[j].ModelName
	})
	return merged
}

func mergeUsageAnalysisModelStats(rows []model.ModelStatRow, mapping map[string]string, limit int) []model.ModelStatRow {
	aggregated := make(map[string]*model.ModelStatRow, len(rows))
	for _, row := range rows {
		modelName := usageAnalysisModelName(row.ModelName, mapping)
		current, ok := aggregated[modelName]
		if !ok {
			current = &model.ModelStatRow{ModelName: modelName}
			aggregated[modelName] = current
		}
		current.TotalTokens += row.TotalTokens
		current.TotalQuota += row.TotalQuota
		current.TotalReqs += row.TotalReqs
		current.UncachedInputTokens += row.UncachedInputTokens
		current.CacheReadTokens += row.CacheReadTokens
		current.CacheWriteTokens += row.CacheWriteTokens
	}

	merged := make([]model.ModelStatRow, 0, len(aggregated))
	for _, row := range aggregated {
		merged = append(merged, *row)
	}
	sort.Slice(merged, func(i, j int) bool {
		if merged[i].TotalQuota != merged[j].TotalQuota {
			return merged[i].TotalQuota > merged[j].TotalQuota
		}
		return merged[i].ModelName < merged[j].ModelName
	})
	if limit > 0 && len(merged) > limit {
		merged = merged[:limit]
	}
	return merged
}

func mergeUsageAnalysisModelDailyStats(rows []model.ModelDailyStatRow, mapping map[string]string) []model.ModelDailyStatRow {
	type dailyModelKey struct {
		date      string
		modelName string
	}

	aggregated := make(map[dailyModelKey]model.ModelDailyStatRow, len(rows))
	for _, row := range rows {
		key := dailyModelKey{
			date:      row.Date,
			modelName: usageAnalysisModelName(row.ModelName, mapping),
		}
		current := aggregated[key]
		current.TotalTokens += row.TotalTokens
		current.TotalQuota += row.TotalQuota
		aggregated[key] = current
	}

	merged := make([]model.ModelDailyStatRow, 0, len(aggregated))
	for key, totals := range aggregated {
		merged = append(merged, model.ModelDailyStatRow{
			Date:        key.date,
			ModelName:   key.modelName,
			TotalTokens: totals.TotalTokens,
			TotalQuota:  totals.TotalQuota,
		})
	}
	sort.Slice(merged, func(i, j int) bool {
		if merged[i].Date != merged[j].Date {
			return merged[i].Date < merged[j].Date
		}
		return merged[i].ModelName < merged[j].ModelName
	})
	return merged
}

func buildUsageAnalysisForUsers(userIds []int, startTimestamp, endTimestamp int64) (*UsageAnalysisResponse, error) {
	var (
		rawModelStats []model.ModelStatRow
		dailyStats    []model.DailyStatRow
		modelErr      error
		dailyErr      error
		wg            sync.WaitGroup
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		rawModelStats, modelErr = model.GetModelStats(userIds, startTimestamp, endTimestamp, 0)
	}()
	go func() {
		defer wg.Done()
		dailyStats, dailyErr = model.GetDailyStats(userIds, startTimestamp, endTimestamp)
	}()
	wg.Wait()

	if modelErr != nil {
		return nil, modelErr
	}
	if dailyErr != nil {
		return nil, dailyErr
	}

	mapping := dataOverviewModelMapping()
	modelStats := mergeUsageAnalysisModelStats(rawModelStats, mapping, usageAnalysisModelLimit)
	seriesKeywords := dataOverviewModelSeriesKeywords()
	modelSeriesStats := mergeUsageAnalysisModelSeriesStats(rawModelStats, seriesKeywords)
	topModels := make(map[string]struct{}, len(modelStats))
	for _, row := range modelStats {
		topModels[row.ModelName] = struct{}{}
	}
	selectedRawModelNames := make([]string, 0, len(rawModelStats))
	seriesMapping := make(map[string]string)
	for _, row := range rawModelStats {
		seriesName, matchesSeries := usageAnalysisModelSeriesName(row.ModelName, seriesKeywords)
		if matchesSeries {
			seriesMapping[strings.ToLower(strings.TrimSpace(row.ModelName))] = seriesName
		}
		if _, ok := topModels[usageAnalysisModelName(row.ModelName, mapping)]; ok || matchesSeries {
			selectedRawModelNames = append(selectedRawModelNames, row.ModelName)
		}
	}

	rawModelDailyStats, err := model.GetModelDailyStatsForModels(userIds, startTimestamp, endTimestamp, selectedRawModelNames)
	if err != nil {
		return nil, err
	}
	// Series include every matching model, independent of the top-model limit.
	topModelDailyStats := make([]model.ModelDailyStatRow, 0, len(rawModelDailyStats))
	seriesDailyStats := make([]model.ModelDailyStatRow, 0, len(rawModelDailyStats))
	for _, row := range rawModelDailyStats {
		if _, ok := topModels[usageAnalysisModelName(row.ModelName, mapping)]; ok {
			topModelDailyStats = append(topModelDailyStats, row)
		}
		if _, ok := seriesMapping[strings.ToLower(strings.TrimSpace(row.ModelName))]; ok {
			seriesDailyStats = append(seriesDailyStats, row)
		}
	}
	modelDailyStats := mergeUsageAnalysisModelDailyStats(topModelDailyStats, mapping)
	modelSeriesDailyStats := mergeUsageAnalysisModelDailyStats(seriesDailyStats, seriesMapping)

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}
	usdExchangeRate := operation_setting.USDExchangeRate
	if usdExchangeRate <= 0 {
		usdExchangeRate = 1
	}

	return &UsageAnalysisResponse{
		ModelStats:            modelStats,
		ModelSeriesStats:      modelSeriesStats,
		DailyStats:            dailyStats,
		ModelDailyStats:       modelDailyStats,
		ModelSeriesDailyStats: modelSeriesDailyStats,
		QuotaToCNY:            usdExchangeRate / quotaPerUnit,
	}, nil
}

// GetUsageAnalysis fetches model ranking and daily trend for the selected department.
func GetUsageAnalysis(req *DepartmentStatsRequest) (*UsageAnalysisResponse, error) {
	return getCompanyUsageAnalysis(req)
}

// UserUsageAnalysisRequest holds the request params for single-user usage analysis.
type UserUsageAnalysisRequest struct {
	CompanyID       int    `json:"company_id"`
	DepartmentID    string `json:"department_id"`
	UserID          int    `json:"user_id"`
	StartTimestamp  int64  `json:"start_timestamp"`
	EndTimestamp    int64  `json:"end_timestamp"`
	RequestUserID   int    `json:"-"`
	RequestUserRole int    `json:"-"`
}

// GetUserUsageAnalysis fetches model ranking and daily trend for a single user.
func GetUserUsageAnalysis(req *UserUsageAnalysisRequest) (*UsageAnalysisResponse, error) {
	if err := authorizeCompanyOverviewUser(req.CompanyID, req.DepartmentID, req.UserID, req.RequestUserID, req.RequestUserRole); err != nil {
		return nil, err
	}
	return buildUsageAnalysisForUsers([]int{req.UserID}, req.StartTimestamp, req.EndTimestamp)
}

// DepartmentUsersRequest holds the request params for fetching department user list.
type DepartmentUsersRequest struct {
	CompanyID           int    `json:"company_id"`
	DepartmentID        string `json:"department_id"`
	StartTimestamp      int64  `json:"start_timestamp"`
	EndTimestamp        int64  `json:"end_timestamp"`
	Page                int    `json:"page"`
	PageSize            int    `json:"page_size"`
	SortBy              string `json:"sort_by"`
	SortOrder           string `json:"sort_order"`
	RegistrationStatus  string `json:"registration_status"`
	Role                int    `json:"role"`
	IncludeUnregistered bool   `json:"include_unregistered"`
	RequestUserID       int    `json:"-"`
	RequestUserRole     int    `json:"-"`
}

const (
	departmentRegistrationStatusRegistered   = "registered"
	departmentRegistrationStatusUnregistered = "unregistered"
	departmentRegistrationStatusDeparted     = "departed"
)

// DepartmentUserItem holds user info with stats for a specific time range.
type DepartmentUserItem struct {
	*model.User
	HasActiveSubscription  bool    `json:"has_active_subscription"`
	TotalAmountCNY         float64 `json:"total_amount_cny"`
	UnitPricePer100MTokens float64 `json:"unit_price_per_100m_tokens"`
	TotalTokens            int64   `json:"total_tokens"`
	TotalRequests          int64   `json:"total_requests"`
	CommonModel            string  `json:"common_model"`
	IsRegistered           bool    `json:"is_registered"`
	RegistrationStatus     string  `json:"registration_status"`
	SubQuotaUsed           int64   `json:"sub_quota_used"`
	SubQuotaTotal          int64   `json:"sub_quota_total"`
}

func buildUnregisteredDepartmentUser(openID string, member feishuDeptMember) *model.User {
	displayName := member.Name
	if displayName == "" {
		displayName = "-"
	}
	return &model.User{
		Id:          0,
		Username:    displayName,
		DisplayName: displayName,
		OpenId:      openID,
		Status:      0,
	}
}

func isDepartmentUserRegisteredAt(user *model.User, endTimestamp int64) bool {
	return user != nil && (endTimestamp <= 0 || user.CreatedAt <= endTimestamp)
}

func getDepartmentUserRegistrationStatus(user *model.User, endTimestamp int64) string {
	if !isDepartmentUserRegisteredAt(user, endTimestamp) {
		return departmentRegistrationStatusUnregistered
	}
	if user.Status == common.UserStatusDisabled {
		return departmentRegistrationStatusDeparted
	}
	return departmentRegistrationStatusRegistered
}

func departmentUserRegistrationCounts(users []*model.User, totalUsers int, endTimestamp int64) (int64, int64) {
	registeredUsers := int64(0)
	for _, user := range users {
		if isDepartmentUserRegisteredAt(user, endTimestamp) {
			registeredUsers++
		}
	}
	unregisteredUsers := int64(totalUsers) - registeredUsers
	if unregisteredUsers < 0 {
		unregisteredUsers = 0
	}
	return registeredUsers, unregisteredUsers
}

func mergeDepartmentUsersWithMembers(users []*model.User, memberOpenIDs []string, memberDetails map[string]feishuDeptMember, endTimestamp int64, includeUnregistered bool, registrationStatus string) []DepartmentUserItem {
	userMap := make(map[string]*model.User, len(users))
	for _, u := range users {
		if u.OpenId != "" {
			userMap[u.OpenId] = u
		}
	}

	result := make([]DepartmentUserItem, 0, len(memberOpenIDs)+len(users))
	seen := make(map[string]bool, len(memberOpenIDs))
	seenUserIDs := make(map[int]bool, len(users))
	for _, openID := range memberOpenIDs {
		if openID == "" || seen[openID] {
			continue
		}
		seen[openID] = true
		if u, ok := userMap[openID]; ok {
			userRegistrationStatus := getDepartmentUserRegistrationStatus(u, endTimestamp)
			isRegistered := userRegistrationStatus != departmentRegistrationStatusUnregistered
			if registrationStatus != "" && registrationStatus != userRegistrationStatus {
				continue
			}
			if !isRegistered && !includeUnregistered {
				continue
			}
			result = append(result, DepartmentUserItem{
				User:               u,
				IsRegistered:       isRegistered,
				RegistrationStatus: userRegistrationStatus,
			})
			seenUserIDs[u.Id] = true
			continue
		}
		if !includeUnregistered || (registrationStatus != "" && registrationStatus != departmentRegistrationStatusUnregistered) {
			continue
		}
		result = append(result, DepartmentUserItem{
			User:               buildUnregisteredDepartmentUser(openID, memberDetails[openID]),
			RegistrationStatus: departmentRegistrationStatusUnregistered,
		})
	}
	// Members resolved from a cost center (or any local-only source) may carry
	// an empty open_id and therefore never appear in memberOpenIDs. Append the
	// registered users whose open_id is empty and were not already covered by an
	// open_id match above, so the department user list reflects the full
	// audience resolved in matchOverviewDepartmentMembers.
	for _, u := range users {
		if u.OpenId != "" || u.Id <= 0 || seenUserIDs[u.Id] {
			continue
		}
		userRegistrationStatus := getDepartmentUserRegistrationStatus(u, endTimestamp)
		isRegistered := userRegistrationStatus != departmentRegistrationStatusUnregistered
		if registrationStatus != "" && registrationStatus != userRegistrationStatus {
			continue
		}
		if !isRegistered && !includeUnregistered {
			continue
		}
		result = append(result, DepartmentUserItem{
			User:               u,
			IsRegistered:       isRegistered,
			RegistrationStatus: userRegistrationStatus,
		})
		seenUserIDs[u.Id] = true
	}
	return result
}

func sortDepartmentUserItems(items []DepartmentUserItem, sortBy string, sortOrder string) {
	desc := sortOrder == "desc" || (sortBy == "" && sortOrder == "")
	sort.Slice(items, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "sub_quota_used":
			less = items[i].SubQuotaUsed < items[j].SubQuotaUsed
		case "total_amount_cny":
			less = items[i].TotalAmountCNY < items[j].TotalAmountCNY
		case "unit_price_per_100m_tokens":
			less = items[i].UnitPricePer100MTokens < items[j].UnitPricePer100MTokens
		case "total_tokens":
			less = items[i].TotalTokens < items[j].TotalTokens
		case "total_requests":
			less = items[i].TotalRequests < items[j].TotalRequests
		default:
			less = items[i].User.Id < items[j].User.Id
		}
		if desc {
			return !less
		}
		return less
	})
}

// DepartmentUsersResponse holds paginated department user list.
type DepartmentUsersResponse struct {
	Items             []DepartmentUserItem `json:"items"`
	Total             int64                `json:"total"`
	Page              int                  `json:"page"`
	Size              int                  `json:"page_size"`
	TotalUsers        int64                `json:"total_users"`
	RegisteredUsers   int64                `json:"registered_users"`
	UnregisteredUsers int64                `json:"unregistered_users"`
}

// GetDepartmentUsers returns paginated user list for a department with stats in the given time range.
func GetDepartmentUsers(req *DepartmentUsersRequest) (*DepartmentUsersResponse, error) {
	return getCompanyDepartmentUsers(req)
}

// UserRankingItem holds a single user's ranking info for charts.
type UserRankingItem struct {
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	TotalCost   float64 `json:"total_cost"`
	TotalTokens int64   `json:"total_tokens"`
}

// GetDepartmentUserRankings returns top 10 users by consumption for the given department and time range.
func GetDepartmentUserRankings(req *DepartmentUsersRequest) ([]UserRankingItem, error) {
	return getCompanyDepartmentUserRankings(req)
}

func getAllMemberDetailsUnderDepts(token string, openDeptIDs []string) ([]feishuDeptMember, error) {
	seen := make(map[string]bool)
	var result []feishuDeptMember
	var mu sync.Mutex
	var firstErr error
	var errOnce sync.Once

	sem := make(chan struct{}, deptMembersFetchConcurrency)
	var wg sync.WaitGroup

	for _, deptID := range openDeptIDs {
		wg.Add(1)
		go func(deptID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			members, err := getCachedDepartmentMemberDetails(token, deptID)
			if err != nil {
				errOnce.Do(func() { firstErr = err })
				return
			}

			mu.Lock()
			for _, member := range members {
				if member.OpenID != "" && !seen[member.OpenID] {
					seen[member.OpenID] = true
					result = append(result, member)
				}
			}
			mu.Unlock()
		}(deptID)
	}
	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}
	return result, nil
}
