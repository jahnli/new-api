# 全站分页参数隔离

**日期**: 2026-08-10

## 涉及文件

- `web/src/hooks/use-table-url-state.ts` — 支持按界面配置独立 pageSize 存储 key，避免不同表格共享分页大小。
- `web/src/features/models/components/models-table.tsx` — 模型列表用独立分页存储。
- `web/src/features/models/components/deployments-table.tsx` — 部署列表用独立分页存储。
- `web/src/features/channels/components/channels-table.tsx` — 渠道列表用独立分页存储，桌面端默认每页 50 条。
- `web/src/features/users/components/users-table.tsx` — 用户列表用独立分页存储。
- `web/src/features/keys/components/api-keys-table.tsx` — API 密钥列表用独立分页存储。
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — Common、Drawing、Task 日志用独立 URL 分页参数与存储 key。
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 普通日志筛选重置独立分页参数。
- `web/src/features/usage-logs/components/task-logs-filter-bar.tsx` — Drawing、Task 日志筛选重置独立分页参数。
- `web/src/routes/_authenticated/usage-logs/$section.tsx` — 声明各日志界面的独立分页参数。
- `web/src/features/security-audit/components/off-hours-table.tsx` — 非工作时间审计用独立分页参数。
- `web/src/features/security-audit/components/image-audit-table.tsx` — 图片审计用独立分页参数。
- `web/src/features/security-audit/index.tsx` — 安全审计筛选、切换时同步处理独立分页参数。
- `web/src/routes/_authenticated/security-audit/$section.tsx` — 声明安全审计各界面的独立分页参数。
