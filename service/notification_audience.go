package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/model"
)

type NotificationAudience struct {
	TotalUsers     int      `json:"total_users"`
	RecipientCount int      `json:"recipient_count"`
	MissingIDs     int      `json:"missing_ids"`
	InvalidIDs     int      `json:"invalid_ids"`
	DuplicateIDs   int      `json:"duplicate_ids"`
	Recipients     []string `json:"-"`
}

// ResolveNotificationAudience is used both for the confirmation count and for
// the immutable send snapshot. The company selects credentials, not membership.
func ResolveNotificationAudience(channel string, companyID int) (*NotificationAudience, error) {
	if channel != "feishu" && channel != "dingtalk" {
		return nil, &NotificationValidationError{Err: errors.New("only platform notifications use the user-table audience")}
	}
	company, err := model.GetEnabledCompanyByID(companyID)
	if err != nil || company.Platform != channel {
		return nil, &NotificationValidationError{Err: errors.New("an enabled company matching the channel is required")}
	}
	identifiers, err := model.ListNotificationPlatformIDs()
	if err != nil {
		return nil, err
	}
	audience := &NotificationAudience{TotalUsers: len(identifiers), Recipients: make([]string, 0, len(identifiers))}
	seen := make(map[string]bool, len(identifiers))
	for _, identifier := range identifiers {
		identifier = strings.TrimSpace(identifier)
		if identifier == "" {
			audience.MissingIDs++
			continue
		}
		if !notificationPlatformIDPattern.MatchString(identifier) || strings.EqualFold(strings.TrimPrefix(identifier, "@"), "all") || identifier == "0" {
			audience.InvalidIDs++
			continue
		}
		if seen[identifier] {
			audience.DuplicateIDs++
			continue
		}
		seen[identifier] = true
		audience.Recipients = append(audience.Recipients, identifier)
	}
	audience.RecipientCount = len(audience.Recipients)
	return audience, nil
}
