# OAuth 登录调整与 OIDC 单点登出

**日期**: 2026-11-03

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

## 2026-11-03：OIDC 后端通道登出与主动登出

新增后端通道登出接口，验证身份提供方签发的登出令牌后，按用户或会话标识撤销对应的本地 OIDC 会话；持久化登出记录，在登录回调、二次验证、会话签发与认证校验中阻止已登出会话恢复。

用户主动退出 OIDC 会话时，先注销本地会话，再通过浏览器跳转到发现配置中的 HTTPS 登出端点，请求结束登录中心会话。原始身份令牌加密保存于认证流程表，仅在验证当前会话凭据后用于生成登出地址；返回地址固定为配置的服务器地址加 `/sign-in`。登出端点或凭据不可用时保留本地退出结果，并提示统一登出不可用。

配置页新增可复制的后端通道登出地址、登出后返回地址及登记说明；补齐七种语言。修复 PostgreSQL 对空 `CHAR(64)` 标识填充空格导致的普通会话校验错误，并将失效会话错误映射为认证失败响应。

### 涉及文件

- `controller/oidc_logout.go` — 接收后端通道登出请求、限制请求体、验证令牌并撤销会话；主动退出后生成登录中心登出响应。
- `controller/auth_session.go` — 主动退出支持单点登出参数，在本地撤销前验证会话凭据，撤销成功后返回登出地址或不可用标记。
- `controller/oauth.go` — 将已验证的 OIDC 身份信息传入共用登录流程。
- `controller/user.go` — 在登录验证与指定认证版本的会话创建过程中传递 OIDC 会话信息。
- `model/oidc_logout.go` — 新增身份摘要、登出记录、重复通知处理与会话失效判定，读取加密登出凭据并清理过期记录。
- `model/user_session.go` — 增加 OIDC 会话字段与索引，升级缓存结构，在会话创建事务中保存加密凭据；规范化 PostgreSQL 空标识并接入失效判定。
- `model/auth_flow.go` — 事务内的敏感操作认证增加 OIDC 会话失效检查。
- `model/main.go` — 将 OIDC 登出记录表纳入数据库迁移。
- `oauth/oidc_tokens.go` — 读取并缓存发现配置与签名公钥，校验身份令牌和登出令牌的签名、签发方、受众、时间及协议字段。
- `oauth/oidc_logout.go` — 解密登出凭据，核对身份提供方配置，构造包含身份令牌提示、客户端标识与固定返回地址的 HTTPS 登出请求地址。
- `oauth/oidc.go` — 校验身份令牌与用户信息的一致性及随机数，生成会话身份摘要并加密登出凭据；加密不可用时保留登录流程。
- `oauth/types.go` — 增加发现地址、随机数与 OIDC 会话信息的内部传递字段。
- `router/api-router.go` — 注册 `/api/oauth/oidc/backchannel-logout` 接口，接入限流与禁用缓存中间件。
- `service/auth_session.go` — 在会话创建和令牌签发中传递、检查 OIDC 信息；验证用于登出的刷新凭据，统一映射失效会话错误。
- `service/login_verification.go` — 二次验证期间保存并传递 OIDC 会话信息，完成验证后创建对应会话。
- `service/auth_cleanup.go` — 定期清理过期的 OIDC 登出记录。
- `web/src/components/sign-out-dialog.tsx` — 主动退出请求单点登出并校验返回地址后跳转，增加 OIDC 退出确认文案与本地退出提示。
- `web/src/features/auth/api.ts` — 扩展退出响应类型与可选单点登出参数，默认调用保持本地退出。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 展示并支持复制两类登出地址，补充身份提供方登记说明。
- `web/src/lib/oauth.ts` — OIDC 授权请求携带与当前登录流程绑定的随机数。
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐登出地址、配置说明、退出确认与失败降级提示。

### 配置与验证范围

主动请求登录中心登出需要发现配置提供 HTTPS `end_session_endpoint`，身份提供方登记网关的 `/sign-in` 返回地址，并在升级后重新进行 OIDC 登录以保存登出凭据；凭据加密使用至少 32 字节的 `SESSION_SECRET`。关闭 OIDC 不会跳过数据库迁移、缓存结构升级或定期清理。

已完成 Go 编译、前端类型检查、相关文件静态检查与生产构建；未运行测试，三种数据库的完整迁移兼容验证与登录中心实际登出联调尚未完成。
