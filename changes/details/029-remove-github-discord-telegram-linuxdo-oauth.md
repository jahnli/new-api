# OAuth 与 OIDC 登录、退出、敏感操作验证及注册资料

**日期**: 2026-11-25

## 登录与退出

- 移除 GitHub、Discord、Telegram、LinuxDO 的内置登录、绑定、配置及相关用户字段，保留 OIDC、微信及独立配置的自定义提供商。
- OIDC 手动登录校验身份令牌签名、签发方、受众、随机数及用户信息一致性，保存会话身份摘要；MFA、会话签发、刷新和敏感操作均检查关联退出状态。
- 主动跨系统退出先撤销网关会话，再使用 Casdoor 浏览器会话跳转发现配置的退出端点，不持久保存原始身份令牌；不可用时保留本地退出结果并提示。内部普通退出调用仍只撤销网关会话。
- `/api/oauth/oidc/backchannel-logout` 验证签名退出通知，按会话或用户撤销关联登录，持久化记录支持重复通知和过期清理。主动跨系统退出始终校验来源；开发代理保留浏览器 Host。
- 登出端点原则上要求 HTTPS，本机回环地址允许 HTTP；拒绝含用户凭据或片段的地址。返回地址固定为已配置站点的 `/sign-in`。

## 敏感操作身份验证

- 禁用用户等使用统一身份验证的敏感操作，已有 2FA／Passkey 时仍使用对应方式；两者均未配置、同时有密码与已绑定且启用的内置 OIDC 时，服务端仅提供 OIDC 验证，不受本次登录方式影响。
- OIDC 未绑定或被关闭时保留密码验证；密码登录被关闭时不可使用密码。OIDC 验证失败不自动切换为密码，已有 2FA／Passkey 不可用时也不降级。
- OIDC 验证必须使用浏览器登录会话，个人访问令牌不可完成该验证；回调校验当前绑定账号，验证凭证仍绑定操作者、会话、具体操作及目标，有效期一分钟且仅可使用一次。

## 可选静默登录

- `oidc.silent_login` 默认关闭；开启后通过隐藏框架以 `prompt=none` 探测，复用 `/oauth/oidc` 回调，不自动注册。已有身份关联且无需交互时恢复登录，必要 MFA 仍进入原流程；失败、嵌入受阻或无身份会话时保留手动入口。
- 使用两分钟有效的一次性状态、随机数与 S256 PKCE；回调核对来源、窗口及状态，父页面经来源保护接口完成登录。校验材料保存在内存，分开处理授权等待和完成请求超时。
- 每页最多探测一次，跨标签页互斥，会话变化时取消过期结果；不能以迟到结果覆盖后续登录或退出。
- 本地主动退出暂停探测；跨系统退出仅抑制返回当页，之后刷新可重试。手动授权重置会话不写退出偏好，授权地址就绪后恢复资格；`semi:` 存储标记兼容并清理旧版 `new-api:` 标记。
- 隐藏回调使用轻量入口，不加载完整应用；普通登录、绑定与验证回调不显示中间提示页，保留授权处理、结果提示、窗口通信和跳转。等待期间可能暂时空白。

## 首次注册资料与套餐

- 仅新建 OIDC 用户时从已验证 Casdoor 身份令牌映射公司、头像、手机、性别、生日、简介、部门结构、工号、职务、职级、入职日期、职位描述及民族，校验类型、长度、日期和部门结构。
- 头像优先用户信息接口的 `picture`，缺失时使用令牌 `avatar`；`properties.open_id` 写飞书身份，`properties.user_id` 写钉钉身份。未提供的负责人、背景图和籍贯不补造。
- 工作单位按独立公司规则匹配显示名称及套餐，绑定来源为 `oidc_register_auto`。未配置时不分配，失败保留账号并记录日志；后续登录、绑定、验证和静默探测不更新员工资料或追加订阅。
- 公司规则与平台身份升级约束见 [公司注册规则与平台身份](024-ldap-login.md)。

## 配置与实现入口

- 网关站点地址须与浏览器入口一致；身份提供方登记 `/oauth/oidc`、`/sign-in` 及可达的后端退出通知地址。静默登录需要发现配置、提供方支持及浏览器 Cookie／嵌入条件；旧会话需重新登录以建立 OIDC 关联。
- `oauth/oidc.go`、`oauth/oidc_tokens.go`、`oauth/oidc_logout.go` — 协议校验与登出地址。
- `controller/oidc_logout.go`、`controller/oidc_silent.go`、`controller/oauth.go`、`service/oidc_profile.go` — 退出、静默授权及首次注册。
- `model/oidc_logout.go`、`model/user_session.go`、`service/auth_session.go`、`service/login_verification.go` — 会话关联与 MFA。
- `service/security_verification.go`、`service/oauth_verification.go`、`service/auth_token.go` — 敏感操作验证方式选择、OIDC 绑定校验及一次性凭证。
- `web/src/features/auth/lib/oidc-silent-login.ts`、`web/src/lib/oidc-silent-preference.ts`、`web/src/components/sign-out-dialog.tsx` — 浏览器探测与退出偏好。
- `web/src/features/system-settings/auth/oauth-section.tsx` — 配置、地址复制及说明。

敏感操作验证优先级变更已执行 `go build ./...` 和 `git diff --check`，均通过；按项目要求未新增、修改或运行测试。构建与静态检查通过不代表真实身份提供方联调或三库迁移已验证，相关完整运行矩阵仍无已完成依据。
