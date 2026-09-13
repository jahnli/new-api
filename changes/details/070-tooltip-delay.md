# 全系统 UI Tooltip 延迟统一

**日期**: 2026-08-15

## 涉及文件

- `web/src/components/ui/tooltip.tsx` — 公共 `TooltipProvider` 默认弹出延迟由 0ms 调整为 100ms
- `web/src/components/ui/sidebar.tsx` — 侧边栏 Tooltip 显式延迟统一为 100ms
- `web/src/components/long-text.tsx` — 长文本完整内容 Tooltip 延迟统一为 100ms
- `web/src/features/data-overview/index.tsx` — 数据总览页 Tooltip 延迟统一为 100ms
- `web/src/features/channels/components/channels-columns.tsx` — 渠道表格原有 200ms、300ms 延迟统一为 100ms
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 使用日志原有 300ms 延迟统一为 100ms
- `web/src/features/playground/components/message/message-actions.tsx` — Playground 消息操作 Tooltip 延迟由 300ms 调整为 100ms
- `web/src/features/image-studio/lib/model-params/seedream/params.tsx` — 在线生图参数说明 Tooltip 延迟统一为 100ms
