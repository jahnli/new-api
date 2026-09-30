# 全站分页参数隔离

**日期**: 2026-09-30

## 涉及文件

- `web/src/hooks/use-table-url-state.ts` — 支持独立分页存储及内存分页模式；内存模式不读写 URL 或本地存储，保留筛选重置页码与页码越界修正。
- `web/src/features/models/components/models-table.tsx` — 模型列表改用内存分页，刷新恢复第 1 页，桌面端默认每页 50 条、移动端默认每页 10 条。
- `web/src/features/models/constants.ts` — 模型默认分页数量由 20 改为 50，补充模型弹框同步使用该数量。
- `web/src/features/models/components/deployments-table.tsx` — 部署列表改用内存分页，刷新恢复第 1 页，桌面端默认每页 10 条、移动端默认每页 8 条。
- `web/src/features/models/components/vendors-table.tsx` — 供应商列表改用内存分页，默认每页 20 条，跳转关联模型时不再传递页码。
- `web/src/features/models/components/vendor-linked-models.tsx` — 打开筛选后的模型列表时不再向 URL 写入页码。
- `web/src/routes/_authenticated/models/$section.tsx` — 移除模型、供应商及部署列表的 URL 分页参数声明。
- `web/src/features/channels/components/channels-table.tsx` — 渠道列表改用内存分页，桌面端与移动端均默认每页 50 条，刷新恢复第 1 页及默认数量。
- `web/src/routes/_authenticated/channels/index.tsx` — 移除渠道列表的 URL 页码与每页数量参数声明。
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
