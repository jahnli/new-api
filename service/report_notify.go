package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var (
	ErrReportNotifyUserUnavailable = errors.New("report notify user is missing, disabled, or has no recipient open_id")
	ErrReportNotifyTimeRange       = errors.New("invalid report notify time range")
)

type ReportNotifyUserReportsRequest struct {
	UserID         int   `json:"user_id"`
	StartTimestamp int64 `json:"start_timestamp"`
	EndTimestamp   int64 `json:"end_timestamp"`
}

type ReportNotifyReport struct {
	CompanyID      int                     `json:"company_id"`
	DepartmentID   string                  `json:"department_id"`
	DepartmentName string                  `json:"department_name"`
	Stats          *model.DepartmentStat   `json:"stats"`
	SubStats       []SubDepartmentStatItem `json:"sub_stats"`
}

type ReportNotifyUserReportsResponse struct {
	RecipientOpenID string               `json:"recipient_open_id"`
	Reports         []ReportNotifyReport `json:"reports"`
}

type reportNotifyScope struct {
	company        *model.Company
	departmentID   string
	departmentName string
}

// GetReportNotifyUserReports derives notification scopes from the target
// user's explicitly configured visible departments and leader relationships, then builds
// each scope's statistics with the same builders used by data overview.
func GetReportNotifyUserReports(req *ReportNotifyUserReportsRequest) (*ReportNotifyUserReportsResponse, error) {
	if req == nil || req.UserID <= 0 || req.StartTimestamp <= 0 || req.EndTimestamp <= 0 || req.StartTimestamp > req.EndTimestamp {
		return nil, ErrReportNotifyTimeRange
	}

	user, err := model.GetUserById(req.UserID, false)
	if err != nil || user.Status != common.UserStatusEnabled || strings.TrimSpace(user.OpenId) == "" {
		return nil, ErrReportNotifyUserUnavailable
	}
	scopes, err := getReportNotifyScopes(user)
	if err != nil {
		return nil, err
	}
	response := &ReportNotifyUserReportsResponse{
		RecipientOpenID: user.OpenId,
		Reports:         make([]ReportNotifyReport, 0, len(scopes)),
	}
	for _, scope := range scopes {
		statsRequest := &DepartmentStatsRequest{
			CompanyID:      scope.company.Id,
			DepartmentID:   scope.departmentID,
			StartTimestamp: req.StartTimestamp,
			EndTimestamp:   req.EndTimestamp,
			RequestUserID:  user.Id,
			// The trusted internal endpoint has already derived this exact scope
			// from the user's configured departments or explicit leader relationship. Use root
			// authorization only to avoid data-overview role precedence hiding a
			// leader scope when the same person is also a BP.
			RequestUserRole: common.RoleRootUser,
		}
		audience, _, err := resolveCompanyOverviewAudience(
			statsRequest.CompanyID,
			statsRequest.DepartmentID,
			statsRequest.RequestUserID,
			statsRequest.RequestUserRole,
			statsRequest.EndTimestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("resolve report scope %q: %w", scope.departmentName, err)
		}
		stats, err := buildCompanyDepartmentStats(statsRequest, audience, nil)
		if err != nil {
			return nil, fmt.Errorf("build report stats for %q: %w", scope.departmentName, err)
		}
		subStats, err := buildCompanySubDepartmentStats(statsRequest, audience, nil)
		if err != nil {
			return nil, fmt.Errorf("build report related departments for %q: %w", scope.departmentName, err)
		}
		response.Reports = append(response.Reports, ReportNotifyReport{
			CompanyID:      scope.company.Id,
			DepartmentID:   scope.departmentID,
			DepartmentName: scope.departmentName,
			Stats:          stats,
			SubStats:       subStats,
		})
	}
	return response, nil
}

func getReportNotifyScopes(user *model.User) ([]reportNotifyScope, error) {
	explicitOnly := operation_setting.ExternalModeEnabled && UsesOverviewDepartments(user.Role)
	var leaderDepartmentIDs []string
	if !explicitOnly {
		leaderDepartmentIDs = user.GetLeaderDepartmentIDs()
	}
	overviewDepartmentIDs := ParseOverviewDeptIDs(user.OverviewDeptIDs)
	if len(overviewDepartmentIDs) == 0 && len(leaderDepartmentIDs) == 0 {
		return []reportNotifyScope{}, nil
	}

	companies, err := model.ListEnabledCompanies()
	if err != nil {
		return nil, fmt.Errorf("list enabled companies: %w", err)
	}

	scopes := make([]reportNotifyScope, 0)
	for _, company := range companies {
		if explicitOnly && !canSeeOverviewCompany(company, user, user.Role) {
			continue
		}
		if !explicitOnly && user.Company != company.Name {
			continue
		}
		if hasOverviewCompanyGrant(overviewDepartmentIDs, user.Role, company.Id) {
			scopes = append(scopes, reportNotifyScope{
				company:        company,
				departmentID:   companyNodeValue(company.Id),
				departmentName: company.Name,
			})
			continue
		}
		if company.Platform == model.CompanyPlatformNone {
			continue
		}

		directory, err := fetchCompanyDirectory(company)
		if err != nil {
			return nil, fmt.Errorf("fetch company %q directory: %w", company.Name, err)
		}
		if directory.OrganizationName != company.Name {
			return nil, fmt.Errorf("organization name %q does not exactly match company name %q", directory.OrganizationName, company.Name)
		}
		fullTree := buildOverviewDepartmentTree(company.Id, company.Platform, directory.Departments)

		for _, departmentID := range overviewDepartmentIDs {
			path, found := findReportNotifyNodePath(fullTree, departmentID, nil)
			if !found {
				continue
			}
			scopes = append(scopes, reportNotifyScope{
				company:        company,
				departmentID:   departmentID,
				departmentName: strings.Join(path, " / "),
			})
		}

		prefixedLeaderDepartmentIDs := prefixLeaderDepartmentIDs(company.Id, leaderDepartmentIDs)
		for _, departmentID := range prefixedLeaderDepartmentIDs {
			path, found := findReportNotifyNodePath(fullTree, departmentID, nil)
			if !found {
				continue
			}
			scopes = append(scopes, reportNotifyScope{
				company:        company,
				departmentID:   departmentID,
				departmentName: strings.Join(path, " / "),
			})
		}
	}
	return scopes, nil
}

func findReportNotifyNodePath(nodes []*DeptTreeNode, value string, parents []string) ([]string, bool) {
	for _, node := range nodes {
		path := append(append([]string{}, parents...), node.Label)
		if node.Value == value {
			return path, true
		}
		if childPath, found := findReportNotifyNodePath(node.Children, value, path); found {
			return childPath, true
		}
	}
	return nil, false
}
