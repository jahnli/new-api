package model

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrSubscriptionPolicyConflict = errors.New("subscription policy changed; refresh and try again")
	ErrSubscriptionPremiumQuota   = errors.New("subscription_premium_quota_insufficient")
	ErrSubscriptionQuota          = errors.New("subscription quota insufficient")
	ErrNoActiveSubscription       = errors.New("no active subscription")
	ErrSubscriptionChargeConflict = errors.New("subscription charge state changed")
)

// subscriptionTransaction retries only transactions whose database writes were rolled back.
func subscriptionTransaction(fn func(*gorm.DB) error) error {
	var err error
	for attempt := range 3 {
		err = DB.Transaction(fn)
		if err == nil {
			return nil
		}
		message := strings.ToLower(err.Error())
		if !strings.Contains(message, "database is locked") && !strings.Contains(message, "database table is locked") && !strings.Contains(message, "deadlock") && !strings.Contains(message, "serialization failure") {
			return err
		}
		time.Sleep(time.Duration(attempt+1) * 10 * time.Millisecond)
	}
	return err
}

func GetSubscriptionPremiumPolicy(tx *gorm.DB) (setting.SubscriptionPremiumPolicy, error) {
	policy := setting.DefaultSubscriptionPremiumPolicy()
	var option Option
	err := tx.Where(&Option{Key: setting.SubscriptionPremiumPolicyKey}).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return policy, nil
	}
	if err != nil {
		return policy, err
	}
	if err := common.UnmarshalJsonStr(option.Value, &policy); err != nil {
		return policy, err
	}
	if !setting.ValidSubscriptionPremiumPercent(policy.DefaultPercent) || policy.Version < 1 {
		return policy, errors.New("invalid subscription premium policy")
	}
	return policy, nil
}

func SaveSubscriptionPremiumPolicy(policy setting.SubscriptionPremiumPolicy, expected int64, available []string) (setting.SubscriptionPremiumPolicy, error) {
	if !setting.ValidSubscriptionPremiumPercent(policy.DefaultPercent) || len(policy.ModelNames) > 10000 {
		return policy, errors.New("invalid premium percentage or model count")
	}
	err := subscriptionTransaction(func(tx *gorm.DB) error {
		previous, err := GetSubscriptionPremiumPolicy(tx)
		if err != nil {
			return err
		}
		if previous.Version != expected || expected == math.MaxInt64 {
			return ErrSubscriptionPolicyConflict
		}
		for _, name := range policy.ModelNames {
			if name == "" || name != strings.TrimSpace(name) || len(name) > 512 || (!slices.Contains(available, name) && !slices.Contains(previous.ModelNames, name)) {
				return fmt.Errorf("invalid premium model: %q", name)
			}
		}
		slices.Sort(policy.ModelNames)
		policy.ModelNames = slices.Compact(policy.ModelNames)
		if policy.ModelNames == nil {
			policy.ModelNames = []string{}
		}
		policy.Version = expected + 1
		policy.FirstEnabledAt = previous.FirstEnabledAt
		if policy.Enabled && policy.FirstEnabledAt == 0 {
			policy.FirstEnabledAt = GetDBTimestamp()
		}
		encoded, err := common.Marshal(policy)
		if err != nil {
			return err
		}
		var stored Option
		err = tx.Where(&Option{Key: setting.SubscriptionPremiumPolicyKey}).First(&stored).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			created := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{Key: setting.SubscriptionPremiumPolicyKey, Value: string(encoded)})
			if created.Error != nil {
				return created.Error
			}
			if created.RowsAffected != 1 {
				return ErrSubscriptionPolicyConflict
			}
			return nil
		}
		if err != nil {
			return err
		}
		var actual setting.SubscriptionPremiumPolicy
		if err := common.UnmarshalJsonStr(stored.Value, &actual); err != nil {
			return err
		}
		if actual.Version != expected {
			return ErrSubscriptionPolicyConflict
		}
		res := tx.Model(&Option{}).Where(&Option{Key: stored.Key}).Where("value = ?", stored.Value).Update("value", string(encoded))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrSubscriptionPolicyConflict
		}
		return nil
	})
	return policy, err
}

func UpdateSubscriptionPremiumPercent(userID int, percent, expected *float64) error {
	if userID <= 0 || percent != nil && !setting.ValidSubscriptionPremiumPercent(*percent) || expected != nil && !setting.ValidSubscriptionPremiumPercent(*expected) {
		return errors.New("invalid premium percentage")
	}
	return subscriptionTransaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id", "subscription_premium_percent").First(&user, userID).Error; err != nil {
			return err
		}
		current := user.SubscriptionPremiumPercent
		if (current == nil) != (expected == nil) || current != nil && *current != *expected {
			return ErrSubscriptionPolicyConflict
		}
		query := tx.Model(&User{}).Where("id = ?", userID)
		if expected == nil {
			query = query.Where("subscription_premium_percent IS NULL")
		} else {
			query = query.Where("subscription_premium_percent = ?", *expected)
		}
		if (percent == nil && expected == nil) || percent != nil && expected != nil && *percent == *expected {
			return nil
		}
		result := query.Update("subscription_premium_percent", percent)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrSubscriptionPolicyConflict
		}
		return nil
	})
}

func subscriptionPremiumLimit(total int64, percent float64) int64 {
	if total <= 0 || !setting.ValidSubscriptionPremiumPercent(percent) {
		return 0
	}
	// Basis points are bounded to [0, 10000]; splitting avoids overflowing total*basisPoints.
	basisPoints := int64(math.Round(percent * 100))
	return (total/10000)*basisPoints + (total%10000)*basisPoints/10000
}

type SubscriptionPremiumQuota struct {
	Enabled          bool    `json:"enabled"`
	EffectivePercent float64 `json:"effective_percent"`
	PercentSource    string  `json:"percent_source"`
	AmountUsed       string  `json:"premium_amount_used"`
	Limit            string  `json:"premium_limit"`
	Available        string  `json:"premium_available"`
	OverLimit        string  `json:"over_limit_quota"`
	TrackedSince     int64   `json:"tracked_since"`
}

func AttachSubscriptionPremiumQuota(userID int, summaries []SubscriptionSummary) error {
	policy, err := GetSubscriptionPremiumPolicy(DB)
	if err != nil {
		return err
	}
	var user User
	if err := DB.Select("id", "subscription_premium_percent").First(&user, userID).Error; err != nil {
		return err
	}
	percent, source := policy.DefaultPercent, "default"
	if user.SubscriptionPremiumPercent != nil {
		percent, source = *user.SubscriptionPremiumPercent, "user"
	}
	for i := range summaries {
		sub := summaries[i].Subscription
		limit := subscriptionPremiumLimit(sub.AmountTotal, percent)
		available := max(int64(0), min(sub.AmountTotal-sub.AmountUsed, limit-sub.PremiumAmountUsed))
		summaries[i].PremiumQuota = &SubscriptionPremiumQuota{
			Enabled: policy.Enabled, EffectivePercent: percent, PercentSource: source,
			AmountUsed: strconv.FormatInt(sub.PremiumAmountUsed, 10), Limit: strconv.FormatInt(limit, 10),
			Available: strconv.FormatInt(available, 10), OverLimit: strconv.FormatInt(max(0, sub.PremiumAmountUsed-limit), 10), TrackedSince: policy.FirstEnabledAt,
		}
	}
	return nil
}

// SubscriptionChargeContext is stored in TEXT to work identically on all main databases.
type SubscriptionChargeContext struct {
	Applied                bool    `json:"-"`
	SchemaVersion          int     `json:"schema_version"`
	BillingModelName       string  `json:"billing_model_name"`
	IsPremium              bool    `json:"is_premium"`
	LimitEnabled           bool    `json:"limit_enabled"`
	ResetVersion           int64   `json:"quota_reset_version"`
	AccountedQuota         int64   `json:"accounted_quota"`
	Phase                  string  `json:"phase"`
	Revision               int64   `json:"revision"`
	EffectivePercent       float64 `json:"effective_percent"`
	PolicyVersion          int64   `json:"policy_version"`
	PremiumOverLimit       int64   `json:"premium_over_limit_quota,omitempty"`
	PendingTarget          *int64  `json:"pending_target_quota,omitempty"`
	OriginalSubscriptionID int     `json:"original_subscription_id,omitempty"`
}

func (r *SubscriptionPreConsumeRecord) ChargeContext() (SubscriptionChargeContext, error) {
	var ctx SubscriptionChargeContext
	if r.BillingContext == "" {
		return ctx, nil
	}
	err := common.UnmarshalJsonStr(r.BillingContext, &ctx)
	if err == nil && (ctx.SchemaVersion != 1 || ctx.AccountedQuota < 0 || ctx.AccountedQuota > math.MaxInt32 || ctx.Revision < 1 || ctx.ResetVersion < 1 || !setting.ValidSubscriptionPremiumPercent(ctx.EffectivePercent) ||
		!slices.Contains([]string{"reserved", "settled", "refunded", "settlement_pending"}, ctx.Phase) ||
		(ctx.PendingTarget != nil && (*ctx.PendingTarget < 0 || *ctx.PendingTarget > math.MaxInt32)) ||
		(ctx.Phase == "settlement_pending") != (ctx.PendingTarget != nil)) {
		err = errors.New("invalid subscription charge context")
	}
	return ctx, err
}

func (r *SubscriptionPreConsumeRecord) setChargeContext(ctx SubscriptionChargeContext) error {
	data, err := common.Marshal(ctx)
	if err != nil {
		return err
	}
	r.BillingContext, r.Status = string(data), ctx.Phase
	return nil
}

// UpdateSubscriptionCharge uses a durable revision and target amount, never a replayable delta.
// A closed period keeps its final request accounting but cannot affect the current balance.
func UpdateSubscriptionCharge(requestID string, userID int, target, revision int64, phase string) (SubscriptionChargeContext, error) {
	var result SubscriptionChargeContext
	if requestID == "" || userID <= 0 || target < 0 || target > math.MaxInt32 || revision < 2 || (phase != "reserved" && phase != "settled" && phase != "refunded") {
		return result, errors.New("invalid subscription charge update")
	}
	var deferredError error
	err := subscriptionTransaction(func(tx *gorm.DB) error {
		result = SubscriptionChargeContext{}
		deferredError = nil
		var user User
		if err := lockForUpdate(tx).Select("id", "subscription_premium_percent").First(&user, userID).Error; err != nil {
			return err
		}
		var record SubscriptionPreConsumeRecord
		if err := tx.Where("request_id = ? AND user_id = ?", requestID, userID).First(&record).Error; err != nil {
			return err
		}
		var sub UserSubscription
		if err := lockForUpdate(tx).First(&sub, record.UserSubscriptionId).Error; err != nil {
			return err
		}
		if err := lockForUpdate(tx).First(&record, record.Id).Error; err != nil {
			return err
		}
		if record.UserSubscriptionId != sub.Id || sub.UserId != userID {
			return ErrSubscriptionChargeConflict
		}
		ctx, err := record.ChargeContext()
		if err != nil {
			return err
		}
		if ctx.SchemaVersion == 0 {
			return errors.New("legacy subscription charge requires reconciliation")
		}
		if ctx.Revision == math.MaxInt64 {
			return ErrSubscriptionChargeConflict
		}
		result = ctx
		if ctx.Revision == revision && ctx.AccountedQuota == target && ctx.Phase == phase {
			return nil
		}
		if ctx.Revision+1 != revision || ctx.Phase == "refunded" || phase == "reserved" && ctx.Phase != "reserved" || phase == "refunded" && target != 0 {
			return ErrSubscriptionChargeConflict
		}
		if ctx.PendingTarget != nil && (phase != "settled" || *ctx.PendingTarget != target) {
			return ErrSubscriptionChargeConflict
		}
		delta := target - ctx.AccountedQuota
		if ctx.ResetVersion == sub.QuotaResetVersion {
			if phase == "reserved" && (sub.Status != "active" || sub.EndTime <= GetDBTimestamp()) {
				return ErrNoActiveSubscription
			}
			if delta > 0 && (sub.AmountUsed > math.MaxInt64-delta || ctx.IsPremium && sub.PremiumAmountUsed > math.MaxInt64-delta) {
				return errors.New("subscription quota overflow")
			}
			if delta < 0 && (sub.AmountUsed < -delta || ctx.IsPremium && sub.PremiumAmountUsed < -delta) {
				return errors.New("subscription refund exceeds accounted quota")
			}
			if delta > 0 && sub.AmountTotal > 0 && sub.AmountUsed+delta > sub.AmountTotal {
				if phase != "settled" {
					return ErrSubscriptionQuota
				}
				ctx.PendingTarget = &target
				ctx.Phase = "settlement_pending"
				if err := record.setChargeContext(ctx); err != nil {
					return err
				}
				if err := tx.Model(&record).Updates(map[string]any{"billing_context": record.BillingContext, "status": record.Status}).Error; err != nil {
					return err
				}
				deferredError = ErrSubscriptionQuota
				result = ctx
				return nil
			}
			if phase == "reserved" && delta > 0 && ctx.IsPremium {
				if ctx.LimitEnabled && sub.PremiumAmountUsed+delta > subscriptionPremiumLimit(sub.AmountTotal, ctx.EffectivePercent) {
					return ErrSubscriptionPremiumQuota
				}
			}
			premium := sub.PremiumAmountUsed
			if ctx.IsPremium {
				premium += delta
				ctx.PremiumOverLimit = max(0, premium-subscriptionPremiumLimit(sub.AmountTotal, ctx.EffectivePercent))
			}
			res := tx.Model(&sub).Where("amount_used = ? AND premium_amount_used = ? AND quota_reset_version = ?", sub.AmountUsed, sub.PremiumAmountUsed, sub.QuotaResetVersion).
				Updates(map[string]any{"amount_used": sub.AmountUsed + delta, "premium_amount_used": premium})
			if res.Error != nil {
				return res.Error
			}
			if delta != 0 && res.RowsAffected != 1 {
				return ErrSubscriptionChargeConflict
			}
		} else if phase == "reserved" {
			return ErrSubscriptionChargeConflict
		}
		ctx.AccountedQuota, ctx.Revision, ctx.Phase, ctx.PendingTarget = target, revision, phase, nil
		if err := record.setChargeContext(ctx); err != nil {
			return err
		}
		if err := tx.Model(&record).Updates(map[string]any{"billing_context": record.BillingContext, "status": record.Status}).Error; err != nil {
			return err
		}
		result = ctx
		result.Applied = true
		return nil
	})
	if err != nil {
		return SubscriptionChargeContext{}, err
	}
	if deferredError != nil {
		common.SysError(fmt.Sprintf("subscription settlement pending: request=%s user=%d target=%d revision=%d: %v", requestID, userID, target, revision, deferredError))
	} else if result.Applied && result.PremiumOverLimit > 0 {
		common.SysLog(fmt.Sprintf("subscription premium limit exceeded by actual usage: request=%s user=%d over_limit=%d", requestID, userID, result.PremiumOverLimit))
	}
	return result, deferredError
}
