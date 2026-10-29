package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// LDAPLoginRequest 是 LDAP 登录请求体。
type LDAPLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LDAPBindRequest 是已登录用户绑定 LDAP 账号的请求体。
type LDAPBindRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LDAPLogin 处理 LDAP 登录：认证通过后查找或创建用户，并建立登录态。
func LDAPLogin(c *gin.Context) {
	if !system_setting.GetLDAPSettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgLDAPNotEnabled)
		return
	}

	var req LDAPLoginRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.Username == "" || req.Password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	ldapUser, err := service.AuthenticateLDAP(req.Username, req.Password)
	if err != nil {
		common.SysError("LDAP 认证失败: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgLDAPAuthFailed)
		return
	}

	user, err := findOrCreateLDAPUser(c, ldapUser)
	if err != nil {
		switch err.(type) {
		case *LDAPRegistrationDisabledError:
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		case *LDAPUserDeletedError:
			common.ApiErrorI18n(c, i18n.MsgLDAPUserDeleted)
		default:
			common.ApiErrorMsg(c, err.Error())
		}
		return
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgLDAPUserBanned)
		return
	}

	// Resolve providers using the current directory OU, including for existing
	// users. The copy keeps the persisted company display name unchanged.
	_, companySyncCfg, hasSyncCfg := system_setting.ResolveLDAPCompany(ldapUser.Company)
	if hasSyncCfg {
		syncUser := *user
		syncUser.Company = ldapUser.Company
		var syncErr error
		switch companySyncCfg.SyncPlatform {
		case system_setting.LDAPSyncPlatformDingTalk:
			if ldapUser.DingTalkUserID == "" {
				syncErr = errors.New("LDAP DingTalk user ID is empty")
			} else {
				syncErr = service.SyncDingTalkUser(&syncUser, ldapUser.DingTalkUserID)
			}
		case system_setting.LDAPSyncPlatformFeishu:
			syncErr = service.SyncFeishuUser(&syncUser)
		}
		if syncErr != nil {
			common.SysError(common.LogText("LDAP directory sync failed user_id=%d platform=%s", user.Id, companySyncCfg.SyncPlatform))
		}
	}

	setupLogin(user, c)
}

// findOrCreateLDAPUser 以 username 唯一关联用户：若用户名已存在则返回已有用户，
// 否则在注册开启时创建新用户。平台资料由登录流程统一同步。
func findOrCreateLDAPUser(c *gin.Context, ldapUser *service.LDAPUserInfo) (*model.User, error) {
	user := &model.User{}

	// 以 username 查找已有用户（含软删除，避免账号被删后被同名顶替）
	username := ldapUser.Username
	if username == "" {
		return nil, fmt.Errorf("ldap username is empty")
	}
	company, companySyncCfg, hasSyncCfg := system_setting.ResolveLDAPCompany(ldapUser.Company)

	existing, err := model.GetUnscopedUserByUsernameCaseInsensitive(username)
	if err == nil {
		// 找到用户
		if existing.DeletedAt.Valid {
			return nil, &LDAPUserDeletedError{}
		}
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// 不存在则创建
	if !common.RegisterEnabled {
		return nil, &LDAPRegistrationDisabledError{}
	}

	user.Username = username
	if len(user.Username) > model.UserNameMaxLength {
		user.Username = user.Username[:model.UserNameMaxLength]
	}

	if ldapUser.DisplayName != "" {
		user.DisplayName = ldapUser.DisplayName
	} else {
		user.DisplayName = user.Username
	}
	user.Company = model.NormalizeCompany(company)

	syncPlatform := system_setting.LDAPSyncPlatformNone
	if hasSyncCfg {
		syncPlatform = companySyncCfg.SyncPlatform
	}

	switch syncPlatform {
	case system_setting.LDAPSyncPlatformDingTalk:
		// 钉钉平台：email 由同步接口从钉钉获取，注册时留空。
		user.Email = ""
	case system_setting.LDAPSyncPlatformFeishu:
		// 飞书平台：已配置的邮箱后缀优先于 LDAP 邮箱属性。
		emailSuffix := ""
		if hasSyncCfg {
			emailSuffix = companySyncCfg.FeishuEmailSuffix
		}
		user.Email = resolveLDAPRegistrationEmail(user.Username, ldapUser.Email, emailSuffix)
	default:
		// 无同步：直接使用 LDAP 邮箱属性。
		user.Email = ldapUser.Email
	}

	user.Role = common.RoleCommonUser
	user.Status = common.UserStatusEnabled

	if err := user.Insert(); err != nil {
		return nil, err
	}

	if hasSyncCfg {
		if companySyncCfg.AutoSubscribePlanId > 0 {
			if msg, err := model.AdminBindSubscription(user.Id, companySyncCfg.AutoSubscribePlanId, "ldap_register_auto"); err != nil {
				common.SysError(fmt.Sprintf("[ldap_register_auto] auto-subscribe failed for user %d plan %d: %v",
					user.Id, companySyncCfg.AutoSubscribePlanId, err))
			} else {
				common.SysLog(fmt.Sprintf("[ldap_register_auto] auto-subscribe succeeded for user %d plan %d: %s",
					user.Id, companySyncCfg.AutoSubscribePlanId, msg))
			}
		}
	} else {
		autoSubscribeUserAfterCreate(user.Id, user.Company, "ldap_register_auto")
	}

	return user, nil
}

// resolveLDAPRegistrationEmail applies the registration email precedence used by LDAP users.
func resolveLDAPRegistrationEmail(username, ldapEmail, feishuEmailSuffix string) string {
	if feishuEmailSuffix != "" {
		return username + feishuEmailSuffix
	}
	return ldapEmail
}

// LDAPBind 供已登录用户绑定 LDAP 账号。
func LDAPBind(c *gin.Context) {
	if !system_setting.GetLDAPSettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgLDAPNotEnabled)
		return
	}

	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		common.ApiErrorI18n(c, i18n.MsgLDAPNotEnabled)
		return
	}
	user := model.User{Id: identity.UserID}
	if err := user.FillUserById(); err != nil || user.Id == 0 {
		common.ApiErrorMsg(c, "user not found")
		return
	}

	var req LDAPBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.Username == "" || req.Password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	ldapUser, err := service.AuthenticateLDAP(req.Username, req.Password)
	if err != nil {
		common.SysError("LDAP 绑定认证失败: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgLDAPAuthFailed)
		return
	}
	company, companySyncCfg, hasSyncCfg := system_setting.ResolveLDAPCompany(ldapUser.Company)

	// 以 username 唯一关联：若 LDAP 用户名已被其他账号占用则拒绝
	if ldapUser.Username != "" && ldapUser.Username != user.Username {
		other, err := model.GetUnscopedUserByUsernameCaseInsensitive(ldapUser.Username)
		if err == nil && other.Id != user.Id {
			common.ApiErrorI18n(c, i18n.MsgLDAPBindConflict)
			return
		}
		// 将当前用户的 username 改为 LDAP 用户名，使其与 LDAP 账号关联
		user.Username = ldapUser.Username
	}

	if ldapUser.DisplayName != "" {
		user.DisplayName = ldapUser.DisplayName
	}
	if company != "" {
		user.Company = model.NormalizeCompany(company)
	}

	if err := user.Edit(false); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	// 绑定时也尝试异步同步一次平台字段（钉钉或飞书）。
	if hasSyncCfg {
		switch companySyncCfg.SyncPlatform {
		case system_setting.LDAPSyncPlatformDingTalk:
			service.SyncDingTalkUserAsync(&user, ldapUser.DingTalkUserID)
		case system_setting.LDAPSyncPlatformFeishu:
			service.SyncFeishuUserAsync(&user)
		}
	}

	common.ApiSuccess(c, nil)
}

// TestLDAPConnection 供管理员测试 LDAP 连通性。
func TestLDAPConnection(c *gin.Context) {
	if err := service.TestLDAPConnection(); err != nil {
		common.SysError("LDAP 连接测试失败: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgLDAPTestFailed)
		return
	}
	common.ApiSuccessI18n(c, i18n.MsgLDAPTestSuccess, nil)
}

// LDAPRegistrationDisabledError 表示注册未开启时尝试通过 LDAP 创建新用户。
type LDAPRegistrationDisabledError struct{}

func (e *LDAPRegistrationDisabledError) Error() string {
	return "ldap registration is disabled"
}

// LDAPUserDeletedError 表示匹配到的 LDAP 用户已被软删除。
type LDAPUserDeletedError struct{}

func (e *LDAPUserDeletedError) Error() string {
	return "ldap user has been deleted"
}
