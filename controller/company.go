package controller

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type CompanyResponse struct {
	Id        int                   `json:"id"`
	Name      string                `json:"name"`
	Alias     string                `json:"alias"`
	Platform  string                `json:"platform"`
	Status    string                `json:"status"`
	SortOrder int                   `json:"sort_order"`
	Config    CompanyConfigResponse `json:"config"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
}

type CompanyConfigResponse struct {
	LoginMethods []string                      `json:"login_methods"`
	Feishu       CompanyFeishuConfigResponse   `json:"feishu"`
	DingTalk     CompanyDingTalkConfigResponse `json:"dingtalk"`
}

type CompanyFeishuConfigResponse struct {
	AppID      string `json:"app_id"`
	Configured bool   `json:"configured"`
}

type CompanyDingTalkConfigResponse struct {
	ClientID   string `json:"client_id"`
	AgentID    int64  `json:"agent_id"`
	Configured bool   `json:"configured"`
}

type CreateCompanyRequest struct {
	Name      string              `json:"name" binding:"required"`
	Alias     string              `json:"alias"`
	Platform  string              `json:"platform"`
	Status    string              `json:"status"`
	SortOrder int                 `json:"sort_order"`
	Config    model.CompanyConfig `json:"config"`
}

type UpdateCompanyRequest struct {
	Name      string              `json:"name" binding:"required"`
	Alias     string              `json:"alias"`
	Platform  string              `json:"platform"`
	Status    string              `json:"status"`
	SortOrder int                 `json:"sort_order"`
	Config    model.CompanyConfig `json:"config"`
}

type UpdateCompanyStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func toCompanyResponse(company *model.Company) (*CompanyResponse, error) {
	config, err := company.GetConfig()
	if err != nil {
		return nil, err
	}
	return &CompanyResponse{
		Id:        company.Id,
		Name:      company.Name,
		Alias:     company.Alias,
		Platform:  company.Platform,
		Status:    company.Status,
		SortOrder: company.SortOrder,
		Config: CompanyConfigResponse{
			LoginMethods: config.LoginMethods,
			Feishu: CompanyFeishuConfigResponse{
				AppID:      config.Feishu.AppID,
				Configured: config.Feishu.AppID != "" && config.Feishu.AppSecret != "",
			},
			DingTalk: CompanyDingTalkConfigResponse{
				ClientID:   config.DingTalk.ClientID,
				AgentID:    config.DingTalk.AgentID,
				Configured: config.DingTalk.ClientID != "" && config.DingTalk.ClientSecret != "",
			},
		},
		CreatedAt: company.CreatedAt,
		UpdatedAt: company.UpdatedAt,
	}, nil
}

func ListCompanies(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	companies, total, err := model.ListCompanies(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]*CompanyResponse, 0, len(companies))
	for _, company := range companies {
		item, err := toCompanyResponse(company)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		items = append(items, item)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetCompany(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的公司 ID")
		return
	}
	company, err := model.GetCompanyByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := toCompanyResponse(company)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func CreateCompany(c *gin.Context) {
	var request CreateCompanyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	company := &model.Company{
		Name:      request.Name,
		Alias:     request.Alias,
		Platform:  request.Platform,
		Status:    request.Status,
		SortOrder: request.SortOrder,
	}
	if err := company.SetConfig(request.Config); err != nil {
		common.ApiError(c, err)
		return
	}
	duplicated, err := model.IsCompanyNameTaken(company.Name, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if duplicated {
		common.ApiErrorMsg(c, "公司名称已存在")
		return
	}
	if err := model.CreateCompany(company); err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := toCompanyResponse(company)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func UpdateCompany(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的公司 ID")
		return
	}
	var request UpdateCompanyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	company, err := model.GetCompanyByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	oldConfig, err := company.GetConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if request.Config.Feishu.AppSecret == "" {
		request.Config.Feishu.AppSecret = oldConfig.Feishu.AppSecret
	}
	if request.Config.DingTalk.ClientSecret == "" {
		request.Config.DingTalk.ClientSecret = oldConfig.DingTalk.ClientSecret
	}
	if err := company.SetConfig(request.Config); err != nil {
		common.ApiError(c, err)
		return
	}
	company.Name = request.Name
	company.Alias = request.Alias
	company.Platform = request.Platform
	if request.Status != "" {
		company.Status = request.Status
	}
	company.SortOrder = request.SortOrder
	duplicated, err := model.IsCompanyNameTaken(company.Name, company.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if duplicated {
		common.ApiErrorMsg(c, "公司名称已存在")
		return
	}
	if err := model.UpdateCompany(company); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateCompanyOverviewCache(company.Id)
	response, err := toCompanyResponse(company)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func SetCompanyStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的公司 ID")
		return
	}
	var request UpdateCompanyStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	company, err := model.UpdateCompanyStatus(id, request.Status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateCompanyOverviewCache(company.Id)
	response, err := toCompanyResponse(company)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func TestCompanyConnection(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的公司 ID")
		return
	}
	company, err := model.GetCompanyByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.TestCompanyConnection(company)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
