# 用户演示模式与敏感信息脱敏

**日期**: 2026-07-23 ~ 08-04

## 涉及文件

- `controller/user.go` — 保存演示模式并合并现有设置，避免覆盖通知、语言、侧边栏和扣费偏好。
- `dto/user_settings.go` — 增加演示模式字段。
- `web/src/features/channels/` — 演示模式遮罩渠道分组、模型信息，并禁用敏感信息切换。
- `web/src/features/pricing/` — 遮罩价格、动态计费表达式和分组倍率，统一传递可见性状态。
- `web/src/features/profile/`、`web/src/hooks/use-demo-mode.ts`、`web/src/lib/demo-mode.ts` — 新增设置开关、响应式 Hook、统一价格和身份遮罩工具。
- `web/src/features/usage-logs/` — 遮罩渠道名称、用户名和身份入口，停止加载用户详情。
- `web/src/features/users/components/shared-user-columns.tsx` — 用户管理与数据总览共用列遮罩显示名、用户名、备注、头像、资料卡和飞书跳转。
- `web/src/features/security-audit/` — 遮罩非工作时段、图片审计中的用户名，保留原用户名供后台查询；禁用真实头像和资料加载。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充演示模式多语言文案。

## 2026-08-04 用户身份脱敏扩展

- `web/src/lib/demo-mode.ts` — 用户名统一遮罩为 `***`。
- `web/src/features/usage-logs/components/columns/task-logs-columns.tsx`、`web/src/features/usage-logs/components/usage-logs-mobile-card.tsx` — 任务日志和移动端日志同步遮罩用户名与身份入口。
- `web/src/features/security-audit/components/off-hours-columns.tsx`、`web/src/features/security-audit/components/off-hours-detail-dialog.tsx` — 遮罩审计用户列和日志详情标题，后台查询仍用原用户名。
- `web/src/features/security-audit/components/image-audit-columns.tsx` — 遮罩图片审计用户名并禁用真实头像和资料悬停请求。
- `web/src/lib/__tests__/demo-mode.test.ts`、`web/src/features/users/components/__tests__/username-visibility.test.tsx`、`web/src/features/security-audit/components/__tests__/user-visibility.test.tsx` — 覆盖 `***`、普通模式原值及姓名、头像、链接不泄露。
