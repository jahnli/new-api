package model

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// OIDCSessionBinding carries verified identity digests through MFA. LogoutHint
// is encrypted and stored separately in auth_flows, never in the session cache.
type OIDCSessionBinding struct {
	LogoutHint string `json:"logout_hint,omitempty" gorm:"-"`
	SubjectKey string `json:"subject_key,omitempty" gorm:"type:char(64);index:idx_user_sessions_oidc_subject"`
	SessionKey string `json:"session_key,omitempty" gorm:"type:char(64);index:idx_user_sessions_oidc_session"`
	IssuedAt   int64  `json:"issued_at,omitempty" gorm:"type:bigint"`
}

const AuthFlowPurposeOIDCLogoutHint = "oidc_logout_hint"

// GetOIDCLogoutHint must only be called after authenticating the local session.
func GetOIDCLogoutHint(userID int, sid string) (string, error) {
	var flows []AuthFlow
	err := DB.Where("purpose = ? AND user_id = ? AND session_id = ? AND expires_at > ?",
		AuthFlowPurposeOIDCLogoutHint, userID, sid, time.Now()).Limit(1).Find(&flows).Error
	if err != nil || len(flows) == 0 {
		return "", err
	}
	return flows[0].Payload, nil
}

// OIDCLogout is both a durable replay receipt and a revocation fence. Keeping
// the fence for the maximum local session lifetime closes races with callbacks,
// MFA completion and session refresh, including on other gateway instances.
type OIDCLogout struct {
	AssertionKey string `gorm:"type:char(64);primaryKey"`
	SubjectKey   string `gorm:"type:char(64);index:idx_oidc_logouts_subject"`
	SessionKey   string `gorm:"type:char(64);index:idx_oidc_logouts_session"`
	IssuedAt     int64  `gorm:"type:bigint;not null"`
	ExpiresAt    int64  `gorm:"type:bigint;not null;index"`
}

func (OIDCLogout) TableName() string { return "oidc_logouts" }

func (receipt *OIDCLogout) AfterFind(_ *gorm.DB) error {
	// PostgreSQL returns empty CHAR(64) identifiers padded with spaces.
	receipt.SubjectKey = strings.TrimSpace(receipt.SubjectKey)
	receipt.SessionKey = strings.TrimSpace(receipt.SessionKey)
	return nil
}

func OIDCIdentityKey(issuer, clientID, kind, value string) string {
	if value == "" {
		return ""
	}
	// JSON framing prevents ambiguous concatenations of provider-controlled IDs.
	data, _ := common.Marshal([]string{issuer, clientID, kind, value})
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}

func CheckOIDCSessionActive(tx *gorm.DB, binding OIDCSessionBinding) error {
	// Normalize cached snapshots too: entries written before this fix may
	// still contain PostgreSQL CHAR padding and do not pass through AfterFind.
	binding.SubjectKey = strings.TrimSpace(binding.SubjectKey)
	binding.SessionKey = strings.TrimSpace(binding.SessionKey)
	if binding == (OIDCSessionBinding{}) {
		return nil // Non-OIDC sessions and sessions created before this feature.
	}
	if binding.SubjectKey == "" || binding.IssuedAt <= 0 {
		return ErrUserSessionInvalid
	}
	query := tx.Model(&OIDCLogout{}).Where("expires_at > ? AND issued_at >= ?", time.Now().Unix(), binding.IssuedAt)
	if binding.SessionKey == "" {
		query = query.Where("subject_key = ? AND session_key = ?", binding.SubjectKey, "")
	} else {
		query = query.Where("((subject_key = ? AND session_key = ?) OR (session_key = ? AND (subject_key = ? OR subject_key = ?)))",
			binding.SubjectKey, "", binding.SessionKey, "", binding.SubjectKey)
	}
	var receipts []OIDCLogout
	if err := query.Limit(1).Find(&receipts).Error; err != nil {
		return err // Storage failures must not reopen a revoked session.
	}
	if len(receipts) == 0 {
		return nil
	}
	return ErrUserSessionInactive
}

func ApplyOIDCLogout(receipt OIDCLogout) (int64, error) {
	if receipt.AssertionKey == "" || (receipt.SubjectKey == "" && receipt.SessionKey == "") || receipt.IssuedAt <= 0 || receipt.ExpiresAt <= time.Now().Unix() {
		return 0, ErrAuthFlowInvalid
	}
	result := DB.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "assertion_key"}}, DoNothing: true}).Create(&receipt)
	if result.Error != nil {
		return 0, result.Error
	}
	// Do not infer insertion from RowsAffected: MySQL's clientFoundRows option
	// changes the count for no-op upserts. Always verify the persisted receipt.
	var previous OIDCLogout
	if err := DB.Where("assertion_key = ?", receipt.AssertionKey).Take(&previous).Error; err != nil {
		return 0, err
	}
	if previous.SubjectKey != receipt.SubjectKey || previous.SessionKey != receipt.SessionKey || previous.IssuedAt != receipt.IssuedAt {
		return 0, ErrAuthFlowConsumed
	}
	var count int64
	for {
		query := DB.Where("login_method = ? AND status = ? AND expires_at > ? AND oidc_issued_at <= ?",
			"oauth:oidc", UserSessionStatusActive, time.Now().Unix(), receipt.IssuedAt)
		if receipt.SubjectKey != "" {
			query = query.Where("oidc_subject_key = ?", receipt.SubjectKey)
		}
		if receipt.SessionKey != "" {
			query = query.Where("oidc_session_key = ?", receipt.SessionKey)
		}
		var sessions []UserSession
		if err := query.Order("sid").Limit(userSessionRevokeBatchSize).Find(&sessions).Error; err != nil {
			return count, err
		}
		if len(sessions) == 0 {
			return count, nil
		}
		for i := range sessions {
			revoked, err := RevokeUserSession(sessions[i].UserID, sessions[i].SID, "oidc_backchannel_logout")
			if err != nil {
				return count, err
			}
			if revoked {
				count++
			}
		}
	}
}

func DeleteExpiredOIDCLogouts(now int64) error {
	return DB.Where("expires_at < ?", now).Delete(&OIDCLogout{}).Error
}
