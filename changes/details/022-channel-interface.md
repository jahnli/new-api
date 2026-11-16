# 渠道列表与模型映射

**日期**: 2026-08-24

渠道默认列表视图，切换顺序为列表、卡片，每页默认 50 条。模型映射添加按钮位于顶部，新映射插入首行；分页持久化规则见 [#067](067-pagination-isolation.md)。

入口：`web/src/features/channels/components/channels-table.tsx`、`web/src/components/data-table/toolbar/view-mode-toggle.tsx`、`web/src/features/channels/components/model-mapping-editor.tsx`。
