# OAuth 登录调整与 OIDC 自动登录、单点登出

**日期**: 2026-11-05

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

## 2026-11-03：首页与登录页自动发起 OIDC 登录

启用 OIDC 且配置授权端点和客户端标识后，未登录用户访问首页会进入登录流程，登录页自动跳转登录中心；同一浏览器已有可复用的登录中心会话且无需额外交互时，可免输入密码完成登录并返回原目标页面。登录中心没有有效会话时展示其登录页面，保留条款确认和服务端 MFA 流程。

自动登录等待服务端站点配置就绪，不根据本地缓存占位数据提前跳转，也不会主动注销本地会话。复用现有 OAuth 登录组件和加载组件，避免重复发起授权请求，组件卸载或切换登录方式后停止过期请求触发的跳转。首页预加载、已有登录态、配置获取失败或会话恢复发生临时错误时不自动跳转。

登录失败及本地退出后的登录页使用 `auto_login=false` 保留手动入口；主动退出和跨标签页退出通知同步暂停自动登录。标签页内的防循环标记有效期为 60 秒，旧的永久标记自动视为过期，登录成功后清除标记；浏览器存储不可用时保留手动登录。可通过 `/sign-in?auto_login=false` 直接进入手动登录页面。

### 涉及文件

- `web/src/routes/index.tsx` — 首页读取站点配置并确认本地会话，符合条件时进入自动登录流程，保留原访问地址。
- `web/src/routes/(auth)/sign-in.tsx` — 校验关闭自动登录的查询参数。
- `web/src/features/auth/sign-in/index.tsx` — 将自动登录开关传入登录表单。
- `web/src/features/auth/sign-in/components/user-auth-form.tsx` — 等待配置就绪后优先展示 OIDC 登录方式，保留用户实际勾选条款的要求，并在 Passkey 登录期间暂停自动跳转。
- `web/src/features/auth/components/oauth-providers.tsx` — 扩展现有登录组件，接入自动登录并复用 `LoadingState` 和已有七语言提示。
- `web/src/features/auth/hooks/use-oauth-login.ts` — 自动创建授权流程，保留登录后返回地址，处理请求复用、失败提示与过期跳转取消。
- `web/src/features/auth/lib/oidc-auto-login.ts` — 管理标签页内的 60 秒防循环冷却、旧标记兼容及存储不可用时的降级行为。
- `web/src/features/auth/hooks/use-auth-redirect.ts` — 登录成功后清除自动登录暂停标记，MFA 仍经原有流程完成。
- `web/src/hooks/use-status.ts` — 暴露站点配置是否已完成获取，区分服务端结果与本地缓存占位数据。
- `web/src/routes/oauth/$provider.tsx` — 登录回调失败后返回手动登录页并保留安全的目标地址，避免重复回调重新设置成功登录已清除的标记。
- `web/src/components/sign-out-dialog.tsx` — 本地退出成功后暂停自动登录，本地返回登录页时关闭自动跳转。
- `web/src/routes/__root.tsx` — 跨标签页登录通知清除暂停标记，退出通知暂停自动登录并返回手动入口。

### 配置与验证范围

浏览器访问入口、网关配置的站点地址和身份提供方登记的回调地址应保持一致；登录回调为 `/oauth/oidc`，退出后的返回地址为 `/sign-in`。

本次前端改动已在 `web/` 执行 `bunx --no-install tsgo -b`、对修改文件执行 `bunx --no-install oxlint -c .oxlintrc.json` 和 `bunx --no-install oxfmt --check`，均通过；`bun run build` 生产构建成功，`git diff --check` 通过。当前 Bun 1.3.14 无法执行项目脚本中的 `bun check -b`，本地旧版 `tsc` 也不支持现有配置，因此类型检查使用可用的 `tsgo` 完成。未运行测试，真实 Casdoor 跨系统登录与退出后的完整流程尚未联调验证。

## 2026-11-05：OIDC 登出支持本地回环 HTTP 地址

前后端登出地址校验允许 `localhost`、IPv4 与 IPv6 回环地址使用 HTTP，支持本地开发环境的登录中心登出；其他主机仍要求 HTTPS，继续拒绝包含用户名、密码或片段的地址。

### 涉及文件

- `oauth/oidc_logout.go` — 使用主机名及 IP 回环判定，为登出端点增加本地 HTTP 例外，并区分无效地址与协议限制错误。
- `web/src/components/sign-out-dialog.tsx` — 跳转登录中心前同步允许回环 HTTP 地址，识别 `127.0.0.0/8`、`::1` 及映射到 IPv4 回环的 IPv6 地址。
