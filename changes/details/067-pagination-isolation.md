# 分页状态隔离

**日期**: 2026-11-18

- 用户列表分页仅使用 URL 参数与当前模式的默认值，不读写本地存储，详见 [用户管理](039-user-management-table.md)；API 密钥使用独立存储，使用日志的普通/绘图/任务、审计的各分类分别保存 URL 分页和筛选，互不串页。
- 模型、供应商、部署和渠道使用内存分页，不读写 URL 或本地存储，刷新恢复首页及默认数量；筛选变化重置页码，越界自动修正。
- 默认数量：模型桌面 50/移动 10，部署桌面 10/移动 8，供应商 20，渠道桌面和移动均 50。模型广场与定价编辑器的 100 条配置不属于模型管理分页。

入口：`web/src/hooks/use-table-url-state.ts`、`web/src/features/models/components/`、`web/src/features/channels/components/channels-table.tsx`、`web/src/features/usage-logs/`、`web/src/routes/_authenticated/usage-logs/`。
