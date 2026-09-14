package service

import (
	"errors"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"
)

var ErrCompanyIDRequired = errors.New("company_id is required")
var ErrCompanyAccessDenied = errors.New("company is disabled, missing, or not accessible")
var ErrDepartmentAccessDenied = errors.New("department is not accessible")

const (
	companyDirectoryFetchConcurrency = 5
	tokensPerHundredMillion          = 100_000_000
)

// highCostThresholdCNY is the spend level above which a user is reported as a
// high-cost user on the data overview cards.
const highCostThresholdCNY = 10.0

// costBucketUpperBoundsCNY lists the exclusive upper bounds used to group users
// by spend. The final bucket is unbounded and covers everything above the last
// value here.
var costBucketUpperBoundsCNY = []float64{0, 10, 50, 100, 200, 400, 800}

// overviewAudienceCacheTTL lets the five parallel overview endpoints share one
// lightweight member resolve. Keep short so role/department changes still refresh.
const overviewAudienceCacheTTL = 30 * time.Second

var overviewAudienceSingleflight singleflight.Group

type overviewAudience struct {
	company             *model.Company
	directory           *overviewDirectory
	departmentID        string
	departmentIDs       []string
	members             []overviewMember
	users               []*model.User
	registeredUserIDs   []int
	totalUsers          int
	forceRegisteredOnly bool
}

type overviewUserStats struct {
	rows     []model.UserStatRow
	byUserID map[int]model.UserStatRow
}

var getOverviewUserStatsBatch = model.GetUserStatsBatch

func loadOverviewUserStats(userIDs []int, startTimestamp int64, endTimestamp int64) (*overviewUserStats, error) {
	rows, err := getOverviewUserStatsBatch(userIDs, startTimestamp, endTimestamp)
	if err != nil {
		return nil, err
	}
	stats := &overviewUserStats{
		rows:     rows,
		byUserID: make(map[int]model.UserStatRow, len(rows)),
	}
	for _, row := range rows {
		stats.byUserID[row.UserID] = row
	}
	return stats, nil
}

func companyNodeValue(companyID int) string {
	return fmt.Sprintf("company:%d", companyID)
}

func departmentNodeValue(companyID int, departmentID string) string {
	return fmt.Sprintf("dept:%d:%s", companyID, departmentID)
}

func parseCompanyDepartmentValue(companyID int, value string) (string, bool, error) {
	if value == companyNodeValue(companyID) {
		return "", true, nil
	}
	prefix := fmt.Sprintf("dept:%d:", companyID)
	if strings.HasPrefix(value, prefix) {
		rawID := strings.TrimPrefix(value, prefix)
		if rawID == "" {
			return "", false, errors.New("department_id is invalid")
		}
		return rawID, false, nil
	}
	if strings.HasPrefix(value, "company:") || strings.HasPrefix(value, "dept:") {
		return "", false, ErrDepartmentAccessDenied
	}
	if strings.TrimSpace(value) == "" {
		return "", false, errors.New("department_id is required")
	}
	return value, false, nil
}

func getAuthorizedOverviewCompany(companyID int, userID int, userRole int) (*model.Company, error) {
	company, err := model.GetEnabledCompanyByID(companyID)
	if err != nil {
		return nil, ErrCompanyAccessDenied
	}
	if userRole >= common.RoleRootUser {
		return company, nil
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return nil, ErrCompanyAccessDenied
	}
	if userRole == common.RoleBUBP && overviewDepartmentBelongsToCompany(user.OverviewDeptIDs, company.Id) {
		return company, nil
	}
	if user.Company != company.Name {
		return nil, ErrCompanyAccessDenied
	}
	return company, nil
}

func overviewDepartmentBelongsToCompany(overviewDeptIDs []string, companyID int) bool {
	companyPrefix := fmt.Sprintf("dept:%d:", companyID)
	for _, departmentValue := range ParseOverviewDeptIDs(overviewDeptIDs) {
		if strings.HasPrefix(departmentValue, companyPrefix) {
			return true
		}
	}
	return false
}

func buildOverviewDepartmentTree(companyID int, platform string, departments []overviewDepartment) []*DeptTreeNode {
	nodeMap := make(map[string]*DeptTreeNode, len(departments))
	childrenMap := make(map[string][]string, len(departments))
	for _, department := range departments {
		nodeMap[department.ID] = &DeptTreeNode{
			Value:        departmentNodeValue(companyID, department.ID),
			Label:        department.Name,
			CompanyID:    companyID,
			Platform:     platform,
			NodeType:     "department",
			DepartmentID: department.ID,
			LeaderUserID: department.LeaderUserID,
			Children:     []*DeptTreeNode{},
		}
		childrenMap[department.ParentID] = append(childrenMap[department.ParentID], department.ID)
	}
	for _, department := range departments {
		node := nodeMap[department.ID]
		for _, childID := range childrenMap[department.ID] {
			if child := nodeMap[childID]; child != nil {
				node.Children = append(node.Children, child)
			}
		}
	}
	roots := make([]*DeptTreeNode, 0)
	for _, department := range departments {
		if department.ParentID == "" || department.ParentID == "0" || department.ParentID == "1" || nodeMap[department.ParentID] == nil {
			roots = append(roots, nodeMap[department.ID])
		}
	}
	return roots
}

func prefixLeaderDepartmentIDs(companyID int, ids []string) []string {
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != "" {
			result = append(result, departmentNodeValue(companyID, id))
		}
	}
	return result
}

func getCompanyDepartmentTree(userID int, userRole int) (*DepartmentTreeResponse, error) {
	companies, err := model.ListEnabledCompanies()
	if err != nil {
		return nil, err
	}
	if len(companies) == 0 {
		return &DepartmentTreeResponse{
			TreeData:      []*DeptTreeNode{},
			LeaderDeptIDs: []string{},
		}, nil
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	visibleCompanies := make([]*model.Company, 0, len(companies))
	for _, company := range companies {
		if userRole >= common.RoleRootUser ||
			(userRole == common.RoleBUBP && overviewDepartmentBelongsToCompany(user.OverviewDeptIDs, company.Id)) ||
			(userRole != common.RoleBUBP && user.Company == company.Name) {
			visibleCompanies = append(visibleCompanies, company)
		}
	}
	type companyTreeResult struct {
		node          *DeptTreeNode
		leaderDeptIDs []string
	}
	results := make([]companyTreeResult, len(visibleCompanies))
	leaderDepartmentIDs := user.GetLeaderDepartmentIDs()
	overviewDeptIDs := ParseOverviewDeptIDs(user.OverviewDeptIDs)
	sem := make(chan struct{}, companyDirectoryFetchConcurrency)
	var wg sync.WaitGroup
	for index, company := range visibleCompanies {
		wg.Add(1)
		go func(index int, company *model.Company) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

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
			results[index].node = companyNode
			if company.Platform == model.CompanyPlatformNone {
				return
			}
			// Lazily load department trees: only the first company is fetched
			// eagerly. Other companies expose a company-level node with
			// Loading=true so the frontend can fetch their subtree on demand
			// when the user expands them in the selector.
			if index != 0 && userRole != common.RoleBUBP {
				companyNode.Disabled = userRole < common.RoleRootUser
				companyNode.Loading = true
				return
			}
			directory, loadErr := fetchCompanyDirectory(company)
			if loadErr != nil {
				companyNode.Disabled = true
				companyNode.Error = loadErr.Error()
				return
			}
			if directory.OrganizationName != company.Name {
				companyNode.Disabled = true
				companyNode.Error = fmt.Sprintf("organization name %q does not exactly match company name %q", directory.OrganizationName, company.Name)
				return
			}
			fullTree := buildOverviewDepartmentTree(company.Id, company.Platform, directory.Departments)
			leaderIDs := prefixLeaderDepartmentIDs(company.Id, leaderDepartmentIDs)
			trimmed, visibleLeaderIDs := trimTreeForUser(fullTree, userRole, user.OpenId, leaderIDs, overviewDeptIDs)
			companyNode.Disabled = userRole < common.RoleRootUser
			companyNode.Children = trimmed
			results[index].leaderDeptIDs = visibleLeaderIDs
		}(index, company)
	}
	wg.Wait()

	response := &DepartmentTreeResponse{TreeData: make([]*DeptTreeNode, 0, len(results)), LeaderDeptIDs: []string{}}
	for _, result := range results {
		response.TreeData = append(response.TreeData, result.node)
		response.LeaderDeptIDs = append(response.LeaderDeptIDs, result.leaderDeptIDs...)
	}
	return response, nil
}

// CompanySubtreeResponse is the on-demand payload for a single company's
// department subtree, returned when the frontend lazily expands a company node.
type CompanySubtreeResponse struct {
	Node          *DeptTreeNode `json:"node"`
	LeaderDeptIDs []string      `json:"leader_dept_ids"`
}

// GetCompanySubtreeNode fetches and builds the department subtree for a single
// company. It mirrors the per-company logic in getCompanyDepartmentTree but is
// invoked lazily when the user expands a company node that was returned with
// Loading=true. It enforces the same access checks and permission trimming.
func GetCompanySubtreeNode(companyID int, userID int, userRole int) (*CompanySubtreeResponse, error) {
	if companyID <= 0 {
		return nil, ErrCompanyIDRequired
	}
	company, err := getAuthorizedOverviewCompany(companyID, userID, userRole)
	if err != nil {
		return nil, err
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}

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
	response := &CompanySubtreeResponse{Node: companyNode, LeaderDeptIDs: []string{}}
	if company.Platform == model.CompanyPlatformNone {
		return response, nil
	}
	directory, loadErr := fetchCompanyDirectory(company)
	if loadErr != nil {
		companyNode.Disabled = true
		companyNode.Error = loadErr.Error()
		return response, nil
	}
	if directory.OrganizationName != company.Name {
		companyNode.Disabled = true
		companyNode.Error = fmt.Sprintf("organization name %q does not exactly match company name %q", directory.OrganizationName, company.Name)
		return response, nil
	}
	fullTree := buildOverviewDepartmentTree(company.Id, company.Platform, directory.Departments)
	leaderIDs := prefixLeaderDepartmentIDs(company.Id, user.GetLeaderDepartmentIDs())
	overviewDeptIDs := ParseOverviewDeptIDs(user.OverviewDeptIDs)
	trimmed, visibleLeaderIDs := trimTreeForUser(fullTree, userRole, user.OpenId, leaderIDs, overviewDeptIDs)
	companyNode.Disabled = userRole < common.RoleRootUser
	companyNode.Children = trimmed
	response.LeaderDeptIDs = visibleLeaderIDs
	return response, nil
}

func ensureDepartmentAccessible(company *model.Company, directory *overviewDirectory, departmentID string, companyRoot bool, userID int, userRole int) error {
	if company.Platform == model.CompanyPlatformNone {
		if companyRoot {
			return nil
		}
		return ErrDepartmentAccessDenied
	}
	if directory.OrganizationName != company.Name {
		return fmt.Errorf("organization name %q does not exactly match company name %q", directory.OrganizationName, company.Name)
	}
	if userRole >= common.RoleRootUser {
		return nil
	}
	if companyRoot {
		return ErrDepartmentAccessDenied
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return ErrDepartmentAccessDenied
	}
	fullTree := buildOverviewDepartmentTree(company.Id, company.Platform, directory.Departments)
	leaders := prefixLeaderDepartmentIDs(company.Id, user.GetLeaderDepartmentIDs())
	overviewDeptIDs := ParseOverviewDeptIDs(user.OverviewDeptIDs)
	trimmed, _ := trimTreeForUser(fullTree, userRole, user.OpenId, leaders, overviewDeptIDs)
	node := findNodeByValue(trimmed, departmentNodeValue(company.Id, departmentID))
	if node == nil || node.Disabled {
		return ErrDepartmentAccessDenied
	}
	return nil
}

func findNodeByValue(nodes []*DeptTreeNode, value string) *DeptTreeNode {
	for _, node := range nodes {
		if node.Value == value {
			return node
		}
		if found := findNodeByValue(node.Children, value); found != nil {
			return found
		}
	}
	return nil
}

func collectOverviewDepartmentIDs(departments []overviewDepartment, departmentID string, companyRoot bool, platform string) []string {
	if companyRoot {
		result := make([]string, 0, len(departments)+1)
		if platform == model.CompanyPlatformFeishu {
			result = append(result, "0")
		}
		if platform == model.CompanyPlatformDingTalk {
			result = append(result, strconv.FormatInt(dingTalkDeptRootID, 10))
		}
		for _, department := range departments {
			result = append(result, department.ID)
		}
		return result
	}
	known := make(map[string]bool, len(departments))
	children := make(map[string][]string, len(departments))
	for _, department := range departments {
		known[department.ID] = true
		children[department.ParentID] = append(children[department.ParentID], department.ID)
	}
	result := make([]string, 0)
	queue := []string{departmentID}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if known[current] {
			result = append(result, current)
		}
		queue = append(queue, children[current]...)
	}
	return result
}

func resolveCompanyOverviewAudience(companyID int, departmentValue string, userID int, userRole int, registeredBefore int64) (*overviewAudience, bool, error) {
	if companyID <= 0 {
		return nil, true, ErrCompanyIDRequired
	}
	cacheKey := companyOverviewCacheKey(
		companyID,
		"audience",
		fmt.Sprintf("%s:%d:%d:%d", departmentValue, userID, userRole, registeredBefore),
	)
	if cached, ok := loadCompanyOverviewCache(cacheKey); ok {
		return cached.(*overviewAudience), true, nil
	}
	value, err, _ := overviewAudienceSingleflight.Do(cacheKey, func() (any, error) {
		if cached, ok := loadCompanyOverviewCache(cacheKey); ok {
			return cached.(*overviewAudience), nil
		}
		audience, err := buildCompanyOverviewAudience(companyID, departmentValue, userID, userRole, registeredBefore)
		if err != nil {
			return nil, err
		}
		storeCompanyOverviewCache(cacheKey, audience, overviewAudienceCacheTTL)
		return audience, nil
	})
	if err != nil {
		return nil, true, err
	}
	return value.(*overviewAudience), true, nil
}

func buildCompanyOverviewAudience(companyID int, departmentValue string, userID int, userRole int, registeredBefore int64) (*overviewAudience, error) {
	company, err := getAuthorizedOverviewCompany(companyID, userID, userRole)
	if err != nil {
		return nil, err
	}
	departmentID, companyRoot, err := parseCompanyDepartmentValue(company.Id, departmentValue)
	if err != nil {
		return nil, err
	}
	audience := &overviewAudience{company: company, departmentID: departmentID}
	if company.Platform == model.CompanyPlatformNone {
		if !companyRoot {
			return nil, ErrDepartmentAccessDenied
		}
		users, err := queryOverviewUsers(company.Name, nil, registeredBefore)
		if err != nil {
			return nil, err
		}
		audience.users = users
		audience.registeredUserIDs = userIDsFromUsers(users)
		audience.totalUsers = len(users)
		audience.forceRegisteredOnly = true
		return audience, nil
	}
	directory, err := fetchCompanyDirectory(company)
	if err != nil {
		return nil, err
	}
	if err := ensureDepartmentAccessible(company, directory, departmentID, companyRoot, userID, userRole); err != nil {
		return nil, err
	}
	departmentIDs := collectOverviewDepartmentIDs(directory.Departments, departmentID, companyRoot, company.Platform)
	if len(departmentIDs) == 0 {
		audience.directory = directory
		return audience, nil
	}
	members, err := collectCompanyMembers(company, departmentIDs)
	if err != nil {
		return nil, err
	}
	members, users, err := matchOverviewDepartmentMembers(company, members, departmentIDs, registeredBefore)
	if err != nil {
		return nil, err
	}
	audience.directory = directory
	audience.departmentIDs = departmentIDs
	audience.members = members
	audience.users = users
	audience.registeredUserIDs = userIDsFromUsers(users)
	audience.totalUsers = len(members)
	return audience, nil
}

func collectCompanyMembers(company *model.Company, departmentIDs []string) ([]overviewMember, error) {
	return collectCompanyMembersWithFetcher(company, departmentIDs, fetchCompanyMembers)
}

func collectCompanyMemberDetails(company *model.Company, departmentIDs []string) ([]overviewMember, error) {
	return collectCompanyMembersWithFetcher(company, departmentIDs, fetchCompanyMemberDetails)
}

func collectCompanyMembersWithFetcher(
	company *model.Company,
	departmentIDs []string,
	fetcher func(*model.Company, string) ([]overviewMember, error),
) ([]overviewMember, error) {
	seen := make(map[string]bool)
	result := make([]overviewMember, 0)
	var mu sync.Mutex
	var firstErr error
	var once sync.Once
	sem := make(chan struct{}, deptMembersFetchConcurrency)
	var wg sync.WaitGroup
	for _, departmentID := range departmentIDs {
		wg.Add(1)
		go func(rawID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			members, err := fetcher(company, rawID)
			if err != nil {
				once.Do(func() { firstErr = err })
				return
			}
			mu.Lock()
			for _, member := range members {
				if member.OpenID == "" || seen[member.OpenID] {
					continue
				}
				seen[member.OpenID] = true
				if member.ObservedDepartmentID == "" {
					member.ObservedDepartmentID = rawID
				}
				result = append(result, member)
			}
			mu.Unlock()
		}(departmentID)
	}
	wg.Wait()
	return result, firstErr
}

func queryOverviewUsers(companyName string, openIDs []string, registeredBefore int64) ([]*model.User, error) {
	query := model.DB.Model(&model.User{}).Where("company = ?", companyName)
	if openIDs != nil {
		if len(openIDs) == 0 {
			return []*model.User{}, nil
		}
		query = query.Where("open_id IN ?", openIDs)
	}
	if registeredBefore > 0 {
		query = query.Where("created_at <= ?", registeredBefore)
	}
	var users []*model.User
	if err := query.Omit("password").Find(&users).Error; err != nil {
		return nil, err
	}
	exactUsers := make([]*model.User, 0, len(users))
	for _, user := range users {
		if user.Company == companyName {
			exactUsers = append(exactUsers, user)
		}
	}
	return exactUsers, nil
}

// queryCostCenterUsers returns local users whose cost_center resolves into the
// queried company's department tree. Unlike queryOverviewUsers it is not scoped
// by company name, because cost-center attribution may cross company names, and
// it does not require open_id, so members without a platform identity remain
// discoverable. Filtering happens in memory to stay compatible across the
// supported databases without relying on JSON query functions.
func queryCostCenterUsers(companyID int, departmentIDs []string) ([]*model.User, error) {
	allowedDepartmentIDs := make(map[string]bool, len(departmentIDs))
	for _, departmentID := range departmentIDs {
		allowedDepartmentIDs[departmentID] = true
	}
	var users []*model.User
	if err := model.DB.Model(&model.User{}).
		Where("cost_center <> ? AND cost_center <> ?", "[]", "").
		Omit("password").
		Find(&users).Error; err != nil {
		return nil, err
	}
	result := make([]*model.User, 0, len(users))
	for _, user := range users {
		departmentID, costCenterCompanyID, ok := user.GetCostCenter()
		if !ok || costCenterCompanyID != companyID || !allowedDepartmentIDs[departmentID] {
			continue
		}
		result = append(result, user)
	}
	return result, nil
}

func matchOverviewDepartmentMembers(company *model.Company, members []overviewMember, departmentIDs []string, registeredBefore int64) ([]overviewMember, []*model.User, error) {
	openIDs := make([]string, 0, len(members))
	for _, member := range members {
		openIDs = append(openIDs, member.OpenID)
	}
	users, err := queryOverviewUsers(company.Name, openIDs, 0)
	if err != nil {
		return nil, nil, err
	}
	var disabledUsers []*model.User
	if err := model.DB.Model(&model.User{}).
		Where("company = ? AND status = ?", company.Name, common.UserStatusDisabled).
		Where("open_id <> ?", "").
		Omit("password").
		Find(&disabledUsers).Error; err != nil {
		return nil, nil, err
	}
	costCenterUsers, err := queryCostCenterUsers(company.Id, departmentIDs)
	if err != nil {
		return nil, nil, err
	}

	allowedDepartmentIDs := make(map[string]bool, len(departmentIDs))
	for _, departmentID := range departmentIDs {
		allowedDepartmentIDs[departmentID] = true
	}
	usersByOpenID := make(map[string]*model.User, len(users)+len(disabledUsers))
	for _, user := range users {
		if user.OpenId != "" {
			usersByOpenID[user.OpenId] = user
		}
	}
	for _, user := range disabledUsers {
		if user.OpenId != "" {
			usersByOpenID[user.OpenId] = user
		}
	}

	matchedMembers := make([]overviewMember, 0, len(members)+len(costCenterUsers))
	matchedUsers := make([]*model.User, 0, len(users)+len(disabledUsers)+len(costCenterUsers))
	seenMemberOpenIDs := make(map[string]bool, len(members)+len(disabledUsers)+len(costCenterUsers))
	seenUserIDs := make(map[int]bool, len(users)+len(disabledUsers)+len(costCenterUsers))

	// costCenterDepartment reports the cost-center department id, whether the
	// user has any cost center at all, and whether that cost center hits the
	// queried company and target tree. The has flag lets callers skip users
	// whose attribution follows a cost center outside this query instead of
	// falling back to the directory primary department.
	costCenterDepartment := func(user *model.User) (departmentID string, has bool, hits bool) {
		costCenterDepartmentID, costCenterCompanyID, hasCostCenter := user.GetCostCenter()
		if !hasCostCenter {
			return "", false, false
		}
		if costCenterCompanyID != company.Id || !allowedDepartmentIDs[costCenterDepartmentID] {
			return costCenterDepartmentID, true, false
		}
		return costCenterDepartmentID, true, true
	}

	addMatchedUser := func(user *model.User) {
		if registeredBefore <= 0 || user.CreatedAt <= registeredBefore {
			matchedUsers = append(matchedUsers, user)
		}
	}

	for _, member := range members {
		seenMemberOpenIDs[member.OpenID] = true
		user := usersByOpenID[member.OpenID]
		if user == nil {
			matchedMembers = append(matchedMembers, member)
			continue
		}
		// cost_center takes precedence and never falls back to the primary
		// department: a member whose cost center points elsewhere is attributed
		// to that other department, not to their directory primary department.
		_, hasCostCenter, hits := costCenterDepartment(user)
		if hasCostCenter {
			if !hits {
				continue
			}
			matchedMembers = append(matchedMembers, member)
			seenUserIDs[user.Id] = true
			addMatchedUser(user)
			continue
		}
		if !allowedDepartmentIDs[user.GetPrimaryDepartmentID()] {
			continue
		}
		matchedMembers = append(matchedMembers, member)
		seenUserIDs[user.Id] = true
		addMatchedUser(user)
	}
	// Disabled users that the platform directory no longer returns are
	// reinstated from local records. Those carrying a cost center are deferred
	// to the cost-center supplement loop below so attribution stays consistent
	// and dedup-by-user-id remains authoritative.
	for _, user := range disabledUsers {
		if seenMemberOpenIDs[user.OpenId] {
			continue
		}
		if _, _, hasCostCenter := costCenterDepartment(user); hasCostCenter {
			continue
		}
		departmentID := user.GetPrimaryDepartmentID()
		if !allowedDepartmentIDs[departmentID] {
			continue
		}
		matchedMembers = append(matchedMembers, overviewMember{
			OpenID:               user.OpenId,
			ObservedDepartmentID: departmentID,
		})
		seenUserIDs[user.Id] = true
		addMatchedUser(user)
	}
	// Supplement members resolved purely from cost center, including those
	// whose open_id is empty and therefore never appear in the platform
	// directory. Dedup by user id against members already attributed above.
	for _, user := range costCenterUsers {
		if seenUserIDs[user.Id] {
			continue
		}
		departmentID, _, hits := costCenterDepartment(user)
		if !hits {
			continue
		}
		matchedMembers = append(matchedMembers, overviewMember{
			OpenID:               user.OpenId,
			ObservedDepartmentID: departmentID,
		})
		seenUserIDs[user.Id] = true
		addMatchedUser(user)
	}
	return matchedMembers, matchedUsers, nil
}

// partitionMatchedMembersByPrimaryDepartment buckets parent audience members
// into each direct child subtree using local primary department IDs. This avoids
// re-fetching Feishu/DingTalk members for every child during sub-stats.
func partitionMatchedMembersByPrimaryDepartment(
	parentMembers []overviewMember,
	parentUsers []*model.User,
	directory *overviewDirectory,
	children []overviewDepartment,
	platform string,
) ([][]overviewMember, [][]*model.User) {
	childMembers := make([][]overviewMember, len(children))
	childUsers := make([][]*model.User, len(children))
	if directory == nil || len(children) == 0 {
		return childMembers, childUsers
	}

	departmentToChildIndex := make(map[string]int)
	for index, child := range children {
		for _, departmentID := range collectOverviewDepartmentIDs(directory.Departments, child.ID, false, platform) {
			if _, exists := departmentToChildIndex[departmentID]; !exists {
				departmentToChildIndex[departmentID] = index
			}
		}
	}

	usersByOpenID := make(map[string]*model.User, len(parentUsers))
	for _, user := range parentUsers {
		if user.OpenId != "" {
			usersByOpenID[user.OpenId] = user
		}
	}
	for _, member := range parentMembers {
		user := usersByOpenID[member.OpenID]
		if user != nil {
			// When a cost center is set it overrides the directory primary
			// department for sub-department bucketing, mirroring the
			// attribution rules in matchOverviewDepartmentMembers. Members
			// whose cost center points outside every child subtree are dropped
			// here rather than falling back to the primary department.
			bucketDepartmentID := user.GetPrimaryDepartmentID()
			if departmentID, _, hasCostCenter := user.GetCostCenter(); hasCostCenter {
				bucketDepartmentID = departmentID
			}
			childIndex, ok := departmentToChildIndex[bucketDepartmentID]
			if !ok {
				continue
			}
			childMembers[childIndex] = append(childMembers[childIndex], member)
			childUsers[childIndex] = append(childUsers[childIndex], user)
			continue
		}
		if member.ObservedDepartmentID == "" {
			continue
		}
		childIndex, ok := departmentToChildIndex[member.ObservedDepartmentID]
		if !ok {
			continue
		}
		childMembers[childIndex] = append(childMembers[childIndex], member)
	}
	return childMembers, childUsers
}

func userIDsFromUsers(users []*model.User) []int {
	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}
	return ids
}

// authorizeCompanyOverviewUser checks whether the requester may read statistics for
// targetUserID. Admins manage every user from the global user list, so they are allowed
// to omit the company scope. Department leaders and BP roles stay bound to a company,
// because their visibility is derived from that company's directory tree.
func authorizeCompanyOverviewUser(companyID int, departmentID string, targetUserID int, requestUserID int, requestUserRole int) error {
	if companyID <= 0 {
		if requestUserRole >= common.RoleAdminUser {
			return nil
		}
		return ErrCompanyIDRequired
	}
	audience, _, err := resolveCompanyOverviewAudience(companyID, departmentID, requestUserID, requestUserRole, 0)
	if err != nil {
		return err
	}
	for _, userID := range audience.registeredUserIDs {
		if userID == targetUserID {
			return nil
		}
	}
	return ErrDepartmentAccessDenied
}

func directOverviewChildren(directory *overviewDirectory, parentID string, companyRoot bool) []overviewDepartment {
	children := make([]overviewDepartment, 0)
	known := make(map[string]bool, len(directory.Departments))
	for _, department := range directory.Departments {
		known[department.ID] = true
	}
	for _, department := range directory.Departments {
		if companyRoot {
			if department.ParentID == "" || department.ParentID == "0" || department.ParentID == "1" || !known[department.ParentID] {
				children = append(children, department)
			}
			continue
		}
		if department.ParentID == parentID {
			children = append(children, department)
		}
	}
	return children
}

type DepartmentOverviewRequest struct {
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

type DepartmentOverviewResponse struct {
	Stats        *model.DepartmentStat    `json:"stats"`
	SubStats     []SubDepartmentStatItem  `json:"sub_stats"`
	Usage        *UsageAnalysisResponse   `json:"usage_analysis"`
	Users        *DepartmentUsersResponse `json:"users"`
	UserRankings []UserRankingItem        `json:"user_rankings"`
}

func GetDepartmentOverview(req *DepartmentOverviewRequest) (*DepartmentOverviewResponse, error) {
	audience, _, err := resolveCompanyOverviewAudience(
		req.CompanyID,
		req.DepartmentID,
		req.RequestUserID,
		req.RequestUserRole,
		req.EndTimestamp,
	)
	if err != nil {
		return nil, err
	}

	statsReq := &DepartmentStatsRequest{
		CompanyID:       req.CompanyID,
		DepartmentID:    req.DepartmentID,
		StartTimestamp:  req.StartTimestamp,
		EndTimestamp:    req.EndTimestamp,
		RequestUserID:   req.RequestUserID,
		RequestUserRole: req.RequestUserRole,
	}
	usersReq := &DepartmentUsersRequest{
		CompanyID:           req.CompanyID,
		DepartmentID:        req.DepartmentID,
		StartTimestamp:      req.StartTimestamp,
		EndTimestamp:        req.EndTimestamp,
		Page:                req.Page,
		PageSize:            req.PageSize,
		SortBy:              req.SortBy,
		SortOrder:           req.SortOrder,
		RegistrationStatus:  req.RegistrationStatus,
		Role:                req.Role,
		IncludeUnregistered: req.IncludeUnregistered,
		RequestUserID:       req.RequestUserID,
		RequestUserRole:     req.RequestUserRole,
	}

	var stats *model.DepartmentStat
	var subStats []SubDepartmentStatItem
	var usage *UsageAnalysisResponse
	var users *DepartmentUsersResponse
	var userRankings []UserRankingItem
	var sharedUserStats *overviewUserStats
	var sharedUserStatsErr error
	sharedUserStatsReady := make(chan struct{})
	var group errgroup.Group
	group.Go(func() error {
		defer close(sharedUserStatsReady)
		sharedUserStats, sharedUserStatsErr = loadOverviewUserStats(
			audience.registeredUserIDs,
			req.StartTimestamp,
			req.EndTimestamp,
		)
		return sharedUserStatsErr
	})
	group.Go(func() error {
		<-sharedUserStatsReady
		if sharedUserStatsErr != nil {
			return sharedUserStatsErr
		}
		var taskErr error
		stats, taskErr = buildCompanyDepartmentStats(statsReq, audience, sharedUserStats)
		return taskErr
	})
	group.Go(func() error {
		<-sharedUserStatsReady
		if sharedUserStatsErr != nil {
			return sharedUserStatsErr
		}
		var taskErr error
		subStats, taskErr = buildCompanySubDepartmentStats(statsReq, audience, sharedUserStats)
		return taskErr
	})
	group.Go(func() error {
		var taskErr error
		usage, taskErr = buildCompanyUsageAnalysis(statsReq, audience)
		return taskErr
	})
	group.Go(func() error {
		<-sharedUserStatsReady
		if sharedUserStatsErr != nil {
			return sharedUserStatsErr
		}
		var taskErr error
		users, taskErr = buildCompanyDepartmentUsers(usersReq, audience, sharedUserStats)
		return taskErr
	})
	group.Go(func() error {
		<-sharedUserStatsReady
		if sharedUserStatsErr != nil {
			return sharedUserStatsErr
		}
		var taskErr error
		userRankings, taskErr = buildCompanyDepartmentUserRankings(usersReq, audience, sharedUserStats)
		return taskErr
	})
	if err := group.Wait(); err != nil {
		return nil, err
	}

	return &DepartmentOverviewResponse{
		Stats:        stats,
		SubStats:     subStats,
		Usage:        usage,
		Users:        users,
		UserRankings: userRankings,
	}, nil
}

func getCompanyDepartmentStats(req *DepartmentStatsRequest) (*model.DepartmentStat, error) {
	audience, _, err := resolveCompanyOverviewAudience(req.CompanyID, req.DepartmentID, req.RequestUserID, req.RequestUserRole, req.EndTimestamp)
	if err != nil {
		return nil, err
	}
	return buildCompanyDepartmentStats(req, audience, nil)
}

// buildCompanyDepartmentStats aggregates the overview cards for one department.
// userStats is optional: when the caller already loaded per-user totals they are
// reused to group the audience by spend, otherwise the cost buckets are loaded
// separately so the stats endpoint stays self-contained.
func buildCompanyDepartmentStats(req *DepartmentStatsRequest, audience *overviewAudience, userStats *overviewUserStats) (*model.DepartmentStat, error) {
	threshold := getActiveUserThreshold(req.StartTimestamp, req.EndTimestamp)
	stat, err := model.GetDepartmentStats(
		audience.registeredUserIDs,
		req.StartTimestamp,
		req.EndTimestamp,
		threshold.RequestCount,
		threshold.TokenCount,
		[3]float64(threshold.Formula),
	)
	if err != nil {
		return nil, err
	}
	stat.RegisteredUsers = int64(len(audience.registeredUserIDs))
	stat.UnregisteredUsers = int64(audience.totalUsers) - stat.RegisteredUsers
	if audience.forceRegisteredOnly || stat.UnregisteredUsers < 0 {
		stat.UnregisteredUsers = 0
	}
	if userStats == nil {
		userStats, err = loadOverviewUserStats(audience.registeredUserIDs, req.StartTimestamp, req.EndTimestamp)
		if err != nil {
			return nil, err
		}
	}
	applyCostBuckets(stat, userStats)
	finalizeDepartmentStat(stat)
	return stat, nil
}

// applyCostBuckets groups every person in scope by how much they spent during
// the period. Users without any usage row, plus unregistered users, land in the
// zero-spend bucket so the buckets always add up to the full headcount.
func applyCostBuckets(stat *model.DepartmentStat, userStats *overviewUserStats) {
	conversionFactor := quotaToCNYFactor()
	buckets := make([]model.CostBucket, 0, len(costBucketUpperBoundsCNY)+1)
	for index, upperBound := range costBucketUpperBoundsCNY {
		lowerBound := 0.0
		if index > 0 {
			lowerBound = costBucketUpperBoundsCNY[index-1]
		}
		buckets = append(buckets, model.CostBucket{
			MinAmountCNY: lowerBound,
			MaxAmountCNY: upperBound,
		})
	}
	buckets = append(buckets, model.CostBucket{
		MinAmountCNY: costBucketUpperBoundsCNY[len(costBucketUpperBoundsCNY)-1],
	})

	var highCostUsers int64
	var usersWithSpend int64
	if userStats != nil {
		for _, row := range userStats.rows {
			amountCNY := float64(row.TotalQuota) * conversionFactor
			if amountCNY <= 0 {
				continue
			}
			usersWithSpend++
			buckets[findCostBucketIndex(amountCNY)].Users++
			if amountCNY > highCostThresholdCNY {
				highCostUsers++
			}
		}
	}

	totalUsers := stat.RegisteredUsers + stat.UnregisteredUsers
	zeroSpendUsers := totalUsers - usersWithSpend
	if zeroSpendUsers < 0 {
		zeroSpendUsers = 0
	}
	buckets[0].Users = zeroSpendUsers

	stat.CostBuckets = buckets
	stat.HighCostUsers = highCostUsers
	stat.HighCostThresholdCNY = highCostThresholdCNY
	if totalUsers > 0 {
		stat.HighCostUserRate = float64(highCostUsers) / float64(totalUsers) * 100
	}
}

// findCostBucketIndex returns the bucket owning a positive spend amount. Bucket
// zero is reserved for users with no spend at all.
func findCostBucketIndex(amountCNY float64) int {
	for index := 1; index < len(costBucketUpperBoundsCNY); index++ {
		if amountCNY <= costBucketUpperBoundsCNY[index] {
			return index
		}
	}
	return len(costBucketUpperBoundsCNY)
}

// quotaToCNYFactor converts a raw quota amount into CNY.
func quotaToCNYFactor() float64 {
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}
	exchangeRate := operation_setting.USDExchangeRate
	if exchangeRate <= 0 {
		exchangeRate = 1
	}
	return exchangeRate / quotaPerUnit
}

func finalizeDepartmentStat(stat *model.DepartmentStat) {
	stat.TotalAmountCNY = float64(stat.TotalQuota) * quotaToCNYFactor()
	if stat.TotalTokens > 0 {
		stat.UnitPricePer100MTokens = stat.TotalAmountCNY / (float64(stat.TotalTokens) / tokensPerHundredMillion)
	}
	totalUsers := stat.RegisteredUsers + stat.UnregisteredUsers
	if totalUsers > 0 {
		stat.ActiveUserRate = float64(stat.ActiveUsers) / float64(totalUsers) * 100
	}
	if stat.ActiveUsers > 0 {
		stat.AvgTokensPerActiveUserMT = float64(stat.TotalTokens) / float64(stat.ActiveUsers) / 1000000
	}
}

func getCompanyDepartmentLogs(req *DepartmentLogsRequest) (*common.PageInfo, error) {
	audience, _, err := resolveCompanyOverviewAudience(req.CompanyID, req.DepartmentID, req.RequestUserID, req.RequestUserRole, req.EndTimestamp)
	if err != nil {
		return nil, err
	}
	pageInfo := departmentLogsPageInfo(req.Page, req.PageSize)
	if len(audience.registeredUserIDs) == 0 {
		pageInfo.SetItems([]*model.Log{})
		return pageInfo, nil
	}
	logs, total, err := model.GetLogsByUserIds(
		audience.registeredUserIDs,
		req.LogType,
		req.StartTimestamp,
		req.EndTimestamp,
		req.ModelName,
		req.Username,
		req.TokenName,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
		req.Channel,
		req.Group,
		req.RequestID,
		req.UpstreamRequestID,
	)
	if err != nil {
		return nil, err
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	return pageInfo, nil
}

func getCompanyUsageAnalysis(req *DepartmentStatsRequest) (*UsageAnalysisResponse, error) {
	audience, _, err := resolveCompanyOverviewAudience(req.CompanyID, req.DepartmentID, req.RequestUserID, req.RequestUserRole, req.EndTimestamp)
	if err != nil {
		return nil, err
	}
	return buildCompanyUsageAnalysis(req, audience)
}

func buildCompanyUsageAnalysis(req *DepartmentStatsRequest, audience *overviewAudience) (*UsageAnalysisResponse, error) {
	if len(audience.registeredUserIDs) == 0 {
		return &UsageAnalysisResponse{}, nil
	}
	return buildUsageAnalysisForUsers(audience.registeredUserIDs, req.StartTimestamp, req.EndTimestamp)
}

func getCompanySubDepartmentStats(req *DepartmentStatsRequest) ([]SubDepartmentStatItem, error) {
	audience, _, err := resolveCompanyOverviewAudience(req.CompanyID, req.DepartmentID, req.RequestUserID, req.RequestUserRole, req.EndTimestamp)
	if err != nil {
		return nil, err
	}
	return buildCompanySubDepartmentStats(req, audience, nil)
}

func buildCompanySubDepartmentStats(req *DepartmentStatsRequest, audience *overviewAudience, userStats *overviewUserStats) ([]SubDepartmentStatItem, error) {
	if audience.company.Platform == model.CompanyPlatformNone {
		return []SubDepartmentStatItem{}, nil
	}
	_, companyRoot, err := parseCompanyDepartmentValue(req.CompanyID, req.DepartmentID)
	if err != nil {
		return nil, err
	}
	children := directOverviewChildren(audience.directory, audience.departmentID, companyRoot)
	type childOverviewData struct {
		members []overviewMember
		users   []*model.User
	}
	childData := make([]childOverviewData, len(children))
	accessibleChildren := make([]bool, len(children))
	for index, child := range children {
		if childErr := ensureDepartmentAccessible(
			audience.company,
			audience.directory,
			child.ID,
			false,
			req.RequestUserID,
			req.RequestUserRole,
		); childErr != nil {
			if errors.Is(childErr, ErrDepartmentAccessDenied) {
				continue
			}
			return nil, childErr
		}
		accessibleChildren[index] = true
	}

	partitionedMembers, partitionedUsers := partitionMatchedMembersByPrimaryDepartment(
		audience.members,
		audience.users,
		audience.directory,
		children,
		audience.company.Platform,
	)
	for index := range children {
		if !accessibleChildren[index] {
			continue
		}
		childData[index] = childOverviewData{
			members: partitionedMembers[index],
			users:   partitionedUsers[index],
		}
	}

	visibleChildren := make([]bool, len(children))
	allUserIDs := make([]int, 0)
	userToChild := make(map[int]int)
	for index, data := range childData {
		if !accessibleChildren[index] {
			continue
		}
		visibleChildren[index] = true
		for _, user := range data.users {
			if _, exists := userToChild[user.Id]; exists {
				continue
			}
			userToChild[user.Id] = index
			allUserIDs = append(allUserIDs, user.Id)
		}
	}

	if userStats == nil {
		userStats, err = loadOverviewUserStats(allUserIDs, req.StartTimestamp, req.EndTimestamp)
		if err != nil {
			return nil, fmt.Errorf("get user stats batch: %w", err)
		}
	}
	type childAggregate struct {
		totalTokens   int64
		totalQuota    int64
		totalRequests int64
		activeUsers   int64
	}
	aggregates := make([]childAggregate, len(children))
	threshold := getActiveUserThreshold(req.StartTimestamp, req.EndTimestamp)
	for _, userID := range allUserIDs {
		row, exists := userStats.byUserID[userID]
		if !exists {
			continue
		}
		index, ok := userToChild[row.UserID]
		if !ok {
			continue
		}
		aggregates[index].totalTokens += row.TotalTokens
		aggregates[index].totalQuota += row.TotalQuota
		aggregates[index].totalRequests += row.TotalReqs
		if row.TotalReqs >= threshold.RequestCount || row.TotalTokens >= threshold.TokenCount {
			aggregates[index].activeUsers++
		}
	}

	result := make([]SubDepartmentStatItem, 0, len(children))
	for index, child := range children {
		if !visibleChildren[index] {
			continue
		}
		stat := &model.DepartmentStat{
			RegisteredUsers: int64(len(childData[index].users)),
			UnregisteredUsers: int64(len(childData[index].members)) -
				int64(len(childData[index].users)),
			TotalQuota:    aggregates[index].totalQuota,
			TotalTokens:   aggregates[index].totalTokens,
			TotalRequests: aggregates[index].totalRequests,
			ActiveUsers:   aggregates[index].activeUsers,
		}
		if stat.UnregisteredUsers < 0 {
			stat.UnregisteredUsers = 0
		}
		finalizeDepartmentStat(stat)
		result = append(result, SubDepartmentStatItem{
			DepartmentID:             departmentNodeValue(req.CompanyID, child.ID),
			DepartmentName:           child.Name,
			RegisteredUsers:          stat.RegisteredUsers,
			TotalUsers:               stat.RegisteredUsers + stat.UnregisteredUsers,
			TotalQuota:               stat.TotalQuota,
			TotalAmountCNY:           stat.TotalAmountCNY,
			UnitPricePer100MTokens:   stat.UnitPricePer100MTokens,
			TotalTokens:              stat.TotalTokens,
			TotalRequests:            stat.TotalRequests,
			ActiveUsers:              stat.ActiveUsers,
			ActiveUserRate:           stat.ActiveUserRate,
			AvgTokensPerActiveUserMT: stat.AvgTokensPerActiveUserMT,
		})
	}
	return result, nil
}

func getCompanyDepartmentUsers(req *DepartmentUsersRequest) (*DepartmentUsersResponse, error) {
	audience, _, err := resolveCompanyOverviewAudience(req.CompanyID, req.DepartmentID, req.RequestUserID, req.RequestUserRole, req.EndTimestamp)
	if err != nil {
		return nil, err
	}
	return buildCompanyDepartmentUsers(req, audience, nil)
}

func buildCompanyDepartmentUsers(req *DepartmentUsersRequest, audience *overviewAudience, userStats *overviewUserStats) (*DepartmentUsersResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	items := make([]DepartmentUserItem, 0)
	if audience.forceRegisteredOnly {
		for _, user := range audience.users {
			registrationStatus := getDepartmentUserRegistrationStatus(user, req.EndTimestamp)
			if req.RegistrationStatus != "" && req.RegistrationStatus != registrationStatus {
				continue
			}
			items = append(items, DepartmentUserItem{
				User:               user,
				IsRegistered:       registrationStatus != departmentRegistrationStatusUnregistered,
				RegistrationStatus: registrationStatus,
			})
		}
	} else {
		// Keep the lightweight open_id audience for merge/count. Do not call
		// find_by_department for the whole subtree here — only enrich the
		// current page after sort + slice (same lazy pattern as before).
		includeUnregistered := req.RegistrationStatus == departmentRegistrationStatusUnregistered ||
			(req.RegistrationStatus != departmentRegistrationStatusRegistered && req.IncludeUnregistered)
		memberOpenIDs := make([]string, 0, len(audience.members))
		memberDetails := make(map[string]feishuDeptMember, len(audience.members))
		for _, member := range audience.members {
			memberOpenIDs = append(memberOpenIDs, member.OpenID)
			memberDetails[member.OpenID] = feishuDeptMember{OpenID: member.OpenID, Name: member.Name}
		}
		items = mergeDepartmentUsersWithMembers(audience.users, memberOpenIDs, memberDetails, req.EndTimestamp, includeUnregistered, req.RegistrationStatus)
	}

	// Role is filtered after the audience is materialized because the two
	// branches above build the candidate set differently. Unregistered members
	// carry the zero role, so any concrete role filter drops them too.
	if req.Role > 0 {
		items = slices.DeleteFunc(items, func(item DepartmentUserItem) bool {
			return item.User == nil || item.User.Role != req.Role
		})
	}

	// Computed sorts (quota/tokens/...) need registered usage on every row before
	// slicing. Unregistered display names are still page-local only.
	registeredIDsForSort := make([]int, 0, len(items))
	for _, item := range items {
		if item.User != nil && item.User.Id > 0 && item.IsRegistered {
			registeredIDsForSort = append(registeredIDsForSort, item.User.Id)
		}
	}
	if common.IsComputedSortColumn(req.SortBy) || req.SortBy == "" {
		populateDepartmentUserStats(items, registeredIDsForSort, req.StartTimestamp, req.EndTimestamp, userStats)
	}
	sortDepartmentUserItems(items, req.SortBy, req.SortOrder)
	start := (page - 1) * pageSize
	if start > len(items) {
		start = len(items)
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	pageItems := items[start:end]

	if !common.IsComputedSortColumn(req.SortBy) && req.SortBy != "" {
		pageRegisteredIDs := make([]int, 0, len(pageItems))
		for _, item := range pageItems {
			if item.User != nil && item.User.Id > 0 && item.IsRegistered {
				pageRegisteredIDs = append(pageRegisteredIDs, item.User.Id)
			}
		}
		populateDepartmentUserStats(pageItems, pageRegisteredIDs, req.StartTimestamp, req.EndTimestamp, userStats)
	}
	if !audience.forceRegisteredOnly && audience.company != nil {
		enrichDepartmentUserPageDisplayNames(pageItems, audience)
	}

	registered, unregistered := departmentUserRegistrationCounts(audience.users, audience.totalUsers, req.EndTimestamp)
	if audience.forceRegisteredOnly {
		registered = int64(len(audience.users))
		unregistered = 0
	}
	return &DepartmentUsersResponse{
		Items:             pageItems,
		Total:             int64(len(items)),
		Page:              page,
		Size:              pageSize,
		TotalUsers:        int64(audience.totalUsers),
		RegisteredUsers:   registered,
		UnregisteredUsers: unregistered,
	}, nil
}

// enrichDepartmentUserPageDisplayNames fills unregistered names for the current
// page only. It fetches Feishu/DingTalk member details solely for departments
// that own those open_ids on this page, instead of loading the whole subtree.
func enrichDepartmentUserPageDisplayNames(pageItems []DepartmentUserItem, audience *overviewAudience) {
	if len(pageItems) == 0 || audience == nil || audience.company == nil {
		return
	}
	unregisteredOpenIDs := make(map[string]bool)
	for _, item := range pageItems {
		if item.IsRegistered || item.User == nil || item.User.OpenId == "" {
			continue
		}
		unregisteredOpenIDs[item.User.OpenId] = true
	}
	if len(unregisteredOpenIDs) == 0 {
		return
	}

	departmentIDs := make([]string, 0)
	seenDepartments := make(map[string]bool)
	for _, member := range audience.members {
		if !unregisteredOpenIDs[member.OpenID] {
			continue
		}
		if member.ObservedDepartmentID == "" || seenDepartments[member.ObservedDepartmentID] {
			continue
		}
		seenDepartments[member.ObservedDepartmentID] = true
		departmentIDs = append(departmentIDs, member.ObservedDepartmentID)
	}
	if len(departmentIDs) == 0 {
		departmentIDs = audience.departmentIDs
	}
	if len(departmentIDs) == 0 {
		return
	}

	detailedMembers, err := collectCompanyMemberDetails(audience.company, departmentIDs)
	if err != nil || len(detailedMembers) == 0 {
		return
	}
	nameByOpenID := make(map[string]string, len(detailedMembers))
	for _, member := range detailedMembers {
		if member.OpenID == "" || member.Name == "" {
			continue
		}
		nameByOpenID[member.OpenID] = member.Name
	}
	for index := range pageItems {
		if pageItems[index].IsRegistered || pageItems[index].User == nil {
			continue
		}
		name := nameByOpenID[pageItems[index].User.OpenId]
		if name == "" {
			continue
		}
		pageItems[index].User.Username = name
		pageItems[index].User.DisplayName = name
	}
}

func populateDepartmentUserStats(items []DepartmentUserItem, ids []int, startTimestamp int64, endTimestamp int64, userStats *overviewUserStats) {
	if len(ids) == 0 {
		return
	}
	subscriptions, subscriptionErr := model.GetActiveSubscriptionQuotaByUserIds(ids)
	if userStats == nil {
		loadedStats, err := loadOverviewUserStats(ids, startTimestamp, endTimestamp)
		if err == nil {
			userStats = loadedStats
		}
	}
	models := make(map[int]string)
	modelRows, err := model.GetUserModelStatsBatch(ids, startTimestamp, endTimestamp)
	if err == nil {
		for _, row := range modelRows {
			if models[row.UserID] == "" {
				models[row.UserID] = row.ModelName
			}
		}
	}
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}
	exchangeRate := operation_setting.USDExchangeRate
	if exchangeRate <= 0 {
		exchangeRate = 1
	}
	for index := range items {
		userID := items[index].User.Id
		var stat model.UserStatRow
		hasStat := false
		if userStats != nil {
			stat, hasStat = userStats.byUserID[userID]
		}
		if subscription := subscriptions[userID]; subscription != nil {
			items[index].HasActiveSubscription = true
			items[index].SubQuotaUsed = subscription.AmountUsed
			items[index].SubQuotaTotal = subscription.AmountTotal
		} else if subscriptionErr == nil {
			items[index].SubQuotaUsed = stat.TotalQuota
			items[index].SubQuotaTotal = stat.TotalQuota + int64(items[index].User.Quota)
		}
		if hasStat {
			items[index].TotalAmountCNY = float64(stat.TotalQuota) / quotaPerUnit * exchangeRate
			items[index].TotalTokens = stat.TotalTokens
			items[index].TotalRequests = stat.TotalReqs
			if stat.TotalTokens > 0 {
				items[index].UnitPricePer100MTokens = items[index].TotalAmountCNY / (float64(stat.TotalTokens) / tokensPerHundredMillion)
			}
		}
		items[index].CommonModel = models[userID]
	}
}

func getCompanyDepartmentUserRankings(req *DepartmentUsersRequest) ([]UserRankingItem, error) {
	audience, _, err := resolveCompanyOverviewAudience(req.CompanyID, req.DepartmentID, req.RequestUserID, req.RequestUserRole, req.EndTimestamp)
	if err != nil {
		return nil, err
	}
	return buildCompanyDepartmentUserRankings(req, audience, nil)
}

func buildCompanyDepartmentUserRankings(req *DepartmentUsersRequest, audience *overviewAudience, userStats *overviewUserStats) ([]UserRankingItem, error) {
	if len(audience.registeredUserIDs) == 0 {
		return []UserRankingItem{}, nil
	}
	if userStats == nil {
		var err error
		userStats, err = loadOverviewUserStats(audience.registeredUserIDs, req.StartTimestamp, req.EndTimestamp)
		if err != nil {
			return nil, err
		}
	}
	rows := append([]model.UserStatRow(nil), userStats.rows...)
	sort.Slice(rows, func(i, j int) bool { return rows[i].TotalQuota > rows[j].TotalQuota })
	names := make(map[int][2]string, len(audience.users))
	for _, user := range audience.users {
		names[user.Id] = [2]string{user.Username, user.DisplayName}
	}
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}
	exchangeRate := operation_setting.USDExchangeRate
	if exchangeRate <= 0 {
		exchangeRate = 1
	}
	result := make([]UserRankingItem, 0, 10)
	for _, row := range rows {
		if row.TotalQuota <= 0 {
			continue
		}
		userNames := names[row.UserID]
		result = append(result, UserRankingItem{
			Username: userNames[0], DisplayName: userNames[1],
			TotalCost:   float64(row.TotalQuota) / float64(quotaPerUnit) * exchangeRate,
			TotalTokens: row.TotalTokens,
		})
		if len(result) == 10 {
			break
		}
	}
	return result, nil
}
