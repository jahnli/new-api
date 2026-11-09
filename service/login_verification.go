package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const LoginVerificationTTL = 5 * time.Minute

type LoginChallenge struct {
	RequireVerification bool                       `json:"require_verification"`
	FlowToken           string                     `json:"flow_token"`
	ExpiresAt           int64                      `json:"expires_at"`
	Methods             []VerificationMethodOption `json:"methods"`
}

type loginFlowPayload struct {
	OIDC         model.OIDCSessionBinding `json:"oidc"`
	AuthVersion  int64                    `json:"auth_version"`
	LoginMethod  string                   `json:"login_method"`
	OIDCUsername string                   `json:"oidc_username,omitempty"`
}

// LoginVerification is server-owned state read from a primary-authenticated flow.
// It is never constructed from a user ID or an authentication claim in a request.
type LoginVerification struct {
	Flow    *model.AuthFlow
	State   *model.UserVerificationState
	payload loginFlowPayload
}

func StartLoginVerification(user *model.User, loginMethod string, oidc ...model.OIDCSessionBinding) (*LoginChallenge, error) {
	return startLoginVerification(user, loginMethod, "", oidc...)
}

// StartOIDCLoginVerification carries the provider username through MFA without
// relying on the local username, which may differ for linked accounts.
func StartOIDCLoginVerification(user *model.User, username string, binding model.OIDCSessionBinding) (*LoginChallenge, error) {
	if !system_setting.IsOIDCUsernameAllowed(username) {
		return nil, ErrLoginSessionInvalid
	}
	return startLoginVerification(user, "oauth:oidc", username, binding)
}

func startLoginVerification(user *model.User, loginMethod, oidcUsername string, oidc ...model.OIDCSessionBinding) (*LoginChallenge, error) {
	if user == nil || user.Id <= 0 || user.AuthVersion <= 0 || loginMethod == "" {
		return nil, model.ErrAuthFlowInvalid
	}
	state, err := model.GetUserVerificationState(user.Id)
	if err != nil {
		return nil, err
	}
	if state.Status != common.UserStatusEnabled || state.AuthVersion != user.AuthVersion {
		return nil, model.ErrUserSessionInactive
	}
	methods, err := securityVerificationPolicy(VerificationScopeLogin, *state)
	if err != nil || len(methods) == 0 {
		return nil, err
	}
	available := false
	for _, method := range methods {
		available = available || method.Available
	}
	if !available {
		return nil, ErrVerificationUnavailable
	}
	flowPayload := loginFlowPayload{AuthVersion: state.AuthVersion, LoginMethod: loginMethod, OIDCUsername: oidcUsername}
	if len(oidc) > 0 {
		flowPayload.OIDC = oidc[0]
	}
	if err := model.CheckOIDCSessionActive(model.DB, flowPayload.OIDC); err != nil {
		return nil, err
	}
	payload, err := common.Marshal(flowPayload)
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(LoginVerificationTTL)
	token, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeLoginVerification, UserId: user.Id,
		Payload: string(payload), ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, err
	}
	return &LoginChallenge{RequireVerification: true, FlowToken: token, ExpiresAt: expiresAt.Unix(), Methods: methods}, nil
}

func RequireLoginVerification(token, method string) (*LoginVerification, error) {
	flow, err := model.GetAuthFlow(token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeLoginVerification})
	if err != nil {
		return nil, err
	}
	var payload loginFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil || payload.AuthVersion <= 0 || payload.LoginMethod == "" {
		return nil, model.ErrAuthFlowInvalid
	}
	state, err := model.GetUserVerificationState(flow.UserId)
	if err != nil {
		return nil, err
	}
	if state.Status != common.UserStatusEnabled || state.AuthVersion != payload.AuthVersion {
		return nil, model.ErrUserSessionInactive
	}
	if err := requireLoginVerificationMethod(state, method); err != nil {
		return nil, err
	}
	return &LoginVerification{Flow: flow, State: state, payload: payload}, nil
}

func requireLoginVerificationMethod(state *model.UserVerificationState, method string) error {
	methods, err := securityVerificationPolicy(VerificationScopeLogin, *state)
	if err != nil {
		return err
	}
	for _, option := range methods {
		if option.Method != method {
			continue
		}
		if !option.Available {
			return ErrVerificationUnavailable
		}
		return nil
	}
	return ErrProofMethod
}

func VerifyLoginCode(token, code, ip, userAgent string) (*AuthBundle, error) {
	verification, err := RequireLoginVerification(token, VerificationMethodTwoFA)
	if err != nil {
		return nil, err
	}
	twoFA, err := model.GetTwoFAByUserId(verification.State.UserID)
	if err != nil {
		return nil, err
	}
	if err := VerifyTwoFactorCode(twoFA, code); err != nil {
		return nil, err
	}
	return CompleteLoginVerification(token, verification, VerificationMethodTwoFA, ip, userAgent)
}

// CompleteLoginVerification must only run after a concrete factor ceremony.
// Recheck the bound version and method while consuming the flow and creating the
// session atomically; a different request cannot reuse this authorization.
func CompleteLoginVerification(token string, verification *LoginVerification, method, ip, userAgent string) (*AuthBundle, error) {
	if verification == nil || verification.Flow == nil || verification.State == nil {
		return nil, model.ErrAuthFlowInvalid
	}
	// Apply the current allowlist after any second factor, including Passkeys.
	if verification.payload.LoginMethod == "oauth:oidc" && !system_setting.IsOIDCUsernameAllowed(verification.payload.OIDCUsername) {
		return nil, ErrLoginSessionInvalid
	}
	session, refreshSecret, err := newLoginSession(verification.State.UserID, verification.payload.AuthVersion, verification.payload.LoginMethod, ip, userAgent, verification.payload.OIDC)
	if err != nil {
		return nil, err
	}
	if err := model.CreateUserSessionFromLoginFlow(token, session, func(flow *model.AuthFlow, state *model.UserVerificationState) error {
		var payload loginFlowPayload
		if flow.Id != verification.Flow.Id || common.UnmarshalJsonStr(flow.Payload, &payload) != nil || payload != verification.payload {
			return model.ErrAuthFlowInvalid
		}
		return requireLoginVerificationMethod(state, method)
	}); err != nil {
		return nil, err
	}
	bundle, err := issueAuthBundle(session, session.SID+"."+refreshSecret, true)
	if err != nil {
		_, _ = model.RevokeUserSession(session.UserID, session.SID, "token_issue_failed")
		return nil, err
	}
	return bundle, nil
}
