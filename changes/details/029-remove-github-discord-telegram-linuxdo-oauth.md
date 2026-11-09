# OAuth 登录调整与 OIDC 静默登录、双向退出联动及用户名过滤

**日期**: 2026-11-09

当前 OIDC 行为以末尾「2026-11-09：用户名过滤」及「2026-11-06：可选静默登录与回调加载优化」、此前双向退出联动说明为准。前面的实现和回退说明保留为历史记录；当前保留手动登录，支持默认关闭的静默登录与用户名过滤，主动退出使用 Casdoor 浏览器会话，后端退出通知使用签名验证与会话关联。

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

登录失败后的登录页使用 `auto_login=false` 保留手动入口，避免重复发起授权；也可通过 `/sign-in?auto_login=false` 直接进入手动登录页面。2026-11-05 已移除原有 60 秒冷却及标签页暂停标记，OIDC 退出后改为仅停留当次首页访问，刷新恢复自动登录，详见下方退出返回行为调整。

### 涉及文件

- `web/src/routes/index.tsx` — 首页读取站点配置并确认本地会话，符合条件时进入自动登录流程，保留原访问地址。
- `web/src/routes/(auth)/sign-in.tsx` — 校验关闭自动登录的查询参数。
- `web/src/features/auth/sign-in/index.tsx` — 将自动登录开关传入登录表单。
- `web/src/features/auth/sign-in/components/user-auth-form.tsx` — 等待配置就绪后优先展示 OIDC 登录方式，保留用户实际勾选条款的要求，并在 Passkey 登录期间暂停自动跳转。
- `web/src/features/auth/components/oauth-providers.tsx` — 扩展现有登录组件，接入自动登录并复用 `LoadingState` 和已有七语言提示。
- `web/src/features/auth/hooks/use-oauth-login.ts` — 自动创建授权流程，保留登录后返回地址，处理请求复用、失败提示与过期跳转取消。
- `web/src/features/auth/lib/oidc-auto-login.ts` — 原标签页冷却模块，已于 2026-11-05 删除。
- `web/src/features/auth/hooks/use-auth-redirect.ts` — 登录成功后处理用户信息与原页面返回，MFA 仍经原有流程完成；不再读写自动登录暂停标记。
- `web/src/hooks/use-status.ts` — 暴露站点配置是否已完成获取，区分服务端结果与本地缓存占位数据。
- `web/src/routes/oauth/$provider.tsx` — 登录回调失败后返回手动登录页并保留安全的目标地址，保留回调请求复用与完成状态保护。
- `web/src/components/sign-out-dialog.tsx` — OIDC 退出请求登录中心登出，返回后进入首页；单点登出不可用时保留本地退出提示并返回首页。
- `web/src/routes/__root.tsx` — 同步跨标签页登录状态；收到当前 OIDC 会话退出通知后清理本地状态并返回首页。

### 配置与验证范围

浏览器访问入口、网关配置的站点地址和身份提供方登记的回调地址应保持一致；登录回调为 `/oauth/oidc`，退出后的返回地址为 `/sign-in`。

本次前端改动已在 `web/` 执行 `bunx --no-install tsgo -b`、对修改文件执行 `bunx --no-install oxlint -c .oxlintrc.json` 和 `bunx --no-install oxfmt --check`，均通过；`bun run build` 生产构建成功，`git diff --check` 通过。当前 Bun 1.3.14 无法执行项目脚本中的 `bun check -b`，本地旧版 `tsc` 也不支持现有配置，因此类型检查使用可用的 `tsgo` 完成。未运行测试，真实 Casdoor 跨系统登录与退出后的完整流程尚未联调验证。

## 2026-11-05：OIDC 登出支持本地回环 HTTP 地址

前后端登出地址校验允许 `localhost`、IPv4 与 IPv6 回环地址使用 HTTP，支持本地开发环境的登录中心登出；其他主机仍要求 HTTPS，继续拒绝包含用户名、密码或片段的地址。

### 涉及文件

- `oauth/oidc_logout.go` — 使用主机名及 IP 回环判定，为登出端点增加本地 HTTP 例外，并区分无效地址与协议限制错误。
- `web/src/components/sign-out-dialog.tsx` — 跳转登录中心前同步允许回环 HTTP 地址，识别 `127.0.0.0/8`、`::1` 及映射到 IPv4 回环的 IPv6 地址。

## 2026-11-05：取消自动登录冷却，退出返回首页后刷新可重新登录

移除 OIDC 自动登录冷却及原有标签页暂停标记。普通进入或刷新首页、登录页时，满足配置、会话与条款条件即可发起授权；登录回调失败仍返回带 `auto_login=false` 的手动入口，避免循环跳转。

OIDC 退出继续使用已登记的 `/sign-in` 作为登录中心返回地址，不向 Casdoor 传入 `signed_out` 参数。浏览器在跳转登出前保存一次性返回标记，返回登录页时消费标记并转到首页；单点登出不可用时的本地退出及跨标签页 OIDC 退出同步也返回首页。该标记仅控制页面导航，不作为认证或退出成功凭据。

首页接收 `signed_out=true` 后通过路由替换清除地址参数，以内存状态停留在当次首页访问，离开首页或刷新后恢复自动登录资格。因此在 Casdoor 重新登录后，刷新原网关窗口即可重新发起授权，无需等待冷却或新开窗口。一次性返回标记依赖浏览器会话存储；存储不可用时仍执行登录中心登出，但无法保证返回后自动转到首页。

### 涉及文件

- `web/src/features/auth/lib/oidc-auto-login.ts` — 删除冷却与标签页暂停逻辑。
- `web/src/features/auth/hooks/use-oauth-login.ts` — 移除冷却检查，保留授权请求复用和组件卸载后的跳转取消。
- `web/src/features/auth/hooks/use-auth-redirect.ts` — 删除登录成功后的暂停标记清理。
- `web/src/features/auth/lib/oidc-logout.ts` — 新增一次性退出返回标记的保存与消费。
- `web/src/components/sign-out-dialog.tsx` — 登录中心登出前保存返回标记，OIDC 本地退出兜底进入首页。
- `web/src/routes/(auth)/sign-in.tsx` — 实际进入时消费退出返回标记并转到首页，预加载不消费标记。
- `web/src/routes/index.tsx` — 清除退出查询参数，仅在当前首页访问中抑制自动登录，刷新或离开首页后解除。
- `web/src/routes/__root.tsx` — 按当前会话登录方式处理跨标签页退出，OIDC 会话返回首页。
- `web/src/routes/oauth/$provider.tsx` — 删除冷却标记写入，保留失败后关闭自动登录的查询参数。

### 验证范围

在仓库根目录执行 `go build ./oauth`、`git diff --check`，在 `web/` 执行 `bun x --package typescript@5.9.3 tsc -b --noEmit --pretty false`、对修改文件执行 `bun x --no-install oxlint -c .oxlintrc.json` 和 `bun x --no-install oxfmt --check`，以及 `bun run build`，均通过。未运行测试，最终退出、首页停留及刷新重新登录的 Casdoor 完整流程尚未实际联调验证。

## 2026-11-06：恢复手动登录与本地退出

OIDC 相关实现恢复至 `137e55e2e923675a133be8fa633c7c654ec5c117` 的功能状态。首页与登录页不再自动发起 OIDC 授权，用户通过登录按钮进入登录中心；退出仅撤销网关本地会话并返回登录页，跨标签页退出同步也返回登录页。

撤回后端通道登出接口、主动请求登录中心登出、登出凭据存储、OIDC 会话关联与失效检查，以及配套身份令牌签名、签发方、受众、随机数和用户信息一致性校验；恢复原有授权码换取访问令牌、读取用户信息并进入共用登录与 MFA 流程。配置页移除两类登出地址与登记说明，前端移除自动登录状态、退出返回标记及相关查询参数处理。保留项目要求的 `common.DecodeJson` 封装。

### 涉及文件

- `controller/auth_session.go` — 恢复本地退出响应，移除单点登出参数与登录中心地址返回。
- `controller/oauth.go` — 登录回调不再向共用登录流程传递 OIDC 会话绑定。
- `controller/user.go` — 登录验证和会话创建恢复原参数，保留其他用户管理改动。
- `controller/oidc_logout.go` — 删除后端通道登出控制器、会话绑定读取与登出响应构造。
- `model/auth_flow.go` — 敏感操作认证恢复原有本地会话校验。
- `model/user_session.go` — 移除 OIDC 嵌入字段、缓存字段、登出凭据写入和关联失效检查，缓存结构版本恢复为 1。
- `model/oidc_logout.go` — 删除 OIDC 登出记录、身份摘要、重复通知处理与失效判定。
- `model/main.go` — 移除 OIDC 登出记录表的自动迁移注册。
- `oauth/oidc.go` — 恢复原有令牌交换和用户信息读取，移除配套身份令牌校验、身份摘要与登出凭据加密。
- `oauth/types.go` — 移除新增的发现地址、随机数与 OIDC 会话绑定字段。
- `oauth/oidc_tokens.go` — 删除配套发现配置、公钥缓存与身份令牌、登出令牌验证实现。
- `oauth/oidc_logout.go` — 删除登录中心登出地址构造及其协议限制处理。
- `router/api-router.go` — 移除 `/api/oauth/oidc/backchannel-logout` 路由。
- `service/auth_session.go` — 恢复原有会话创建、令牌签发和错误映射，移除登出专用刷新凭据验证；保留 LDAP 用户名过滤。
- `service/login_verification.go` — MFA 流程不再保存、传递或校验 OIDC 会话绑定。
- `service/auth_cleanup.go` — 移除 OIDC 登出记录的定期清理。
- `web/src/components/sign-out-dialog.tsx` — 恢复本地退出确认和成功提示，退出后进入登录页。
- `web/src/features/auth/api.ts` — 恢复本地退出接口调用与响应类型。
- `web/src/features/auth/components/oauth-providers.tsx` — 保留手动登录按钮，移除自动登录参数及加载提示。
- `web/src/features/auth/hooks/use-oauth-login.ts` — 移除自动授权副作用，恢复按钮触发的登录流程。
- `web/src/features/auth/lib/oidc-logout.ts` — 删除一次性退出返回标记。
- `web/src/features/auth/sign-in/index.tsx` — 移除自动登录查询参数读取和表单参数传递。
- `web/src/features/auth/sign-in/components/user-auth-form.tsx` — 恢复原有登录方式选择与条款状态处理，保留对外模式和 LDAP 展示逻辑。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 移除后端通道登出、登出后返回地址及说明，保留 LDAP 配置与保存顺序。
- `web/src/hooks/use-status.ts` — 移除为自动登录新增的配置就绪状态。
- `web/src/lib/oauth.ts` — 授权地址恢复原有参数，不再附加 `nonce`。
- `web/src/routes/(auth)/sign-in.tsx` — 移除自动登录开关和退出返回标记消费。
- `web/src/routes/__root.tsx` — 跨标签页退出统一返回登录页。
- `web/src/routes/index.tsx` — 恢复直接展示首页，移除自动登录与退出参数处理。
- `web/src/routes/oauth/$provider.tsx` — 登录回调失败恢复返回登录页，移除关闭自动登录的参数。

### 验证范围

本次代码回退已通过仓库根目录的 `go build ./...`、`git diff --check`，以及 `web/` 下的 `bun x tsgo -b`、`bun run build`；对修改的前端文件执行 `./node_modules/.bin/oxlint.exe -c .oxlintrc.json` 和 `./node_modules/.bin/oxfmt.exe --check`，退出码均为 0。`bun run typecheck` 因本地 Bun 1.3.14 缺少 `check` 命令失败，`bun x tsc -b` 因旧版编译器不支持现有配置失败，改用已安装的 `tsgo` 完成类型检查。未新增、修改或运行测试。

本次仅回退代码，未执行数据库删除或数据回滚。当前环境未发现 MySQL、PostgreSQL 或 Docker，SQLite、MySQL、PostgreSQL 的完整迁移兼容验证受阻，未获得数据库版本及运行结果；真实身份提供方登录和退出流程尚未联调验证。


## 2026-11-06：手动登录下的双向退出联动

网关主动退出 OIDC 登录时，先撤销本地会话，再通过浏览器跳转至发现配置提供的登出端点，携带客户端标识及固定的 `/sign-in` 返回地址。该方式使用 Casdoor 浏览器会话，不持久保存身份令牌；登录中心退出不可用时保留本地退出结果并提示。内部默认退出调用仍只注销网关会话。

Casdoor 向 `/api/oauth/oidc/backchannel-logout` 发送签名退出通知后，网关按会话或用户范围撤销对应 OIDC 会话；刷新页面时，现有会话恢复机制收到认证失败响应并清除登录状态。通知验证签名、签发方、接收方、时间及事件字段，持久化退出记录支持幂等处理，并在登录、MFA、刷新和认证阶段阻止已退出会话恢复。新登录校验身份令牌、随机数及用户信息一致性，保存身份摘要用于关联。

主动跨系统退出始终检查请求来源。开发代理保留浏览器 Host，修复 `localhost:5173` 转发至 `localhost:3000` 后来源不匹配导致的退出 403。配置页复用已有配置指引与复制按钮，展示两类退出地址及七语言说明。

### 涉及文件

- `controller/auth_session.go` — 主动退出前验证会话凭据，撤销成功后返回 Casdoor 登出地址或不可用标记。
- `controller/oidc_logout.go` — 限制表单大小、验证签名退出通知并撤销会话，审计不记录原始令牌。
- `controller/oauth.go`、`controller/user.go` — 将验证后的 OIDC 身份关联传入共用登录流程。
- `middleware/auth_origin.go` — 主动跨系统退出始终执行来源校验。
- `model/auth_flow.go` — 事务内的敏感操作授权检查 OIDC 会话失效状态。
- `model/main.go` — 将退出记录表注册到主数据库迁移，独立日志库不变。
- `model/oidc_logout.go` — 保存身份摘要及退出记录，按用户或会话匹配撤销，处理重复通知并清理过期记录。
- `model/user_session.go` — 扩展会话关联字段与索引，升级缓存结构，在会话创建和读取时检查退出记录。
- `oauth/oidc.go`、`oauth/types.go` — 校验身份令牌与用户信息一致性，传递发现地址、随机数及会话身份摘要。
- `oauth/oidc_logout.go` — 构造使用浏览器会话的登录中心退出地址，支持本机回环 HTTP 开发地址。
- `oauth/oidc_tokens.go` — 读取发现配置及公钥，验证身份令牌与退出令牌，限制算法、请求大小、时间和重定向，并支持密钥轮换。
- `router/api-router.go` — 注册后端退出通知接口，接入限流及禁用缓存中间件。
- `service/auth_session.go` — 传递会话关联、验证退出凭据，签发和刷新时检查失效状态，统一返回认证失败，存储故障保留服务端错误。
- `service/login_verification.go` — MFA 流程保存并传递 OIDC 会话关联，防止退出后完成验证恢复会话。
- `service/auth_cleanup.go` — 定期清理过期退出记录。
- `web/rsbuild.config.ts` — 开发代理关闭 Host 改写，使后端来源校验与浏览器请求一致。
- `web/src/components/sign-out-dialog.tsx`、`web/src/features/auth/api.ts` — 主动 OIDC 退出请求跨系统登出，校验地址后跳转，保留本地退出提示与兜底。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 复用 `OAuthSetupGuide`、`CopyButton` 展示两类退出地址及配置说明。
- `web/src/lib/oauth.ts` — OIDC 授权请求携带当前登录流程的随机数。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补齐双向退出的七语言配置说明。

### 配置与验证范围

需要配置网关 OIDC 发现地址，在 Casdoor 登记网关的 `/sign-in` 返回地址与 `/api/oauth/oidc/backchannel-logout` 后端通知地址。本机直接运行可将通知地址设为 `http://localhost:3000/api/oauth/oidc/backchannel-logout`；线上 Docker 部署使用 Casdoor 容器可访问的网关 HTTPS 地址。更新后需重新通过 OIDC 登录一次，旧会话缺少关联信息。主动退出要求 Casdoor 支持不携带身份令牌、通过浏览器会话退出。

此前本轮实现已通过根目录 `go build ./...`、`git diff --check`，以及 `web/` 下 `bun x tsgo -b`、`bun run build`、`bun run i18n:sync`；对修改的五个 TypeScript/TSX 文件执行 `bun x oxlint -c .oxlintrc.json` 和 `bun x oxfmt --check`，退出码均为 0。未新增、修改或运行测试。本次日志更新仅进行差异与格式检查。

本地 Casdoor 发现配置已声明支持后端退出通知及会话标识，真实登录退出链路尚未完整联调。新增会话关联字段、索引及退出记录表；由于本机未发现 MySQL、PostgreSQL 或 Docker 运行环境，三库新建、升级及重复迁移验证仍受阻，没有可报告的数据库版本和运行结果，未完成数据库兼容验证。

## 2026-11-06：可选静默登录与回调加载优化

系统设置的身份认证 → OAuth 新增默认关闭的「启用 OIDC 静默登录」。配置 OIDC 发现地址并启用后，未登录用户打开或刷新符合条件的页面时，通过隐藏框架请求 `prompt=none` 授权；登录中心已有有效会话、网关账户已关联且无需额外交互时，自动恢复登录，主页面无需跳转登录中心。沿用 `/oauth/oidc` 回调地址，未登录、浏览器阻止嵌入或授权失败时保留手动入口；不通过后台探测自动注册账户，必要的 MFA 仍进入原验证流程。

授权流程使用短期一次性状态、随机数及 S256 PKCE，校验材料保留在父页面内存；回调消息校验来源、窗口及状态，父页面通过受来源校验保护的接口完成登录。每个页面最多探测一次，支持跨标签页互斥及会话变更取消，失效流程返回的新会话会被撤销，避免覆盖后续登录或退出。

分离授权等待与后端完成请求的超时，修复后端交换尚未结束就被整体超时判定为失效、成功会话随即撤销的问题。跨系统退出仅抑制返回后的当次页面，之后在 Casdoor 重新登录并刷新网关可再次探测；仅本地退出继续暂停静默登录，显式登录成功后恢复，并清理旧版永久暂停标记。

隐藏回调在入口直接转交授权结果，不再加载整套 React 应用、路由、样式及站点初始化请求；正常页面按需加载原应用入口。保留身份令牌校验、会话关联与双向退出行为。

### 涉及文件

- `controller/oidc_silent.go` — 新增静默授权地址构造、完成接口与 PKCE、客户端及发现配置匹配校验。
- `controller/oauth.go` — 扩展授权状态请求与载荷，静默流程有效期为两分钟；复用登录回调并禁止静默自动注册。
- `controller/misc.go` — 站点状态返回静默登录实际可用状态。
- `controller/option.go` — 启用静默登录前要求配置发现地址。
- `middleware/auth_origin.go` — 提取严格浏览器来源校验，静默登录完成接口在本地开发环境也执行校验。
- `oauth/oidc.go` — 令牌交换传递 PKCE 校验材料及静默流程随机数，沿用身份令牌校验。
- `router/api-router.go` — 注册 `/api/oauth/oidc/silent`，接入来源检查、限流、禁用缓存与请求体限制。
- `setting/system_setting/oidc.go` — 新增静默登录配置及完整配置可用性判断。
- `web/src/features/system-settings/auth/index.tsx`、`web/src/features/system-settings/auth/section-registry.tsx`、`web/src/features/system-settings/types.ts` — 接入开关默认值、配置传递与类型。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 新增开关及说明，校验发现地址，并在相关配置保存后启用功能。
- `web/src/features/auth/types.ts` — 扩展站点状态类型。
- `web/src/features/auth/lib/oidc-silent-login.ts` — 实现状态读取、授权探测、跨标签页互斥、分阶段超时、会话竞态处理及 MFA 衔接。
- `web/src/features/auth/lib/oidc-silent-transport.ts` — 管理隐藏框架、回调转交、消息校验与资源清理。
- `web/src/features/auth/components/oidc-silent-callback.tsx` — 路由回调复用轻量消息转交逻辑。
- `web/src/main.tsx`、`web/src/bootstrap.tsx` — 拆分轻量入口与原应用初始化，静默回调跳过完整应用加载。
- `web/src/routes/__root.tsx` — 本地会话恢复后发起符合条件的静默探测，隐藏回调跳过常规初始化。
- `web/src/routes/oauth/$provider.tsx` — 区分隐藏 OIDC 回调与普通 OAuth 回调。
- `web/src/routes/(auth)/sign-in.tsx`、`web/src/routes/_authenticated/route.tsx`、`web/src/stores/auth-store.ts` — 识别静默登录产生的待验证状态并进入既有 MFA 页面。
- `web/src/lib/oidc-silent-preference.ts` — 管理本地退出暂停、跨系统退出一次性返回标记与旧标记迁移。
- `web/src/components/sign-out-dialog.tsx`、`web/src/features/auth/api.ts` — 退出时暂停探测，在跳转至验证过的登录中心退出地址前设置返回标记。
- `web/src/lib/auth-session.ts` — 显式登录成功后恢复探测资格，提供认证版本用于排除过期结果。
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐静默登录开关、发现地址校验及浏览器兼容说明。

### 配置与验证范围

网关站点地址应与浏览器实际访问入口一致，并在身份提供方登记该地址下的 `/oauth/oidc` 回调。需要身份提供方支持静默授权及浏览器允许相应 Cookie 与嵌入页面；线上建议使用同一主域名下的 HTTPS 地址。

本轮实现此前通过根目录 `go build ./...`；回调加载优化后，在 `web/` 执行 `bunx --no-install tsgo -b`、`bunx --no-install oxlint -c .oxlintrc.json src/main.tsx src/bootstrap.tsx src/features/auth/lib/oidc-silent-transport.ts src/features/auth/components/oidc-silent-callback.tsx`、对这四个文件执行 `bunx --no-install oxfmt -c .oxfmtrc.json --check`，以及 `bun run build`，均通过，`git diff --check` 通过。未新增、修改或运行测试；生产产物确认隐藏回调仅加载约 38 KB 的入口脚本，尚未进行优化后的浏览器端耗时实测。

## 2026-11-09：用户名过滤

OIDC 设置新增默认关闭的用户名过滤开关与白名单。开启后，以身份提供方返回的 `preferred_username` 精确匹配，忽略大小写及首尾空白；空名单或缺少用户名均拒绝访问，不使用本地用户名、邮箱或显示名称替代。普通登录、静默登录、首次注册与账户绑定共用服务端过滤；首次注册仍受全局注册开关限制。拒绝时返回通用认证失败消息，不暴露名单内容。

提供方用户名保存在服务端待验证流程中，MFA 完成时按当前名单重新校验，覆盖二次验证期间移出名单或启用过滤的情况。已有本地会话不因修改名单自动注销。

名单复用共享多选组件与设置分组，支持回车添加、逗号或换行批量粘贴、小写归一化、去重及逐项删除，超过八项折叠；关闭过滤时仍可预先编辑名单。保存时先写名单、再启用过滤，并补齐七种语言的配置说明与失败提示。

### 涉及文件

- `setting/system_setting/oidc.go` — 新增过滤开关、换行分隔的白名单与服务端用户名匹配逻辑，默认关闭。
- `oauth/oidc.go` — 在身份令牌与用户信息校验后执行用户名过滤，记录拒绝原因并返回通用认证失败消息。
- `controller/oauth.go` — 将提供方用户名传入共用登录流程，兼容普通与静默登录。
- `controller/user.go` — OIDC 登录接入携带提供方用户名的二次验证入口，其他登录方式保留原有调用。
- `service/login_verification.go` — 在服务端待验证流程中保存提供方用户名，开始和完成 OIDC 二次验证时校验名单，避免本地用户名差异与待验证期间的配置变化绕过过滤。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 新增过滤开关、白名单与匹配说明；复用共享多选组件和设置分组，OIDC 与 LDAP 共用名单归一化逻辑，并保证名单先于过滤开关启用保存。
- `web/src/features/system-settings/auth/index.tsx`、`web/src/features/system-settings/auth/section-registry.tsx`、`web/src/features/system-settings/types.ts` — 补齐配置默认值、回显传递与类型。
- `web/src/i18n/static-keys.ts` — 登记服务端 OIDC 认证失败消息的静态翻译键。
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐用户名白名单、开关说明、匹配规则与认证失败提示。

### 验证记录

本轮功能实现已通过根目录 `go build ./...`、`git diff --check`，以及 `web/` 下的 `bunx --no-install tsgo -b`、`bun run build`、`bun run i18n:sync`；七种语言缺失键均为零。对本轮修改的五个 TypeScript/TSX 文件执行 `bunx oxlint -c .oxlintrc.json`，对这些文件及七个语言文件执行 `bunx oxfmt --check`，均通过。本机 Bun 1.3.14 不支持项目的 `bun check -b`，因此使用已安装的类型检查器。未新增、修改或运行测试；本次日志更新仅检查文档差异与空白格式。
