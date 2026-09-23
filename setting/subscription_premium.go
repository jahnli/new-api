package setting

import "math"

// SubscriptionPremiumPolicyKey is managed through the subscription admin API.
const SubscriptionPremiumPolicyKey = "SubscriptionPremiumPolicy"

type SubscriptionPremiumPolicy struct {
	Enabled        bool     `json:"enabled"`
	DefaultPercent float64  `json:"default_percent"`
	ModelNames     []string `json:"model_names"`
	Version        int64    `json:"version"`
	FirstEnabledAt int64    `json:"first_enabled_at"`
}

func DefaultSubscriptionPremiumPolicy() SubscriptionPremiumPolicy {
	return SubscriptionPremiumPolicy{DefaultPercent: 100, ModelNames: []string{}, Version: 1}
}

// ValidSubscriptionPremiumPercent accepts percentages with at most two decimal places.
func ValidSubscriptionPremiumPercent(percent float64) bool {
	return !math.IsNaN(percent) && !math.IsInf(percent, 0) && percent >= 0 && percent <= 100 &&
		math.Abs(percent*100-math.Round(percent*100)) < 1e-8
}
