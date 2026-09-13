# 用户创建后自动订阅套餐

**日期**: 2026-07-06

## 涉及文件

- `setting/system_setting/registration.go` — 新增并持久化 `registration.auto_subscribe_plan_id`
- `controller/user.go` — 普通注册和后台新增用户后按配置自动绑定套餐，失败不阻断创建
- `controller/ldap.go` — LDAP 首次登录建号后自动绑定套餐，来源记为 `ldap_register_auto`
- `model/subscription.go` — 后台绑定订阅支持来源标记，注册自动订阅记为 `register_auto`
- `web/default/src/features/system-settings/auth/basic-auth-section.tsx` — 基础认证设置新增注册后自动订阅套餐选择，回显套餐名称
- `web/default/src/features/system-settings/auth/index.tsx`、`web/default/src/features/system-settings/auth/section-registry.tsx`、`web/default/src/features/system-settings/types.ts` — 串接设置默认值和类型
- `web/default/src/i18n/locales/*.json` — 补充 6 语言翻译
