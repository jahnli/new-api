# AGENTS.md — 项目规范

DO NOT send optional commentary

## 概述

这是一个基于 Go 构建的 AI API 网关/代理。它将 40 多个上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等）聚合在统一的 API 之后，并提供用户管理、计费、速率限制和管理后台。

## 技术栈

- **后端**: Go 1.25.1（以各模块 `go.mod` 为准）、Gin Web 框架、GORM v2 ORM
- **前端**: React 19、TypeScript、Rsbuild 2、TanStack Router/Query/Table、Zustand、Base UI、Tailwind CSS 4
- **数据库**: 主库 SQLite、MySQL、PostgreSQL（三者必须同时支持）；独立配置的日志库还支持 ClickHouse
- **缓存**: Redis (go-redis) + 内存缓存
- **认证**: 浏览器会话、API Token 与个人访问令牌、JWT、WebAuthn/Passkeys、TOTP、OAuth/OIDC（当前保留 OIDC、微信）；`service/authz/` 中的 Casbin 授权
- **扩展**: 由 Sobek 执行的 JavaScript 任务插件；Electron 桌面壳
- **前端包管理器**: Bun（优先于 npm/yarn/pnpm）

## 架构

分层架构: Router -> Controller -> Service -> Model

```
router/        — HTTP 路由（API、relay、dashboard、web）
controller/    — 请求处理器
service/       — 业务逻辑
model/         — 数据模型与数据库访问（GORM）
relay/         — AI API 中继/代理及提供商适配器
  relay/channel/ — 各提供商适配器（openai/、claude/、gemini/、aws/ 等）
middleware/    — 认证、速率限制、CORS、日志、分发
setting/       — 配置管理（ratio、model、operation、system、performance）
common/        — 共享工具（JSON、加密、Redis、环境变量、速率限制等）
dto/           — 数据传输对象（请求/响应结构体）
constant/      — 常量（API 类型、渠道类型、上下文键）
types/         — 类型定义（relay 格式、文件来源、错误）
i18n/          — 后端国际化（go-i18n，en/zh）
oauth/         — OAuth 提供商实现
pkg/           — 内部包（cachex、ionet）
web/           — 前端（React 19、Rsbuild、Base UI、Tailwind）
  src/i18n/    — 前端国际化（i18next，en/zh/zh-TW/fr/ru/ja/vi）
```

- Go 网关在 `router/`、`middleware/`、`controller/`、`service/`、`model/`、`relay/` 中承担管理 API、上游中继、计费与后台任务。
- `relaykit/` 是独立的 Go 模块，只承载协议 DTO 与协议转换；传输、认证、数据库访问与计费逻辑保留在宿主模块中。
- JavaScript 任务插件位于 `plugins/tasks/`，经 `pkg/jsplugin/` 执行，并与宿主任务轮询与结算集成。
- `web/` 是 React 前端（详见 `web/AGENTS.md`）；`electron/` 是桌面壳。

## 国际化 (i18n)

### 后端 (`i18n/`)

- 库: `nicksnyder/go-i18n/v2`
- 语言: en、zh

### 前端 (`web/src/i18n/`)

- 库: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- 语言: en（基础）、zh（兜底）、zh-TW、fr、ru、ja、vi
- 翻译文件: `web/src/i18n/locales/{lang}.json` — 扁平 JSON，键为英文原文
- 用法: `useTranslation()` hook，在组件中调用 `t('English key')`
- CLI 工具: `bun run i18n:sync`（在 `web/` 目录下执行）

## 规则

### 通用代码质量

- 新代码应保持直接和可读。优先使用提前返回、清晰的分支和命名良好的局部变量，而非深层嵌套或多层控制流。
- 尽量减少嵌套函数定义。仅在回调 API 要求或保持闭包局部性明显比添加额外符号更简洁时才使用。
- 避免添加只有一个调用方且不表达稳定业务概念的包级或模块级辅助函数。将逻辑内联到调用处。
- 当函数代表可复用行为、必需的接口/框架回调、导出的 API、复杂业务逻辑时，才适合提取为独立函数。
- 如果保留了单次使用的辅助函数，其名称必须描述持久的领域概念，而非仅为缩短调用方而提取的机械步骤。
- 修改代码时不得新增、修改或运行测试；只执行适用的类型检查、lint、格式检查、编译或构建等非测试验证。即使现有测试与改动直接相关，也不得运行，除非用户在当前任务中明确要求。

### 认证安全（强制遵循 OWASP）

- 实现、修改或审查认证相关流程时，必须遵循最新稳定版 OWASP Application Security Verification Standard（ASVS，https://owasp.org/www-project-application-security-verification-standard/）及 OWASP Cheat Sheet Series（https://cheatsheetseries.owasp.org/）中的适用要求。范围包括前后端的注册、登录/退出、密码修改与找回、邮箱验证、MFA、WebAuthn/Passkeys、OAuth/OIDC、账户绑定/解绑、会话、JWT、API 凭据及敏感操作的重新认证。
- 修改上述流程前，先阅读 Authentication Cheat Sheet（https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html）和 Session Management Cheat Sheet（https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html），涉及相应机制时继续查阅密码存储、密码找回、MFA、OAuth 和 CSRF 指引。实施前明确适用控制要求；现有代码不能成为保留或引入不安全模式的理由。
- 安全控制必须在服务端执行。落实凭据存储与传输、防账户枚举与暴力破解、CSRF 与重放防护、令牌/挑战的过期及必要时的一次性使用、协议验证、会话轮换与失效、敏感账户变更重新认证等适用要求。前端检查不能替代服务端执行，恢复或替代登录路径不得绕过必要的认证强度。
- 认证审计不得记录密码、验证码、恢复码、私钥或可用的会话/认证令牌。应保留足够的非秘密上下文，以调查认证失败和敏感账户变更。


### 后端规则

**现代 Go 约定：** 对新增或修改的 Go 代码（包括测试与 `relaykit/`）适用以下约定，前提是不改变行为并能提升可读性。以相关模块 `go.mod` 中声明的 Go 版本作为兼容基线。

- 使用 `any` 替代 `interface{}`，包括 map 值、slice 元素、参数与返回值。
- 定次数循环优先使用 `for i := range n`，索引未使用时用 `for range n`；按下标遍历 slice 优先 `for i := range items`。若循环边界在迭代中变化，或需要不同的起始值/步长，则保留常规写法。
- 当切分结果只被遍历一次、既不按下标访问也不复用，优先使用 `strings.SplitSeq` / `bytes.SplitSeq`，而不是用 `Split` 分配 slice。
- 在第一个分隔符处切分使用 `strings.Cut`；判断并去除前后缀使用 `strings.CutPrefix` / `strings.CutSuffix`。避免为同一操作分别做查找与手工切片。
- 成员判断使用 `slices.Contains` / `slices.ContainsFunc`，有序可比较类型的自然排序使用 `slices.Sort`，不要写等价的手工循环或 sort 回调。
- map 浅拷贝与合并使用 `maps.Copy`。按需初始化目标 map，并保持 nil 与空 map 的区别，以及后写入值覆盖先写入值的顺序；它不替代深拷贝。
- 简单边界使用内置 `min` / `max`，不要写等价的 if 赋值。保持数值语义：它们不会防止参数溢出，也不替代计费校验与安全配额转换。
- 循环内重复字符串拼接使用 `strings.Builder`；简单固定表达式仍直接拼接。
- 类型在编译期已知时使用 `reflect.TypeFor[T]()`，并使用 `reflect.Pointer` 替代 `reflect.Ptr`；需要值的动态类型时保留 `reflect.TypeOf`。
- 适用于 `Add(1)` / goroutine / `defer Done()` 模式且生命周期与 panic 契约成立时，优先使用 `sync.WaitGroup.Go`；保留既有 recover 行为，传给 `Go` 的函数不得 panic。
- 仅为 Go 1.22 之前闭包捕获而存在的循环变量副本（如 `tc := tc`）应删除；确需快照语义或在循环外被赋值的变量保留副本。
- 只有在确认当前 JSON 编码器输出不变的前提下，才移除非指针结构体字段上无效的 `omitempty` 标签。不得在样式清理中改变字段类型或省略行为；可选的中继标量字段仍须遵守下文的指针规则。
- 完成上述改动后，对修改过的 Go 文件执行 `gofmt` 并移除未使用的 import。

**RelayKit 模块独立性：** `relaykit/` Go 模块必须始终能够独立构建。

- `relaykit/` 下的代码不得导入或依赖根 `new-api` 模块中的包，也不得依赖仅存在于根模块的配置、生成文件或 workspace 连接。
- 任何影响 `relaykit/` 或其公共 API 的变更，都必须执行 `cd relaykit && GOWORK=off go build ./...` 验证；仅根模块构建成功并不足够。

**JSON 包：** 所有 JSON 序列化/反序列化操作必须使用 `common/json.go` 中的封装函数：

- `common.Marshal(v any) ([]byte, error)`
- `common.Unmarshal(data []byte, v any) error`
- `common.UnmarshalJsonStr(data string, v any) error`
- `common.DecodeJson(reader io.Reader, v any) error`
- `common.GetJsonType(data json.RawMessage) string`

禁止在业务代码中直接导入或调用 `encoding/json`。`json.RawMessage`、`json.Number` 等 `encoding/json` 中的类型定义仍可作为类型引用，但实际的序列化/反序列化调用必须通过 `common.*` 进行。

在 `relaykit/` 内，请使用 `relaykit/relayconvert/kitutil/json.go` 提供的 `kitutil.*`，绝不使用宿主模块的 `common`；直接调用编码器只允许出现在 codec 实现内部。

**数据库兼容性：** 所有数据库代码必须同时兼容 SQLite、MySQL >= 5.7.8 和 PostgreSQL >= 9.6。

- 任何可能影响数据库行为的改动，在工作完成前都必须经过验证。这包括 ORM/数据库驱动依赖变更、连接/DSN/协议或预处理语句配置、模型与 GORM 标签、迁移与 `AutoMigrate`、约束与索引、`Scanner`/`Valuer`/序列化器行为、裸 SQL、事务和行锁。
- 将 GORM 核心包及其数据库方言/驱动包视为一组兼容版本。修改其中任一包时，都必须核实上游兼容性并执行完整三库验证矩阵；不得只升级核心包并假定现有驱动仍然兼容。
- 模式或迁移改动必须同时在全新数据库和由最新发布版本创建的代表性数据库升级路径上验证。启动/迁移至少执行两次以证明幂等性，并确认现有数据、索引、约束和唯一性保证均被保留。若受影响路径由独立配置的日志数据库共用或使用，还必须覆盖日志数据库。
- 在最终交付说明或拉取请求中记录准确的数据库版本、命令和结果。若任何必需的数据库验证无法执行，必须明确报告阻塞，且不得宣称该改动已完成数据库兼容验证。
- 优先使用 GORM 方法（`Create`、`Find`、`Where`、`Updates` 等），避免裸 SQL。
- 让 GORM 处理主键生成；不要直接使用 `AUTO_INCREMENT` 或 `SERIAL`。
- 在 `model/` 中使用 GORM 查询方法实现标准 `SELECT ... FOR UPDATE` 行锁时，必须调用 `lockForUpdate(tx)`。禁止使用旧版 GORM v1 写法 `tx.Set("gorm:query_option", "FOR UPDATE")`，因为 GORM v2 会静默忽略该设置，实际不会获取锁。不要在调用处重复使用 `clause.Locking{Strength: "UPDATE"}`；共享辅助函数会为 MySQL/PostgreSQL 生成 `FOR UPDATE`，并为不支持该语法的 SQLite 跳过锁定。语义不同的方言专用锁（例如 MySQL next-key/gap lock）只有在针对数据库类型设置明确分支且为每种受支持数据库提供有效兜底时，才可使用裸 SQL。
- 当裸 SQL 不可避免时，需考虑方言差异：
  - PostgreSQL 使用 `"column"` 引用，MySQL/SQLite 使用 `` `column` ``。
  - 对 `group` 和 `key` 等保留字列，使用 `model/main.go` 中的 `commonGroupCol`、`commonKeyCol`。
  - 布尔值使用 `commonTrueVal`/`commonFalseVal`。
  - 使用 `common.UsingMainDatabase(...)` 判断主数据库类型，`common.UsingLogDatabase(...)` 判断日志数据库类型。
- 禁止在没有跨数据库兜底的情况下使用数据库特有功能，包括 MySQL 专有函数、PostgreSQL 专有操作符、SQLite 不支持的 `ALTER COLUMN`、以及没有 `TEXT` 兜底的数据库特有 JSON 列类型。
- 迁移必须在三种数据库上都能运行。对于 SQLite，使用 `ALTER TABLE ... ADD COLUMN` 而非 `ALTER COLUMN`（参见 `model/main.go` 中的模式）。
- 当默认值是由代码强制的业务规则时，避免使用 `gorm:"default:true"` 等 GORM 布尔默认标签。MySQL 和 PostgreSQL 对布尔默认值的归一化方式不同，可能导致 GORM `AutoMigrate` 在每次启动时重复执行 `ALTER TABLE`。应在请求/模型归一化、钩子、构造函数或服务逻辑中设置这些默认值；不要将 `default:true` 替换为 `default:1`，除非已在 SQLite、MySQL 和 PostgreSQL 上验证过行为。

**中继和提供商行为：**

- 实现新渠道时，确认提供商是否支持 `StreamOptions`；如果支持，将该渠道添加到 `streamSupportedChannels`。
- 对于从客户端 JSON 解析后再重新序列化到上游提供商的请求结构体，可选标量字段必须使用指针类型配合 `omitempty`（例如 `*int`、`*uint`、`*float64`、`*bool`）。
- 在上游中继请求 DTO 中保留显式零值：客户端 JSON 中不存在的字段必须变为 `nil` 并在序列化时省略，而显式设为 `0`、`0.0` 或 `false` 的值必须保持非 `nil` 并发送到上游。
- 避免对可选请求参数使用非指针标量配合 `omitempty`，因为零值会在序列化时被静默丢弃。

**JavaScript 任务插件（强制）：**

- 在实现、修改或审查 JavaScript 任务插件或其宿主 API/运行时之前，必须先阅读 [Task Plugin API v1](docs/plugin-api/v1.md)，包括其中的描述撰写与翻译约定。变更插件契约时，还要同步检查 `docs/plugin-api/v1.schema.json` 与 `docs/plugin-api/v1.d.ts` 保持一致。
- `usageSchema` 与 `usageProfiles[].schema` 中的数值计费字段，其 `description` 必须写明**计费对象 + 单价**，因为它会作为 UI 上价格输入项的标签。例如 `image_count` 使用 `Image generation unit price` / `图片生成单价`，而不是 `Generated image count` / `生成图片张数`；`seconds` 使用 `Video generation unit price` / `视频生成单价`。字段值仍是使用量，不是价格。
- 单位写入 `unit`。协议限制、用量来源、默认值、估算与结算细节放在代码注释或技术文档中。描述必须简短、各语言间等价、不含具体价格数字、结尾不带标点。动作、布尔与其他枚举条件的措辞遵循 API 文档的单独规则。
- 完成插件工作前显式复核元数据措辞。上述属于撰写要求：编译通过、schema 校验通过或测试通过都不能证明描述符合要求。

**计费表达式系统：** 处理分级/动态计费（基于表达式的定价）时，必须先阅读 `pkg/billingexpr/expr.md`。该文档描述了设计理念、表达式语言、完整架构、token 归一化规则、配额转换和表达式版本控制。所有计费表达式的代码变更必须遵循该文档。

**内置模型定价：** 新增内置模型价格必须在 `setting/billing_setting/builtin_billing.go` 中定义为自包含的计费表达式，使用真实的美元/百万 Token 价格。不得向旧模型、补全或缓存倍率表新增内置价格。保留管理员显式设置的价格覆盖。仅在明确要求时迁移已有旧价格。核实公开价格，并覆盖适用的上下文长度阈值和缓存类别。

**计费安全不变量：** 配额/计费代码绝不能因为算术溢出或未校验输入产生负扣费（即返还额度）。必须进行纵深防御：

- 所有会成为计费乘数的用户可控数量（图片 `n`、视频 `seconds`/`duration`、分辨率/质量倍率、批次数量）在进入配额计算前都必须有边界限制。越界输入应在请求校验阶段以 400 拒绝。现有边界包括：图片生成数量使用 `dto.MaxImageN`，任务视频时长使用 `relaycommon.MaxTaskDurationSeconds`，所有中继格式（OpenAI、Claude、Gemini、Responses）的 `max_tokens` 系列字段使用 `relay/helper/valid_request.go` 中的 `maxTokensLimit`。复用这些常量，不要为同一概念引入临时限制。新增中继格式或请求 DTO 时，必须从一开始就在校验器中限制 max-tokens 和 count 字段。
- 注意校验绕过路径：透传字段（例如 `Extra["parameters"]`）、任务 `metadata` map、multipart 表单字段都可能绕过标准 DTO 校验携带相同数量。任何从这些路径读取乘数的适配器都必须在本地执行相同边界限制（或钳制）。
- 从媒体元数据解析出的时长同样是用户/上游可控的：音频文件头（转写 token 计数、TTS 响应时长）和上游扣费数字（例如 Kling `FinalUnitDeduction`）都可能声明荒谬数值。它们成为 token 数前必须使用饱和转换。
- 不要用裸类型转换把计算出的配额或 token 数转换为 `int`，例如 `int(float64(quota) * ratio)`、对无界输入执行 `int(math.Round(...))` 或 `int(decimal.IntPart())`。所有配额舍入/转换都集中在 `common/quota_math.go`：浮点乘积截断使用 `common.QuotaFromFloat`，需要四舍五入时使用 `common.QuotaRound`（半远离零），decimal 乘积使用 `common.QuotaFromDecimal`。`billingexpr.QuotaRound` 会委托给 `common.QuotaRound`。不要重新引入局部转换 helper 或裸转换。单请求饱和边界为 int32，以避免批量累加接近 64 位溢出；钱包/充值金额转换使用 `common.WalletQuotaFromDecimalStrict` 和 JavaScript 安全的 `common.MaxWalletQuota` 边界；每次钳制或 NaN 兜底都会通过 `common.SysError` 记录，因为单个请求不应接近这些边界。
- 饱和事件也会审计：每个 helper 都有 `*Checked` 变体（`common.QuotaFromFloatChecked` / `QuotaRoundChecked` / `QuotaFromDecimalChecked`），发生钳制时会额外返回 `*common.QuotaClamp`。计算费用的计费路径需要把该 clamp 保存到 `relayInfo.QuotaClamp`（或传入任务结算），并在写入 consume/task 日志前调用 `service/log_info_generate.go` 中的 `attachQuotaSaturation`，将标记嵌入日志 `other.admin_info.quota_saturation`，同时输出带请求关联信息的 `logger.LogWarn`。嵌入 `admin_info` 会自然限制为仅管理员可见（非管理员日志视图会剥离 `admin_info`）。新增计费路径时，使用 `*Checked` 变体并以相同方式暴露 clamp，确保异常在管理端日志 UI 和后端日志中都可审计。
- 乘数 map 必须通过 `types.PriceData.AddOtherRatio` 写入，该方法会拒绝非正数、NaN 和 +Inf 倍率。不要直接写 `PriceData.OtherRatios`，也不要削弱这些保护。
- 预扣费和结算/差额都必须安全：饱和后的超大配额必须在预扣费阶段以余额不足失败，绝不能静默环绕。新增计费路径（新中继格式、新任务平台、新调整钩子）时，必须追踪完整链路：校验 → EstimateBilling/OtherRatios → 配额转换 → 预扣费 → 结算/退款，并确认每一步都保持这些不变量。
- 解析为无符号类型（`*uint`）的字段可以接受极大的正 JSON 数字（例如 `18446744073686646784`，可能来自负数环绕）；`>= 0` 检查不够，必须设置上界。


**文档文件：** 除非用户明确要求，否则不得在 `docs/` 及其子目录中新增文件。

此外，不得在本仓库的插件目录（包括 `plugins/tasks/<plugin>/` 及其子目录）创建或生成任何文档文件，例如 README、变更日志、使用指南等任何格式的文档。

### 前端规则

- **优先复用现有 UI 组件（强制）：** 实现或修改前端 UI 前，先阅读 `web/AGENTS.md` 和项目 `shadcn-ui` 技能，搜索 `web/src/components/` 及相关功能目录，阅读匹配组件的实现与调用处。检查仓库现有实现前，不得直接从自定义标记或安装组件库组件开始。
- 现有共享业务组件能够满足需求时，优先于底层 UI 原语使用。在引入替代实现前，评估已有属性、组合方式和兼容扩展。若共享组件（例如 `CopyButton` 或 `ConfirmDialog`）已提供同等行为，仅导入 `Button` 或 `AlertDialog` 不算满足复用要求。
- 新增常见 UI 行为实现必须基于明确的能力缺口：在变更说明或 PR 中列出已有候选组件，并解释为何复用、组合或兼容扩展不适用。文本、尺寸、颜色或功能位置不同不能单独成为重复实现的理由。功能组件可以组合共享组件、业务数据与操作。遵循 `web/AGENTS.md` 的复用流程和组件入口；通用库或组件注册表指引不能覆盖项目的复用优先级。
- 使用 `bun` 作为前端（`web/`）的首选包管理器和脚本运行器：
  - `bun install` 安装依赖
  - `bun run dev` 启动开发服务器
  - `bun run build` 生产构建
  - `bun run i18n:*` 国际化工具
- 前端 UI 文本必须使用 `i18next`/`react-i18next` 支持国际化。使用 `web/src/i18n/locales/{lang}.json` 中的扁平 JSON 区域文件，以英文原文为键。
- 在 React 组件中使用 `useTranslation()` 并调用 `t('English key')` 处理用户可见文本。
- 详细前端约定（TypeScript、组件结构、样式、可访问性与构建检查）以 `web/AGENTS.md` 为准。

### 拉取请求

- 创建拉取请求前，先比较当前 Git 用户（`git config user.name` / `git config user.email`）与仓库历史核心开发者（例如 `git log` 中反复出现的主要作者）；不得修改 Git 配置。
- 如果当前 Git 用户不是历史核心开发者之一，必须在 PR 正文中明确说明代码由 AI 生成或由 AI 辅助。
- 为项目所有者创建拉取请求时，中文请求使用普通模板 `.github/PULL_REQUEST_TEMPLATE.md`，英文请求使用 `.github/PULL_REQUEST_TEMPLATE/en.md`。除非项目所有者明确要求，否则不得使用 `.agents/github/PR.md`。
- 对于其他由 Agent 创建的拉取请求，必须以 `.agents/github/PR.md` 作为完整正文；除非项目所有者明确要求，否则不得使用普通 PR 模板。
