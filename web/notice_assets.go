package web

import "embed"

// NoticeImages are shared by the web preview and outgoing Feishu cards.
//
//go:embed public/notice/non-work/*.png public/notice/security-alert/*.png public/notice/model-switch/*.png
var NoticeImages embed.FS
