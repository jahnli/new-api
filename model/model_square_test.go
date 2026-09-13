package model

import (
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestModelSquareAssociationsPreserveUnavailableAndRejectUnknown(t *testing.T) {
	previous := setting.ModelSquareConfig{Recommendations: []setting.ModelSquareRecommendation{{ModelName: "retired", Scenarios: []string{"Coding"}}}}
	config := setting.ModelSquareConfig{Recommendations: []setting.ModelSquareRecommendation{{ModelName: "retired", Scenarios: []string{"Coding"}, Reason: "edited"}, {ModelName: "live", Scenarios: []string{"Daily chat"}}}}
	pricing := []Pricing{{ModelName: "live"}}
	require.NoError(t, ValidateModelSquareAssociations(config, previous, pricing))
	require.NoError(t, ValidateModelSquareAssociations(setting.ModelSquareConfig{}, previous, pricing))
	config.Recommendations[0].ModelName = "unknown"
	require.ErrorContains(t, ValidateModelSquareAssociations(config, previous, pricing), "unknown")
}

func TestModelSquareOptionValidationProtectsGenericWriters(t *testing.T) {
	require.Error(t, validateOptionValue(setting.ModelSquareConfigKey, `null`))
	require.Error(t, UpdateOptionsBulk(map[string]string{setting.ModelSquareConfigKey: `null`}))
	require.Error(t, UpdateOption(setting.ModelSquareConfigKey, `null`))
	require.NoError(t, validateOptionValue(setting.ModelSquareConfigKey, `{"enabled":false,"recommendations":[]}`))
}

func TestModelSquareOptionPersistence(t *testing.T) {
	for _, test := range []struct {
		name, env, version string
		open               func(string) gorm.Dialector
	}{
		{"sqlite", "", "select sqlite_version()", func(string) gorm.Dialector { return sqlite.Open(":memory:") }},
		{"mysql", "TEST_MYSQL_DSN", "select version()", func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{"postgres", "TEST_POSTGRES_DSN", "select version()", func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := strings.TrimSpace(os.Getenv(test.env))
			if test.env != "" && dsn == "" {
				t.Skip(test.env + " is not configured")
			}
			db, err := gorm.Open(test.open(dsn), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "test_model_square_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			var version string
			require.NoError(t, db.Raw(test.version).Scan(&version).Error)
			t.Logf("database version: %s", version)
			require.NoError(t, db.AutoMigrate(&Option{}))
			t.Cleanup(func() { assert.NoError(t, db.Migrator().DropTable(&Option{})) })
			require.NoError(t, db.AutoMigrate(&Option{}))
			previousDB, previousPricing, previousTime := DB, pricingMap, lastGetPricingTime
			common.OptionMapRWMutex.Lock()
			previousOptions := common.OptionMap
			common.OptionMap = map[string]string{}
			common.OptionMapRWMutex.Unlock()
			DB, pricingMap, lastGetPricingTime = db, []Pricing{{ModelName: "live"}}, time.Now()
			t.Cleanup(func() {
				DB, pricingMap, lastGetPricingTime = previousDB, previousPricing, previousTime
				common.OptionMapRWMutex.Lock()
				common.OptionMap = previousOptions
				common.OptionMapRWMutex.Unlock()
			})
			config := setting.ModelSquareConfig{Enabled: true, Recommendations: []setting.ModelSquareRecommendation{
				{ModelName: " live ", Scenarios: []string{" Coding ", "自定义"}, Reason: " 编程推荐 ", Enabled: true},
			}}
			saved, err := SaveModelSquareConfig(config)
			require.NoError(t, err)
			assert.Equal(t, "live", saved.Recommendations[0].ModelName)
			assert.Equal(t, []string{"Coding", "自定义"}, saved.Recommendations[0].Scenarios)
			var option Option
			require.NoError(t, db.First(&option, Option{Key: setting.ModelSquareConfigKey}).Error)
			persisted, err := setting.ParseModelSquareConfig(option.Value)
			require.NoError(t, err)
			assert.Equal(t, saved, persisted)
			common.OptionMapRWMutex.Lock()
			delete(common.OptionMap, setting.ModelSquareConfigKey)
			common.OptionMapRWMutex.Unlock()
			loadOptionsFromDatabase()
			snapshot, err := setting.GetModelSquareConfig()
			require.NoError(t, err)
			assert.Equal(t, saved, snapshot)
			assert.Len(t, GetModelSquareRecommendations([]Pricing{{ModelName: "live"}}), 1)
			assert.Empty(t, GetModelSquareRecommendations(nil))

			// A real transactional write failure must preserve both DB and memory.
			require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:model_square_failure", func(tx *gorm.DB) {
				tx.AddError(errors.New("injected option write failure"))
			}))
			config.Enabled = false
			_, err = SaveModelSquareConfig(config)
			require.ErrorContains(t, err, "injected option write failure")
			require.ErrorIs(t, err, ErrModelSquareConfigStorage)
			require.NoError(t, db.Callback().Update().Remove("test:model_square_failure"))
			var unchanged Option
			require.NoError(t, db.First(&unchanged, Option{Key: setting.ModelSquareConfigKey}).Error)
			assert.Equal(t, option.Value, unchanged.Value)
			snapshot, err = setting.GetModelSquareConfig()
			require.NoError(t, err)
			assert.Equal(t, saved, snapshot)

			_, err = SaveModelSquareConfig(config)
			require.NoError(t, err)
			assert.Empty(t, GetModelSquareRecommendations([]Pricing{{ModelName: "live"}}))

			// Keep the feature enabled so an empty public result proves deletion,
			// rather than merely the disabled switch hiding old recommendations.
			cleared, err := SaveModelSquareConfig(setting.ModelSquareConfig{Enabled: true, Recommendations: []setting.ModelSquareRecommendation{}})
			require.NoError(t, err)
			var clearedOption Option
			require.NoError(t, db.First(&clearedOption, Option{Key: setting.ModelSquareConfigKey}).Error)
			assert.JSONEq(t, `{"enabled":true,"recommendations":[]}`, clearedOption.Value)
			common.OptionMapRWMutex.Lock()
			common.OptionMap[setting.ModelSquareConfigKey] = option.Value
			common.OptionMapRWMutex.Unlock()
			loadOptionsFromDatabase()
			snapshot, err = setting.GetModelSquareConfig()
			require.NoError(t, err)
			assert.Equal(t, cleared, snapshot)
			assert.True(t, snapshot.Enabled)
			assert.Empty(t, snapshot.Recommendations)
			assert.NotNil(t, snapshot.Recommendations)
			assert.Empty(t, GetModelSquareRecommendations([]Pricing{{ModelName: "live"}}))

			common.OptionMapRWMutex.Lock()
			common.OptionMap[setting.ModelSquareConfigKey] = "broken"
			common.OptionMapRWMutex.Unlock()
			assert.Empty(t, GetModelSquareRecommendations([]Pricing{{ModelName: "live"}}))
			_, err = SaveModelSquareConfig(config)
			require.ErrorContains(t, err, "invalid saved")
			require.ErrorIs(t, err, ErrModelSquareConfigStorage)
		})
	}
}
