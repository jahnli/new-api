package setting

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelSquareConfigValidation(t *testing.T) {
	valid := ModelSquareRecommendation{ModelName: " 模型 ", Scenarios: []string{" Coding ", "自定义"}, Reason: " 推荐 ", Enabled: true}
	for _, test := range []struct {
		name string
		edit func(*ModelSquareRecommendation)
	}{
		{"empty model", func(r *ModelSquareRecommendation) { r.ModelName = " " }},
		{"long model", func(r *ModelSquareRecommendation) { r.ModelName = strings.Repeat("型", 129) }},
		{"long reason", func(r *ModelSquareRecommendation) { r.Reason = strings.Repeat("荐", 301) }},
		{"blank scenario", func(r *ModelSquareRecommendation) { r.Scenarios = []string{"  "} }},
		{"long scenario", func(r *ModelSquareRecommendation) { r.Scenarios = []string{strings.Repeat("景", 41)} }},
		{"too many scenarios", func(r *ModelSquareRecommendation) {
			r.Scenarios = make([]string, 11)
			for i := range r.Scenarios {
				r.Scenarios[i] = "场景"
			}
		}},
		{"duplicate scenario", func(r *ModelSquareRecommendation) { r.Scenarios = []string{"Coding", "Coding"} }},
	} {
		t.Run(test.name, func(t *testing.T) {
			item := valid
			test.edit(&item)
			_, err := NormalizeModelSquareConfig(ModelSquareConfig{Recommendations: []ModelSquareRecommendation{item}})
			require.Error(t, err)
		})
	}
	config, err := NormalizeModelSquareConfig(ModelSquareConfig{Recommendations: []ModelSquareRecommendation{valid}})
	require.NoError(t, err)
	assert.Equal(t, "模型", config.Recommendations[0].ModelName)
	assert.Equal(t, "推荐", config.Recommendations[0].Reason)
	assert.Equal(t, []string{"Coding", "自定义"}, config.Recommendations[0].Scenarios)
	_, err = NormalizeModelSquareConfig(ModelSquareConfig{Recommendations: []ModelSquareRecommendation{valid, config.Recommendations[0]}})
	require.ErrorContains(t, err, "duplicate")
	_, err = NormalizeModelSquareConfig(ModelSquareConfig{Recommendations: make([]ModelSquareRecommendation, 101)})
	require.ErrorContains(t, err, "100")
	valid.ModelName, valid.Reason = strings.Repeat("型", 128), strings.Repeat("荐", 300)
	_, err = NormalizeModelSquareConfig(ModelSquareConfig{Recommendations: []ModelSquareRecommendation{valid}})
	require.NoError(t, err)
	valid.Scenarios = nil
	empty, err := NormalizeModelSquareConfig(ModelSquareConfig{Recommendations: []ModelSquareRecommendation{valid}})
	require.NoError(t, err)
	assert.NotNil(t, empty.Recommendations[0].Scenarios)
	assert.Empty(t, empty.Recommendations[0].Scenarios)
}

func TestModelSquareConfigMigratesLegacyScenarioField(t *testing.T) {
	for legacy, expected := range map[string][]string{
		"general": {"General recommendations"},
		"coding":  {"Coding"},
		"chat":    {"Daily chat"},
		"writing": {"Writing"},
		"image":   {"Image generation"},
		"unknown": {"unknown"},
	} {
		t.Run(legacy, func(t *testing.T) {
			config, err := ParseModelSquareConfig(`{"enabled":true,"recommendations":[{"model_name":"m","scenario":"` + legacy + `","enabled":true}]}`)
			require.NoError(t, err)
			assert.Equal(t, expected, config.Recommendations[0].Scenarios)
		})
	}
	config, err := ParseModelSquareConfig(`{"enabled":true,"recommendations":[{"model_name":"m","scenarios":["Coding"],"scenario":"chat","enabled":true}]}`)
	require.NoError(t, err)
	assert.Equal(t, []string{"Coding"}, config.Recommendations[0].Scenarios)
	_, err = ParseModelSquareConfig(`{"enabled":true,"recommendations":[{"model_name":"m","enabled":true}]}`)
	require.ErrorContains(t, err, "scenarios is required")
	_, err = ParseModelSquareConfig(`{"enabled":true,"recommendations":[{"model_name":"m","scenarios":null,"enabled":true}]}`)
	require.ErrorContains(t, err, "scenarios is required")
	_, err = ParseModelSquareConfig(`{"enabled":true,"recommendations":[{"model_name":"m","scenarios":[null],"enabled":true}]}`)
	require.ErrorContains(t, err, "scenarios must not contain null")
}

func TestModelSquareConfigSerializesScenarios(t *testing.T) {
	config, err := NormalizeModelSquareConfig(ModelSquareConfig{Enabled: true, Recommendations: []ModelSquareRecommendation{
		{ModelName: "m", Scenarios: []string{"Coding"}, Enabled: true},
	}})
	require.NoError(t, err)
	encoded, err := common.Marshal(config)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"scenarios":["Coding"]`)
	assert.NotContains(t, string(encoded), `"scenario"`)
	roundTripped, err := ParseModelSquareConfig(string(encoded))
	require.NoError(t, err)
	assert.Equal(t, config, roundTripped)
}

func TestModelSquareConfigRejectsNullAndInvalidJSONTypes(t *testing.T) {
	for _, raw := range []string{
		`null`, `{}`, `{"enabled":true,"recommendations":null}`,
		`{"enabled":null,"recommendations":[]}`, `{"enabled":false,"recommendations":[]} {}`,
		`{"enabled":true,"recommendations":[null]}`,
	} {
		t.Run(raw, func(t *testing.T) {
			_, err := ParseModelSquareConfig(raw)
			require.Error(t, err)
		})
	}
	config, err := ParseModelSquareConfig(`{"enabled":false,"recommendations":[]}`)
	require.NoError(t, err)
	assert.NotNil(t, config.Recommendations)
}

func TestModelSquareConfigOptionalReason(t *testing.T) {
	for _, field := range []string{``, `,"reason":""`, `,"reason":"  \t "`, `,"reason":null`} {
		t.Run(field, func(t *testing.T) {
			config, err := ParseModelSquareConfig(`{"enabled":true,"recommendations":[{"model_name":"m","scenarios":["Coding"],"enabled":true` + field + `}]}`)
			require.NoError(t, err)
			require.Len(t, config.Recommendations, 1)
			assert.Empty(t, config.Recommendations[0].Reason)
		})
	}
}

func TestModelSquareConfigDefaultAndInvalidSnapshot(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
	config, err := GetModelSquareConfig()
	require.NoError(t, err)
	assert.False(t, config.Enabled)
	assert.NotNil(t, config.Recommendations)
	common.OptionMapRWMutex.Lock()
	common.OptionMap[ModelSquareConfigKey] = "broken"
	common.OptionMapRWMutex.Unlock()
	_, err = GetModelSquareConfig()
	require.Error(t, err)
}

func TestModelSquareRecommendationsFilterInConfiguredOrder(t *testing.T) {
	config := ModelSquareConfig{Enabled: true, Recommendations: []ModelSquareRecommendation{
		{ModelName: "b", Scenarios: []string{"Daily chat"}, Enabled: true},
		{ModelName: "a", Scenarios: []string{"Writing", "Coding"}, Enabled: true},
		{ModelName: "c", Scenarios: []string{"Coding"}, Enabled: true},
		{ModelName: "first", Scenarios: []string{"General recommendations"}, Enabled: true},
		{ModelName: "hidden", Scenarios: []string{"General recommendations"}, Enabled: true},
		{ModelName: "disabled", Scenarios: []string{"General recommendations"}, Enabled: false},
	}}
	visible := map[string]bool{"a": true, "b": true, "c": true, "first": true, "disabled": true}
	assert.Equal(t, []ModelSquareRecommendation{config.Recommendations[0], config.Recommendations[1], config.Recommendations[2], config.Recommendations[3]}, config.VisibleRecommendations(visible))
	config.Enabled = false
	assert.Empty(t, config.VisibleRecommendations(visible))
	assert.NotNil(t, config.VisibleRecommendations(visible))
}
