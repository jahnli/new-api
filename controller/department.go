package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetDepartmentTree(c *gin.Context) {
	userID := c.GetInt("id")
	userRole := c.GetInt("role")

	resp, err := service.GetDepartmentTree(userID, userRole)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    resp,
	})
}

// GetFullDepartmentTreeForAdmin returns the complete unfiltered department tree
// for all configured companies. Only accessible by admin users; used when
// configuring visible departments for BP users.
func GetFullDepartmentTreeForAdmin(c *gin.Context) {
	resp, err := service.GetFullDepartmentTree()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    resp,
	})
}

// GetCompanyDepartmentSubtree lazily loads a single company's department subtree.
// The department tree endpoint only eagerly loads the first company; other
// companies are returned as company-level nodes with loading=true, and the
// frontend calls this endpoint to fetch their departments on demand.
func GetCompanyDepartmentSubtree(c *gin.Context) {
	userID := c.GetInt("id")
	userRole := c.GetInt("role")

	companyID, err := strconv.Atoi(c.Query("company_id"))
	if err != nil || companyID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "company_id is required",
		})
		return
	}

	resp, err := service.GetCompanySubtreeNode(companyID, userID, userRole)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    resp,
	})
}

func GetDepartmentStats(c *gin.Context) {
	var req service.DepartmentStatsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	stat, err := service.GetDepartmentStats(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stat,
	})
}

func GetDepartmentOverview(c *gin.Context) {
	var req service.DepartmentOverviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetDepartmentOverview(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetSubDepartmentStats(c *gin.Context) {
	var req service.DepartmentStatsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	items, err := service.GetSubDepartmentStats(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
	})
}

func GetUsageAnalysis(c *gin.Context) {
	var req service.DepartmentStatsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetUsageAnalysis(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetDepartmentLogs(c *gin.Context) {
	var req service.DepartmentLogsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetDepartmentLogs(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetDepartmentUserLogs(c *gin.Context) {
	var req service.DepartmentUserLogsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "user_id is required",
		})
		return
	}
	if !validateDepartmentUserCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetDepartmentUserLogs(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetDepartmentUsers(c *gin.Context) {
	var req service.DepartmentUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetDepartmentUsers(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetUserUsageAnalysis(c *gin.Context) {
	var req service.UserUsageAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "user_id is required",
		})
		return
	}
	if !validateDepartmentUserCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetUserUsageAnalysis(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetDepartmentUserRankings(c *gin.Context) {
	var req service.DepartmentUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.DepartmentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "department_id is required",
		})
		return
	}
	if !validateDepartmentCompanyID(c, req.CompanyID, req.DepartmentID) {
		return
	}
	req.RequestUserID = c.GetInt("id")
	req.RequestUserRole = c.GetInt("role")

	data, err := service.GetDepartmentUserRankings(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func validateDepartmentCompanyID(c *gin.Context, companyID int, departmentID string) bool {
	if service.IsGlobalOverviewScope(companyID, departmentID) {
		if c.GetInt("role") >= common.RoleRootUser {
			return true
		}
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": service.ErrOverviewAccessDenied.Error()})
		return false
	}
	if companyID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": service.ErrCompanyIDRequired.Error(),
		})
		return false
	}
	return true
}

func validateDepartmentUserCompanyID(c *gin.Context, companyID int, departmentID string) bool {
	if service.IsGlobalOverviewScope(companyID, departmentID) {
		if c.GetInt("role") >= common.RoleRootUser {
			return true
		}
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": service.ErrOverviewAccessDenied.Error()})
		return false
	}
	if companyID <= 0 {
		userRole := c.GetInt("role")
		if userRole >= common.RoleAdminUser {
			return true
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": service.ErrCompanyIDRequired.Error(),
		})
		return false
	}
	return true
}
