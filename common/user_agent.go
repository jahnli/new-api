package common

const maxStoredUserAgentRunes = 512

// TruncateUserAgent preserves the raw client value while bounding log and
// audit storage. Truncating by rune avoids producing invalid UTF-8.
func TruncateUserAgent(userAgent string) string {
	runes := []rune(userAgent)
	if len(runes) <= maxStoredUserAgentRunes {
		return userAgent
	}
	return string(runes[:maxStoredUserAgentRunes])
}
