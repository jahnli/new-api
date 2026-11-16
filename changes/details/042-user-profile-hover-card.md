# 用户资料悬停卡片

**日期**: 2026-11-09

- 头像悬停展示背景图、姓名、角色、公司及非空任职资料；无背景图使用蓝色渐变，资料全空时不渲染分隔线和字段区。
- 职级、职位描述、出生日期、探亲地、民族直接读取独立字段，不解析旧 `custom_field_values`；手机号、出生日期、民族、探亲地仅超级管理员可见。
- 用户管理、数据总览、使用日志和安全审计共享资料字段及展示；按性别展示图标，适配演示模式脱敏。

## 实现入口

- `web/src/features/users/components/user-profile-hover-card.tsx`、`web/src/features/users/components/shared-user-columns.tsx` — 资料卡片与任职概览。
- `web/src/features/users/types.ts`、`web/src/features/data-overview/types.ts`、`web/src/features/usage-logs/types.ts` — 资料类型。
- `web/src/features/usage-logs/components/log-user-cell.tsx`、`web/src/features/security-audit/components/` — 日志及审计入口。
