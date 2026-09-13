package setting

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
)

const ModelSquareConfigKey = "ModelSquareConfig"
const ModelSquareMaxBodyBytes = 256 * 1024

const (
	modelSquareMaxScenarios      = 10
	modelSquareMaxScenarioLength = 40
)

// legacyModelSquareScenarios maps the retired fixed scenario enum onto the
// preset labels that replaced it. Values outside the map are kept verbatim.
var legacyModelSquareScenarios = map[string]string{
	"general": "General recommendations",
	"coding":  "Coding",
	"chat":    "Daily chat",
	"writing": "Writing",
	"image":   "Image generation",
}

// migrateLegacyScenario replaces a retired enum value with its preset label.
// Matching ignores surrounding space and casing, so retired values that ended
// up stored as free text are migrated too instead of surfacing as a lowercase
// token in the UI.
func migrateLegacyScenario(value string) string {
	if mapped, ok := legacyModelSquareScenarios[strings.ToLower(strings.TrimSpace(value))]; ok {
		return mapped
	}
	return value
}

type ModelSquareRecommendation struct {
	ModelName string   `json:"model_name"`
	Scenarios []string `json:"scenarios"`
	Reason    string   `json:"reason"`
	Enabled   bool     `json:"enabled"`
}

type ModelSquareConfig struct {
	Enabled         bool                        `json:"enabled"`
	Recommendations []ModelSquareRecommendation `json:"recommendations"`
}

func ParseModelSquareConfig(raw string) (ModelSquareConfig, error) {
	var wire *struct {
		Enabled         *bool `json:"enabled"`
		Recommendations *[]struct {
			ModelName *string    `json:"model_name"`
			Scenario  *string    `json:"scenario"`
			Scenarios *[]*string `json:"scenarios"`
			Reason    string     `json:"reason"`
			Enabled   *bool      `json:"enabled"`
		} `json:"recommendations"`
	}
	config := ModelSquareConfig{Recommendations: []ModelSquareRecommendation{}}
	if len(raw) > ModelSquareMaxBodyBytes {
		return config, fmt.Errorf("model square config exceeds 256 KiB")
	}
	if err := common.UnmarshalJsonStr(raw, &wire); err != nil {
		return config, fmt.Errorf("invalid model square config: %w", err)
	}
	if wire == nil || wire.Enabled == nil || wire.Recommendations == nil {
		return config, fmt.Errorf("enabled and recommendations are required and cannot be null")
	}
	config.Enabled = *wire.Enabled
	for i, item := range *wire.Recommendations {
		if item.ModelName == nil || item.Enabled == nil {
			return config, fmt.Errorf("recommendation %d: model_name and enabled are required and cannot be null", i+1)
		}
		scenarios, err := parseModelSquareScenarios(item.Scenarios, item.Scenario)
		if err != nil {
			return config, fmt.Errorf("recommendation %d: %w", i+1, err)
		}
		config.Recommendations = append(config.Recommendations, ModelSquareRecommendation{
			ModelName: *item.ModelName, Scenarios: scenarios, Reason: item.Reason,
			Enabled: *item.Enabled,
		})
	}
	return NormalizeModelSquareConfig(config)
}

// parseModelSquareScenarios reads the ordered scenario list and accepts the
// legacy single-value "scenario" field, so configs saved before the list
// migration keep loading instead of breaking the pricing response. Retired
// enum values are migrated in both shapes.
func parseModelSquareScenarios(scenarios *[]*string, legacy *string) ([]string, error) {
	if scenarios == nil {
		if legacy == nil {
			return nil, fmt.Errorf("scenarios is required and cannot be null")
		}
		return []string{migrateLegacyScenario(*legacy)}, nil
	}
	values := make([]string, 0, len(*scenarios))
	for _, value := range *scenarios {
		if value == nil {
			return nil, fmt.Errorf("scenarios must not contain null")
		}
		values = append(values, migrateLegacyScenario(*value))
	}
	return values, nil
}

func NormalizeModelSquareConfig(config ModelSquareConfig) (ModelSquareConfig, error) {
	if len(config.Recommendations) > 100 {
		return config, fmt.Errorf("at most 100 recommendations are allowed")
	}
	items := make([]ModelSquareRecommendation, 0, len(config.Recommendations))
	seen := make(map[string]bool, len(config.Recommendations))
	for i, item := range config.Recommendations {
		item.ModelName = strings.TrimSpace(item.ModelName)
		item.Reason = strings.TrimSpace(item.Reason)
		if item.ModelName == "" || utf8.RuneCountInString(item.ModelName) > 128 {
			return config, fmt.Errorf("recommendation %d: model name must contain 1 to 128 characters", i+1)
		}
		if utf8.RuneCountInString(item.Reason) > 300 {
			return config, fmt.Errorf("recommendation %d: reason must not exceed 300 characters", i+1)
		}
		if seen[item.ModelName] {
			return config, fmt.Errorf("recommendation %d: duplicate model", i+1)
		}
		seen[item.ModelName] = true
		scenarios, err := normalizeModelSquareScenarios(item.Scenarios, i+1)
		if err != nil {
			return config, err
		}
		item.Scenarios = scenarios
		items = append(items, item)
	}
	config.Recommendations = items
	return config, nil
}

// Scenarios are free text, so only emptiness, length and exact duplicates are
// rejected. Casing is preserved because preset values are i18n keys.
func normalizeModelSquareScenarios(values []string, index int) ([]string, error) {
	if len(values) > modelSquareMaxScenarios {
		return nil, fmt.Errorf("recommendation %d: at most %d scenarios are allowed", index, modelSquareMaxScenarios)
	}
	scenarios := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || utf8.RuneCountInString(value) > modelSquareMaxScenarioLength {
			return nil, fmt.Errorf("recommendation %d: scenario must contain 1 to %d characters", index, modelSquareMaxScenarioLength)
		}
		if seen[value] {
			return nil, fmt.Errorf("recommendation %d: duplicate scenario", index)
		}
		seen[value] = true
		scenarios = append(scenarios, value)
	}
	return scenarios, nil
}

// GetModelSquareConfig reads a snapshot refreshed by the existing option sync.
// A corrupt saved value is an error, never a replacement with empty settings.
func GetModelSquareConfig() (ModelSquareConfig, error) {
	common.OptionMapRWMutex.RLock()
	raw, exists := common.OptionMap[ModelSquareConfigKey]
	common.OptionMapRWMutex.RUnlock()
	if !exists {
		return ModelSquareConfig{Recommendations: []ModelSquareRecommendation{}}, nil
	}
	return ParseModelSquareConfig(raw)
}

func (config ModelSquareConfig) VisibleRecommendations(modelNames map[string]bool) []ModelSquareRecommendation {
	items := make([]ModelSquareRecommendation, 0)
	if !config.Enabled {
		return items
	}
	for _, item := range config.Recommendations {
		if item.Enabled && modelNames[item.ModelName] {
			items = append(items, item)
		}
	}
	return items
}
