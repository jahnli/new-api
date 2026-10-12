package model

import "database/sql"

// ListNotificationPlatformIDs includes non-deleted members of the selected company.
// Read only the recipient column; credentials and personal data are unnecessary.
func ListNotificationPlatformIDs(company string) ([]string, error) {
	var values []sql.NullString
	if err := DB.Model(&User{}).Where("company = ?", company).Order("id asc").Pluck("open_id", &values).Error; err != nil {
		return nil, err
	}
	identifiers := make([]string, len(values))
	for i := range values {
		identifiers[i] = values[i].String
	}
	return identifiers, nil
}
