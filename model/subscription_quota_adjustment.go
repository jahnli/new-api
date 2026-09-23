package model

import (
	"errors"
	"math"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type SubscriptionQuotaAdjustment struct {
	QuotaDelta    int64    `json:"quota_delta"`
	QuotaType     string   `json:"quota_type"`
	TotalBefore   int64    `json:"total_before"`
	TotalAfter    int64    `json:"total_after"`
	PercentBefore *float64 `json:"percent_before,omitempty"`
	PercentAfter  *float64 `json:"percent_after,omitempty"`
}

// AdminAdjustUserSubscriptionQuota atomically adjusts the total and, for a model
// category, the user's percentage. Usage is retained; percentages persist across resets.
func AdminAdjustUserSubscriptionQuota(subscriptionID int, amountCNY float64, quotaType string, decrease bool) (*SubscriptionQuotaAdjustment, error) {
	if subscriptionID <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
	}
	if quotaType == "" {
		quotaType = "total"
	}
	if !slices.Contains([]string{"total", "basic", "premium"}, quotaType) {
		return nil, errors.New("invalid subscription quota type")
	}
	delta, err := convertSubscriptionCNYAmountToQuota(amountCNY)
	if err != nil {
		return nil, err
	}
	if decrease {
		delta = -delta
	}
	result := &SubscriptionQuotaAdjustment{QuotaDelta: delta, QuotaType: quotaType}
	err = subscriptionTransaction(func(tx *gorm.DB) error {
		var user User
		if quotaType != "total" {
			var owner UserSubscription
			if err := tx.Select("id", "user_id").First(&owner, subscriptionID).Error; err != nil {
				return err
			}
			// Match the user -> subscription lock order used by billing and resets.
			if err := lockForUpdate(tx).Select("id", "subscription_premium_percent").First(&user, owner.UserId).Error; err != nil {
				return err
			}
		}
		var sub UserSubscription
		if err := lockForUpdate(tx).First(&sub, subscriptionID).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		if quotaType != "total" && sub.UserId != user.Id || sub.Status != "active" || sub.EndTime > 0 && sub.EndTime <= now {
			return errors.New("只能调整有效订阅的额度")
		}
		if quotaType != "total" {
			plan, err := getSubscriptionPlanByIdTx(tx, sub.PlanId)
			if err != nil {
				return err
			}
			if err := maybeResetUserSubscriptionWithPlanTx(tx, &sub, plan, now); err != nil {
				return err
			}
		}
		if sub.AmountTotal < 0 || delta > 0 && sub.AmountTotal > math.MaxInt64-delta {
			return errors.New("调整后的订阅总额度超出支持范围")
		}
		if decrease && sub.AmountTotal <= 0 {
			return errors.New("无限额度订阅不能减少总额度")
		}
		if decrease && -delta >= sub.AmountTotal {
			return errors.New("减少额度必须小于当前总额度")
		}
		total := sub.AmountTotal + delta
		if decrease && total < sub.AmountUsed {
			return errors.New("减少后的总额度不能低于已使用额度")
		}
		result.TotalBefore, result.TotalAfter = sub.AmountTotal, total
		if quotaType != "total" {
			policy, err := GetSubscriptionPremiumPolicy(tx)
			if err != nil {
				return err
			}
			if !policy.Enabled || sub.AmountTotal <= 0 {
				return errors.New("分类调整额度需要启用高级模型额度限制并使用有限额度订阅")
			}
			var activeCount int64
			if err := tx.Model(&UserSubscription{}).Where("user_id = ? AND status = ? AND (end_time = 0 OR end_time > ?)", user.Id, "active", now).Count(&activeCount).Error; err != nil {
				return err
			}
			if activeCount != 1 {
				return errors.New("分类调整额度要求用户只有一个有效订阅")
			}
			percent := policy.DefaultPercent
			if user.SubscriptionPremiumPercent != nil {
				percent = *user.SubscriptionPremiumPercent
			}
			if !setting.ValidSubscriptionPremiumPercent(percent) || sub.AmountUsed < 0 || sub.PremiumAmountUsed < 0 || sub.PremiumAmountUsed > sub.AmountUsed {
				return errors.New("invalid subscription quota state")
			}
			premium := subscriptionPremiumLimit(sub.AmountTotal, percent)
			targetPremium := premium
			if quotaType == "premium" {
				targetPremium += delta
			}
			if targetPremium < 0 || targetPremium > total {
				return errors.New("减少额度不能超过所选模型类别的额度")
			}
			if decrease && (quotaType == "premium" && targetPremium < sub.PremiumAmountUsed || quotaType == "basic" && total-targetPremium < sub.AmountUsed-sub.PremiumAmountUsed) {
				return errors.New("减少后的模型额度不能低于已使用额度")
			}
			updatedPercent := decimal.NewFromInt(targetPremium).Mul(decimal.NewFromInt(100)).DivRound(decimal.NewFromInt(total), 2).InexactFloat64()
			roundedPremium := subscriptionPremiumLimit(total, updatedPercent)
			// Rounding must not introduce a new usage deficit in either category.
			if roundedPremium < min(premium, sub.PremiumAmountUsed) || total-roundedPremium < min(sub.AmountTotal-premium, sub.AmountUsed-sub.PremiumAmountUsed) {
				return errors.New("比例保留两位小数后额度低于已用量，请调整金额")
			}
			if user.SubscriptionPremiumPercent == nil || *user.SubscriptionPremiumPercent != updatedPercent {
				query := tx.Model(&User{}).Where("id = ?", user.Id)
				if user.SubscriptionPremiumPercent == nil {
					query = query.Where("subscription_premium_percent IS NULL")
				} else {
					query = query.Where("subscription_premium_percent = ?", *user.SubscriptionPremiumPercent)
				}
				update := query.Update("subscription_premium_percent", updatedPercent)
				if update.Error != nil {
					return update.Error
				}
				if update.RowsAffected != 1 {
					return ErrSubscriptionPolicyConflict
				}
			}
			result.PercentBefore, result.PercentAfter = &percent, &updatedPercent
		}
		update := tx.Model(&sub).Where("amount_total = ? AND quota_reset_version = ?", sub.AmountTotal, sub.QuotaResetVersion).
			Updates(map[string]any{"amount_total": total, "updated_at": now})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return ErrSubscriptionChargeConflict
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
