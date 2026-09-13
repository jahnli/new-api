# 移除 GitHub、Discord、Telegram、LinuxDO OAuth 登录

**日期**: 2026-06-23

## 涉及文件

### 后端 — 删除

- `oauth/github.go` — GitHub OAuth 提供商实现
- `oauth/discord.go` — Discord OAuth 提供商实现
- `oauth/linuxdo.go` — LinuxDO OAuth 提供商实现及 TrustLevelError 类型
- `controller/telegram.go` — Telegram 登录/绑定控制器
- `setting/system_setting/discord.go` — Discord 设置结构体与注册

### 后端 — 修改

- `model/user.go` — 移除 GitHubId、DiscordId、TelegramId、LinuxDOId 字段及相关查询/绑定方法
- `common/constants.go` — 移除 GitHub/LinuxDO/Telegram OAuth 相关全局变量
- `controller/misc.go` — GetStatus 响应移除 4 个提供商的 OAuth 状态字段
- `controller/oauth.go` — 简化 findOrCreateOAuthUser（移除 legacy GitHub 迁移、TrustLevelError 处理与多余列更新）
- `controller/option.go` — 移除 4 个提供商的启用前校验 case
- `controller/user.go` — GetSelf 响应移除 4 个 ID 字段
- `model/option.go` — 移除 OptionMap 初始化项及 updateOptionMap 赋值分支（保留空 case 兼容旧 DB 数据）
- `router/api-router.go` — 移除 Telegram login/bind 路由
- `i18n/keys.go` — 移除 6 个已废弃的 i18n 消息常量
- `i18n/locales/en.yaml` — 移除对应翻译
- `i18n/locales/zh-CN.yaml` — 移除对应翻译
- `i18n/locales/zh-TW.yaml` — 移除对应翻译

### 前端 — 删除

- `web/default/src/assets/brand-icons/icon-github.tsx`
- `web/default/src/assets/brand-icons/icon-discord.tsx`
- `web/default/src/assets/brand-icons/icon-linuxdo.tsx`
- `web/default/src/assets/brand-icons/icon-telegram.tsx`
- `web/default/src/features/profile/components/dialogs/telegram-bind-dialog.tsx`

### 前端 — 修改

- `web/default/src/assets/brand-icons/index.ts` — 移除 4 个图标导出
- `web/default/src/features/auth/lib/oauth.ts` — 移除 4 个提供商函数
- `web/default/src/lib/oauth.ts` — 移除 URL 构建与处理函数
- `web/default/src/features/auth/types.ts` — 从 SystemStatus 与 OAuthProvider 类型移除字段
- `web/default/src/features/auth/hooks/use-oauth-login.ts` — 移除 4 个登录处理函数
- `web/default/src/features/auth/components/oauth-providers.tsx` — 移除 4 个提供商按钮
- `web/default/src/features/auth/components/oauth-callback-screen.tsx` — 移除提供商字典项
- `web/default/src/features/auth/sign-in/components/user-auth-form.tsx` — 简化 hasOAuthLogin 判断
- `web/default/src/features/system-settings/types.ts` — 移除设置类型字段
- `web/default/src/features/system-settings/auth/index.tsx` — 移除默认值
- `web/default/src/features/system-settings/auth/oauth-section.tsx` — 移除 4 个 Tab/表单/Schema
- `web/default/src/features/profile/types.ts` — 移除 4 个 ID 字段
- `web/default/src/features/profile/components/tabs/account-bindings-tab.tsx` — 移除绑定项
- `web/default/src/features/users/types.ts` — 移除用户 Schema 字段
- `web/default/src/features/users/components/dialogs/user-binding-dialog.tsx` — 移除 BUILTIN_BINDINGS 项
- `web/default/src/routes/(auth)/oauth.tsx` — 收窄提供商联合类型
- `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json` — 移除相关翻译键（每语言约 23 条）
