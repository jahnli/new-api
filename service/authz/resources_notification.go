package authz

const ResourceNotification = "notification"

var (
	NotificationView = Permission{Resource: ResourceNotification, Action: "view"}
	NotificationSend = Permission{Resource: ResourceNotification, Action: "send"}
)

func init() {
	RegisterResource(ResourceDefinition{
		Resource: ResourceNotification,
		LabelKey: "Notifications",
		Actions: []ActionDefinition{
			{Action: "view", LabelKey: "View notifications", DescriptionKey: "View notification records and templates within the account's scope.", DefaultRoles: []string{BuiltInRoleUser, BuiltInRoleAdmin}},
			{Action: "send", LabelKey: "Send notifications", DescriptionKey: "Send notifications and manage public notification templates.", DefaultRoles: []string{BuiltInRoleAdmin}},
		},
	})
}
