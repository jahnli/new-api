# 渠道界面优化

**日期**: 2026-08-24

## 涉及文件

- `web/default/src/features/channels/components/channels-table.tsx` — 渠道页默认视图改为列表，并调整桌面端默认分页数量。
- `web/default/src/components/data-table/toolbar/view-mode-toggle.tsx` — 视图切换按钮顺序调整为列表优先、卡片次之。
- `web/src/features/channels/components/channels-table.tsx` — 当前前端渠道列表桌面端默认分页调整为每页 50 条。
- `web/src/features/channels/components/model-mapping-editor.tsx` — 添加映射按钮移至映射列表顶部，新映射插入首行。
