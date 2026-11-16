# 用户创建后自动订阅

**日期**: 2026-11-16

- 普通注册和后台建号按用户公司匹配注册规则，配置套餐 ID 为正时自动绑定；失败记录日志，不阻断用户创建，分别记录 `register_auto`、`admin_create_auto` 来源。
- OIDC 首次注册使用已验证公司属性匹配的套餐，后续登录及账号绑定不追加订阅，详见 [OIDC 注册](029-remove-github-discord-telegram-linuxdo-oauth.md)。
- 公司规则及套餐选择保存在 `company_registration.configs`，前端回显套餐名称。

## 实现入口

- `controller/user.go` — `autoSubscribeUserAfterCreate`。
- `setting/system_setting/company_registration.go`、`model/subscription.go` — 公司规则与绑定。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 公司套餐选择。
