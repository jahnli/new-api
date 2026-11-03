package controller

import (
	"context"
	"errors"
	"mime"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// Called only after local logout succeeds and possession of an access token or
// refresh secret has established the session owner. Never log the returned URL.
func oidcLogoutResponse(c *gin.Context, userID int, sid string) gin.H {
	data := gin.H{}
	if c.Query("single_sign_out") != "true" {
		return data
	}
	session, err := model.GetUserSessionBySID(sid)
	if err != nil || session.UserID != userID {
		data["single_sign_out_unavailable"] = true
		return data
	}
	if session.LoginMethod != "oauth:oidc" {
		return data
	}
	hint, err := model.GetOIDCLogoutHint(userID, sid)
	if err == nil {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
		defer cancel()
		var logoutURL string
		logoutURL, err = oauth.BuildOIDCLogoutURL(ctx, hint, session.OIDC.SubjectKey)
		if err == nil {
			data["logout_url"] = logoutURL
			return data
		}
	}
	logger.LogWarn(c.Request.Context(), common.LogText("OIDC single sign-out unavailable after local logout"))
	data["single_sign_out_unavailable"] = true
	return data
}

func oidcSessionBinding(c *gin.Context) model.OIDCSessionBinding {
	value, _ := c.Get("oidc_session_binding")
	binding, _ := value.(model.OIDCSessionBinding)
	return binding
}

// OIDCBackchannelLogout authenticates the provider's signed assertion, never
// browser cookies. The provider may call this after interactive login is disabled.
func OIDCBackchannelLogout(c *gin.Context) {
	setAuthNoStore(c)
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/x-www-form-urlencoded" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64*1024)
	if err := c.Request.ParseForm(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	tokens := c.Request.PostForm["logout_token"]
	if len(tokens) != 1 || tokens[0] == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	settings := *system_setting.GetOIDCSettings()
	receipt, err := oauth.VerifyOIDCLogoutToken(c.Request.Context(), tokens[0], settings.WellKnown, settings.ClientId)
	if err != nil {
		// Do not log JWTs, claims or verifier errors that may contain token data.
		logger.LogWarn(c.Request.Context(), common.LogText("OIDC back-channel logout token validation failed"))
		if !errors.Is(err, oauth.ErrOIDCTokenInvalid) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "temporarily_unavailable"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	receipt.ExpiresAt = time.Now().Add(service.LoginSessionTTL + service.LoginVerificationTTL + time.Minute).Unix()
	count, err := model.ApplyOIDCLogout(*receipt)
	if err != nil {
		if errors.Is(err, model.ErrAuthFlowConsumed) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
			return
		}
		logger.LogError(c.Request.Context(), common.LogText("OIDC back-channel logout session revocation failed"))
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "temporarily_unavailable"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("OIDC back-channel logout completed: assertion_digest=%s revoked_sessions=%d", receipt.AssertionKey, count))
	c.Status(http.StatusOK)
}
