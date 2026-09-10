package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func preserveCompanyNotificationDependencies(t *testing.T) {
	t.Helper()
	originalListUsers := listCompanyNotificationUsers
	originalSendEmail := sendCompanyNotificationEmail
	originalPrepareFeishu := prepareFeishuNotification
	originalPrepareDingTalk := prepareDingTalkNotification
	t.Cleanup(func() {
		listCompanyNotificationUsers = originalListUsers
		sendCompanyNotificationEmail = originalSendEmail
		prepareFeishuNotification = originalPrepareFeishu
		prepareDingTalkNotification = originalPrepareDingTalk
	})
}

func TestSendCompanyNotificationFiltersAllUserRecipients(t *testing.T) {
	preserveCompanyNotificationDependencies(t)
	listCompanyNotificationUsers = func() ([]model.NotificationUser, error) {
		return []model.NotificationUser{
			{Id: 1, OpenId: "open-1", Email: "one@example.com"},
			{Id: 2, OpenId: "", Email: "two@example.com"},
			{Id: 3, OpenId: "open-3", Email: ""},
		}, nil
	}
	var platformRecipients []string
	prepareFeishuNotification = func(_ *model.Company, _, _ string, _ []CompanyNotificationImage) (func(string) error, error) {
		return func(recipient string) error {
			platformRecipients = append(platformRecipients, recipient)
			return nil
		}, nil
	}
	var emailRecipients []string
	sendCompanyNotificationEmail = func(recipient, _, _ string, _ []CompanyNotificationImage) error {
		emailRecipients = append(emailRecipients, recipient)
		return nil
	}

	result, err := SendCompanyNotification(CompanyNotificationRequest{
		Company:      &model.Company{Platform: model.CompanyPlatformFeishu},
		Title:        "Maintenance",
		Content:      "Tonight",
		SendPlatform: true,
		SendEmail:    true,
	})

	require.NoError(t, err)
	assert.Equal(t, []string{"open-1", "open-3"}, platformRecipients)
	assert.Equal(t, []string{"one@example.com", "two@example.com"}, emailRecipients)
	assert.Equal(t, 6, result.Total)
	assert.Equal(t, 4, result.Success)
	assert.Equal(t, 0, result.Failed)
	assert.Equal(t, 2, result.Skipped)
}

func TestSendCompanyNotificationTestModeUsesOnlyExplicitRecipients(t *testing.T) {
	preserveCompanyNotificationDependencies(t)
	listCalled := false
	listCompanyNotificationUsers = func() ([]model.NotificationUser, error) {
		listCalled = true
		return nil, nil
	}
	prepareFeishuNotification = func(_ *model.Company, _, _ string, _ []CompanyNotificationImage) (func(string) error, error) {
		return func(recipient string) error {
			if recipient == "bad-open-id" {
				return errors.New("recipient rejected")
			}
			return nil
		}, nil
	}
	sendCompanyNotificationEmail = func(_, _, _ string, _ []CompanyNotificationImage) error {
		return errors.New("SMTP unavailable")
	}

	result, err := SendCompanyNotification(CompanyNotificationRequest{
		Company:         &model.Company{Platform: model.CompanyPlatformFeishu},
		Title:           "Test",
		Content:         "Message",
		SendPlatform:    true,
		SendEmail:       true,
		TestMode:        true,
		TestPlatformIDs: []string{"good-open-id", "bad-open-id", "good-open-id"},
		TestEmails:      []string{"tester@example.com"},
	})

	require.NoError(t, err)
	assert.False(t, listCalled)
	assert.Equal(t, 3, result.Total)
	assert.Equal(t, 1, result.Success)
	assert.Equal(t, 2, result.Failed)
	assert.Equal(t, 0, result.Skipped)
	require.Len(t, result.Failures, 2)
	assert.Equal(t, "platform", result.Failures[0].Channel)
	assert.Equal(t, "email", result.Failures[1].Channel)
}

func TestSendCompanyNotificationAllowsEmailWithoutCompany(t *testing.T) {
	preserveCompanyNotificationDependencies(t)
	listCompanyNotificationUsers = func() ([]model.NotificationUser, error) {
		return []model.NotificationUser{{Id: 1, Email: "one@example.com"}}, nil
	}
	var recipients []string
	sendCompanyNotificationEmail = func(recipient, _, _ string, _ []CompanyNotificationImage) error {
		recipients = append(recipients, recipient)
		return nil
	}

	result, err := SendCompanyNotification(CompanyNotificationRequest{
		Title:     "Email only",
		Content:   "Message",
		SendEmail: true,
	})

	require.NoError(t, err)
	assert.Equal(t, []string{"one@example.com"}, recipients)
	assert.Equal(t, 1, result.Total)
	assert.Equal(t, 1, result.Success)
}

func TestBuildFeishuCompanyNotificationCardMatchesNoticeFormat(t *testing.T) {
	card := buildFeishuCompanyNotificationCard(
		"Price notice",
		"Use **Responses**\r\n\r\n\r\nSee [guide]",
		[]string{"img-first", "img-second"},
	)

	assert.Equal(t, map[string]any{"wide_screen_mode": true}, card["config"])
	header, ok := card["header"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "orange", header["template"])
	assert.Equal(t, map[string]string{"tag": "plain_text", "content": "Price notice"}, header["title"])

	elements, ok := card["elements"].([]any)
	require.True(t, ok)
	require.Len(t, elements, 3)
	assert.Equal(t, map[string]any{
		"tag":     "markdown",
		"content": "**Use \\*\\*Responses\\*\\***\nSee \\[guide\\]",
	}, elements[0])
	assert.Equal(t, map[string]any{
		"tag":     "img",
		"img_key": "img-first",
		"alt":     map[string]string{"tag": "plain_text", "content": "Price notice"},
	}, elements[1])
	assert.Equal(t, map[string]any{
		"tag":     "img",
		"img_key": "img-second",
		"alt":     map[string]string{"tag": "plain_text", "content": "Price notice"},
	}, elements[2])
}

func TestBuildDingTalkCompanyNotificationMarkdown(t *testing.T) {
	for _, test := range []struct {
		name     string
		title    string
		content  string
		mediaIDs []string
		wantText string
	}{
		{
			name: "without images", title: "通知", content: "第一行\r\n第二行\r第三行",
			wantText: "## 通知\n\n第一行  \n第二行  \n第三行",
		},
		{
			name: "single inline image", title: "通知", content: "正文",
			mediaIDs: []string{"@lADOADmaWMzazQKA"},
			wantText: "## 通知\n\n正文\n\n![](@lADOADmaWMzazQKA)",
		},
		{
			name: "all images in order", title: "通知", content: "正文",
			mediaIDs: []string{"@first", "@second"},
			wantText: "## 通知\n\n正文\n\n![](@first)\n\n![](@second)",
		},
		{
			name: "plain text stays literal", title: "版本 *2*", content: "Use **Responses**\n[guide](url) & <tag>",
			wantText: "## 版本 \\*2\\*\n\nUse \\*\\*Responses\\*\\*  \n\\[guide\\]\\(url\\) &amp; &lt;tag\\>",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			message, err := buildDingTalkCompanyNotificationMarkdown(test.title, test.content, test.mediaIDs)
			require.NoError(t, err)
			assert.Equal(t, map[string]any{
				"msgtype":  "markdown",
				"markdown": map[string]string{"title": test.title, "text": test.wantText},
			}, message)
		})
	}
}

func TestDingTalkCompanyNotificationMarkdownLengthLimit(t *testing.T) {
	// The title and formatting add six characters to the final body.
	content := strings.Repeat("中", 4994)
	message, err := buildDingTalkCompanyNotificationMarkdown("题", content, nil)
	require.NoError(t, err)
	require.NotNil(t, message)
	for _, test := range []struct {
		name     string
		content  string
		mediaIDs []string
	}{
		{name: "body overflow", content: content + "中"},
		{name: "image reference overflow", content: content, mediaIDs: []string{"@image"}},
		{name: "escaping overflow", content: strings.Repeat("*", 2498)},
	} {
		t.Run(test.name, func(t *testing.T) {
			message, err := buildDingTalkCompanyNotificationMarkdown("题", test.content, test.mediaIDs)
			require.ErrorContains(t, err, "exceeds 5000 characters")
			assert.Nil(t, message)
		})
	}
}
