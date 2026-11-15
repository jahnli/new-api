package web

import "embed"

// NoticeImages are shared by the web preview and outgoing Feishu cards.
//
//go:embed public/notice/*.png public/notice/warn/*.png public/notice/critical/*.png public/notice/security-alert/*.png
var NoticeImages embed.FS
