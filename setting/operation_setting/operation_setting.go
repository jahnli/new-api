package operation_setting

import (
	"errors"
	"os"
	"strings"
)

var DemoSiteEnabled = false
var SelfUseModeEnabled = false
var ExternalModeEnabled = false

func InitExternalMode() error {
	externalMode := strings.TrimSpace(os.Getenv("EXTERNAL_MODE"))
	if externalMode != "" && externalMode != "true" && externalMode != "false" {
		return errors.New("EXTERNAL_MODE must be true, false, or empty")
	}
	ExternalModeEnabled = externalMode == "true"
	return nil
}

var AutomaticDisableKeywords = []string{
	"Your credit balance is too low",
	"This organization has been disabled.",
	"You exceeded your current quota",
	"Permission denied",
	"The security token included in the request is invalid",
	"Operation not allowed",
	"Your account is not authorized",
}

func AutomaticDisableKeywordsToString() string {
	return strings.Join(AutomaticDisableKeywords, "\n")
}

func AutomaticDisableKeywordsFromString(s string) {
	AutomaticDisableKeywords = []string{}
	ak := strings.SplitSeq(s, "\n")
	for k := range ak {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			AutomaticDisableKeywords = append(AutomaticDisableKeywords, k)
		}
	}
}
