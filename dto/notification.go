package dto

type NotificationImage struct {
	ID          string `json:"id,omitempty"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Data        string `json:"data"`
	URL         string `json:"url,omitempty"`
}

// NotificationMessage captures the content and resolved audience of a send.
type NotificationMessage struct {
	Channel       string              `json:"channel"`
	CompanyID     int                 `json:"company_id"`
	RecipientType string              `json:"recipient_type,omitempty"`
	Recipients    []string            `json:"recipients"`
	Title         string              `json:"title"`
	TitleIcon     string              `json:"title_icon,omitempty"`
	TitleTheme    string              `json:"title_theme,omitempty"`
	Content       string              `json:"content"`
	Images        []NotificationImage `json:"images"`
}
