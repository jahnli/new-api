package setting

// SubscriptionPremiumPolicyKey is managed through the subscription admin API.
const SubscriptionPremiumPolicyKey = "SubscriptionPremiumPolicy"

type SubscriptionPremiumPolicy struct {
	Enabled        bool     `json:"enabled"`
	DefaultPercent int      `json:"default_percent"`
	ModelNames     []string `json:"model_names"`
	Version        int64    `json:"version"`
	FirstEnabledAt int64    `json:"first_enabled_at"`
}

func DefaultSubscriptionPremiumPolicy() SubscriptionPremiumPolicy {
	return SubscriptionPremiumPolicy{DefaultPercent: 100, ModelNames: []string{}, Version: 1}
}
