# 安全审计与非工作时间请求

**日期**: 2026-07-20

## 涉及文件

- `controller/option.go` — 兼容并迁移旧版安全审计配置。
- `controller/security_audit.go` — 提供审计配置和非工作时间请求查询接口。
- `model/option.go` — 增加旧配置迁移逻辑。
- `model/audit_setting_migration_test.go` — 覆盖配置迁移。
- `model/security_audit.go` — 聚合非工作时段请求，支持用户筛选、按天数排序和常用模型统计。
- `model/security_audit_test.go` — 覆盖时间窗口、聚合、分页、中文显示名模糊筛选和模型排行。
- `setting/system_setting/audit_setting.go` — 用结构化非工作时段配置。
- `router/api-router.go` — 注册安全审计路由。
- `web/default/src/features/security-audit/` — 新增安全审计页、筛选、表格、日志详情和用户资料展示，详情弹框高度统一为视口 85%。
- `web/default/src/features/system-settings/security/` — 新增安全审计设置页。
- `web/default/src/hooks/use-sidebar-data.ts` — 增加安全审计入口。
- `web/default/src/routes/_authenticated/security-audit/` — 增加受保护路由。
- `web/default/src/i18n/` — 补充安全审计多语言文案。
