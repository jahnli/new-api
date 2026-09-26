package model

import "database/sql"

// ListNotificationPlatformIDs includes every non-deleted user, irrespective of
// company or account status. The selected company supplies the sending app only.
// Read only the recipient column; credentials and personal data are unnecessary.
func ListNotificationPlatformIDs() ([]string, error) {
	var values []sql.NullString
	if err := DB.Model(&User{}).Order("id asc").Pluck("open_id", &values).Error; err != nil {
		return nil, err
	}
	identifiers := make([]string, len(values))
	for i := range values {
		identifiers[i] = values[i].String
	}
	return identifiers, nil
}
