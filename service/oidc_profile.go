package service

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// ApplyOIDCRegistrationProfile prepares an unsaved user from verified Casdoor
// ID-token attributes and returns the shared company rule's subscription plan.
// It must only be called for first registration, never login or account linking.
// The property names match sync_all_to_casdoor.py's directory sync stages.
func ApplyOIDCRegistrationProfile(user *model.User, claims map[string]any) (int, error) {
	var profile struct {
		Affiliation string `json:"affiliation"`
		Avatar      string `json:"avatar"`
		Phone       string `json:"phone"`
		Gender      string `json:"gender"`
		Birthday    string `json:"birthday"`
		Bio         string `json:"bio"`
		Properties  struct {
			Department      string `json:"department"`
			DepartmentValue string `json:"department_value"`
			JobNumber       string `json:"job_number"`
			JobType         string `json:"job_type"`
			JobLevel        string `json:"job_level"`
			JobDate         string `json:"job_date"`
			OpenID          string `json:"open_id"`
			JobDescription  string `json:"job_description"`
			Ethnicity       string `json:"ethnicity"`
		} `json:"properties"`
	}
	data, err := common.Marshal(claims)
	if err != nil || common.Unmarshal(data, &profile) != nil {
		return 0, errors.New("invalid OIDC employee profile")
	}

	company, config, hasConfig := system_setting.ResolveLDAPCompany(profile.Affiliation)
	avatar := strings.TrimSpace(user.AvatarUrl)
	if avatar == "" {
		avatar = strings.TrimSpace(profile.Avatar)
	}
	// Reject values that cannot be stored consistently by the supported DBs;
	// never truncate a company or platform identifier into a different identity.
	for _, field := range []struct {
		value string
		limit int
	}{
		{strings.TrimSpace(profile.Affiliation), 128}, {company, 128},
		{avatar, 512}, {profile.Phone, 32},
		{profile.Properties.Department, 256}, {profile.Properties.JobNumber, 64},
		{profile.Properties.JobType, 128}, {profile.Properties.OpenID, 64},
		{profile.Birthday, 16}, {profile.Properties.JobDate, 16},
		{profile.Bio, 32768}, {profile.Properties.JobLevel, 32768},
		{profile.Properties.JobDescription, 32768}, {profile.Properties.Ethnicity, 32768},
	} {
		if !utf8.ValidString(field.value) || strings.ContainsRune(field.value, '\x00') || utf8.RuneCountInString(field.value) > field.limit {
			return 0, errors.New("invalid OIDC employee profile field")
		}
	}
	for _, value := range []string{profile.Birthday, profile.Properties.JobDate} {
		if value != "" {
			if _, err := time.Parse(time.DateOnly, value); err != nil {
				return 0, errors.New("invalid OIDC employee profile date")
			}
		}
	}

	departments := []deptSimplified{}
	if value := strings.TrimSpace(profile.Properties.DepartmentValue); value != "" {
		if common.UnmarshalJsonStr(value, &departments) != nil || departments == nil {
			return 0, errors.New("invalid OIDC employee departments")
		}
	}
	for i := range departments {
		// Preserve the same array shape as the existing directory synchronizers.
		if departments[i].DepartmentPathInfos == nil {
			departments[i].DepartmentPathInfos = []deptPathSimple{}
		}
		if departments[i].Leaders == nil {
			departments[i].Leaders = []deptLeaderSimple{}
		}
	}
	departmentJSON, err := common.Marshal(departments)
	if err != nil {
		return 0, errors.New("invalid OIDC employee departments")
	}

	user.Company = model.NormalizeCompany(company)
	user.AvatarUrl = avatar
	user.Mobile = profile.Phone
	user.Description = profile.Bio
	user.Birthday = profile.Birthday
	switch strings.ToLower(profile.Gender) {
	case "male":
		user.Gender = 1
	case "female":
		user.Gender = 2
	default:
		user.Gender = 0
	}
	user.DepartmentName = profile.Properties.Department
	user.Departments = string(departmentJSON)
	user.JobNumber = profile.Properties.JobNumber
	user.JobTitle = profile.Properties.JobType
	user.JobLevel = profile.Properties.JobLevel
	user.JoinDate = profile.Properties.JobDate
	user.JobDescription = profile.Properties.JobDescription
	user.Ethnicity = profile.Properties.Ethnicity
	if !hasConfig {
		return 0, nil
	}
	// The script stores both platforms' IDs under properties.open_id. Keep
	// their namespaces separate using the administrator's shared company rule.
	switch config.SyncPlatform {
	case system_setting.LDAPSyncPlatformFeishu:
		user.OpenId = profile.Properties.OpenID
	case system_setting.LDAPSyncPlatformDingTalk:
		user.DingdingId = profile.Properties.OpenID
	}
	return config.AutoSubscribePlanId, nil
}
