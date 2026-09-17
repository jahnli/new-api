package service

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/bytedance/gopkg/util/gopool"
)

// Keep host subscription policy outside the protocol-only RelayKit module.
const errorCodeSubscriptionPremiumQuotaInsufficient types.ErrorCode = "subscription_premium_quota_insufficient"
const notifyTypeSubscriptionPremiumQuotaInsufficient = "subscription_premium_quota_insufficient"

func subscriptionPremiumQuotaError(walletInsufficient bool) *types.AIGatewayError {
	message := "订阅高阶模型额度不足，无法满足本次请求的预扣额度。普通模型仍可使用订阅剩余总额度；请等待额度重置或联系管理员调整高阶额度比例。"
	if walletInsufficient {
		message = "订阅高阶模型额度不足，且钱包余额不足，无法支付本次请求。普通模型仍可使用订阅剩余总额度；请等待额度重置、联系管理员调整高阶额度比例，或充值钱包后按计费偏好使用。"
	}
	return types.NewErrorWithStatusCode(errors.New(message), errorCodeSubscriptionPremiumQuotaInsufficient, http.StatusForbidden,
		types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

// Notify on a rejected premium reservation, including when wallet fallback succeeds.
// Use a separate rate-limit category so wallet/total quota alerts cannot suppress it.
func notifySubscriptionPremiumQuotaInsufficient(info *relaycommon.RelayInfo) {
	if info == nil {
		return
	}
	userID, email, settings := info.UserId, info.UserEmail, info.UserSetting
	gopool.Go(func() {
		const title = "您的订阅高阶模型额度不足"
		const content = "您的订阅高阶模型可用额度不足以满足本次请求的预扣额度。普通模型仍可使用订阅剩余总额度。请等待额度重置或联系管理员调整高阶额度比例；如需使用钱包支付，请确认计费偏好和套餐允许钱包回退。充值钱包不会直接增加订阅高阶额度。本通知不代表请求最终失败，系统仍会按原设置尝试钱包支付。"
		if err := NotifyUser(userID, email, settings, dto.NewNotify(notifyTypeSubscriptionPremiumQuotaInsufficient, title, content, nil)); err != nil {
			common.SysError(fmt.Sprintf("failed to send subscription premium quota notification to user %d: %s", userID, err.Error()))
		}
	})
}
