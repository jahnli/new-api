# 使用日志增强：用户信息、请求内容与审计

**日期**: 2026-09-09 ~ 09-24（最后更新 09-24）

## 涉及文件

- `model/log.go` — 日志只读字段增加 DisplayName/AvatarUrl/OpenId，批量补充用户资料；模型名称筛选取首尾空格后包含匹配，复用跨 SQLite、MySQL、PostgreSQL、ClickHouse 的 LIKE 转义。
- `model/clickhouse_log_test.go` — 覆盖 ClickHouse 模型名称匹配和通配符转义。
- `model/task.go`、`model/user.go`、`model/user_cache.go`、`controller/task.go`、`dto/task.go`、`relay/relay_task.go` — 任务日志透传 open_id，复用用户基础缓存填充资料。
- `web/default/src/lib/utils.ts`、`web/default/src/features/home/components/sections/cta.tsx` — 统一构造飞书 openId 聊天链接。
- `web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 用户列展示头像、显示名、资料卡与飞书跳转；调整列顺序/宽度、IP、User-Agent、详情固定列和错误色；费用提示保留订阅来源，请求内容与倍率按权限显示。
- `web/src/features/usage-logs/` — 工具调用费用显示与测试、固定详情列、每页 10 条、请求内容批量查询及违规通知。
- `model/request_message.go`、`controller/request_message.go`、`service/request_message.go` — 新增请求内容模型、批量查询和违规通知；异步记录文本、多模态、生图/编辑 Prompt 及模型参数，支持截断与序列化。
- `controller/relay.go`、`router/api-router.go`、`model/option.go`、`model/main.go`、`common/constants.go` — 中继接入请求记录，注册模型、开关及仅超级管理员可访问的批量/通知路由。
- `web/default/src/features/usage-logs/components/dialogs/request-content-dialog.tsx`、`request-messages-provider.tsx`、`api.ts`、`types.ts` — 请求内容弹框与按页批量加载；内容/参数各自独立滚动，展示用户资料、User-Agent，支持复制和违规通知；非超级管理员不发起查询。
- `controller/security_audit.go`、`service/feishu_department.go`、`service/violation_notice_test.go` — 非工作时间违规通知按用户、实际时间范围和请求次数校验后发送飞书安全审计卡片。
- `web/src/features/security-audit/` — 从审计日志打开通知入口，补充请求上下文、发送中禁用和成功/失败提示。
- `web/default/src/features/system-settings/security/`、`web/src/features/system-settings/security/` — 请求内容开关迁至安全审计，优化审计设置响应式布局及七语言文案。
- `relay/common/relay_info.go`、`relay/common/client_app.go`、`service/log_info_generate.go` — 保存并写入原始 User-Agent，不做客户端名称映射。
- `web/default/src/features/usage-logs/` — 普通日志筛选改为紧凑两排布局，移除令牌名称条件，角色可输入名称；修复管理员“仅自己”范围的用户资料显示。
- `web/src/features/usage-logs/components/log-cost-display.tsx` — 工具调用附加费组件接入后恢复订阅抵扣费用金额直接展示；悬停或键盘聚焦金额时提示订阅扣款来源，保留工具附加费标记
- `web/src/features/usage-logs/components/__tests__/cost-display.test.tsx` — 补充订阅抵扣金额可见、订阅来源 Tooltip 和工具附加费标记共存的测试
- `web/default/src/features/usage-logs/components/columns/task-logs-columns.tsx` — 任务日志用户列头像点击改为经 open_id 跳转飞书，不再打开用户信息弹框
- `web/default/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 桌面端宽度调整为屏幕宽度 50%
- `web/default/src/features/usage-logs/components/usage-logs-mobile-card.tsx` — 移动端卡片在令牌前展示 IP 地址字段
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 自定义行渲染合并固定列样式，详情列表头和内容单元格固定右侧；默认分页统一为每页 10 条
- `web/default/src/features/usage-logs/components/logs-filter-toolbar.tsx` — 高级筛选默认展开，不再默认折叠
- `web/default/src/features/usage-logs/index.tsx` — 普通日志页不再渲染冗余页标题，任务日志保留标题与子分类切换
- `web/default/src/features/usage-logs/section-registry.tsx` — 导航标题统一为 Usage Logs
- `web/default/src/components/layout/components/section-page-layout.tsx` — 无标题、操作区和面包屑时跳过顶部 header 容器，避免空元素占位
- `web/default/src/features/usage-logs/data/schema.ts` — Zod schema 新增 display_name、avatar_url、open_id、gender 字段
- `web/default/src/features/usage-logs/types.ts` — UserInfo 扩展完整用户详情字段并补充 open_id，TaskLog 补充 open_id
- `web/default/src/i18n/locales/en.json` — 新增 "Timing / First Token"、"Request Content"、"Record request content" 等翻译
- `web/default/src/i18n/locales/zh.json` — 新增 "耗时 / 首字"、"请求内容"、"记录请求内容" 等翻译
- `model/request_message.go` — 新增 RequestMessage 模型（request_id 关联 logs 表），存储用户提示词和模型参数
- `controller/request_message.go` — 管理员和普通用户批量查询 request_message 接口；新增 POST body 批量解析，避免分页 100 时 request_ids 拼入 URL 导致线上网关 502；新增违规通知接口，校验 open_id 后发送飞书安全审计提醒
- `service/request_message.go` — 中继请求后异步记录用户输入：多模态内容提取为占位符、截断超长对话、序列化参数；支持从生图与图片编辑请求提取 Prompt，使用日志可展示图片请求内容
- `service/request_message_test.go` — 补充生图 Prompt 记录、首尾空白清理和空提示词跳过的测试
- `service/feishu_department.go` — 新增飞书交互卡片发送与违规通知卡片构造；单请求卡片展示请求时间、模型与 Request ID，非工作时间卡片展示当天实际请求时间范围与请求次数，提示正常业务可忽略、异常操作需查账号及密钥
- `service/violation_notice_test.go` — 覆盖单请求与非工作时间两类违规通知卡片的红色模板、正文和关键字段
- `controller/relay.go` — 中继入口调用 RecordRequestMessage 记录请求内容
- `router/api-router.go` — 新增 /api/request_message 和 /api/request_message/self 路由；管理端批量查询改为 RootAuth，仅超级管理员可读任意用户请求内容；补充 /batch 与 /self/batch POST 路由承载批量 request_ids；新增 /notify-violation 及仅超级管理员可调用的 /api/security_audit/off_hours/notify-violation 非工作时间通知路由
- `common/constants.go` — 新增 RecordRequestMessageEnabled 全局开关
- `model/option.go` — 系统选项注册和运行时更新 RecordRequestMessageEnabled
- `model/main.go` — AutoMigrate 注册 RequestMessage 模型
- `web/default/src/features/usage-logs/components/dialogs/request-content-dialog.tsx` — 请求内容详情弹窗展示完整用户消息列表和请求参数；顶部新增头像、显示名和用户名，模型/格式/时间/请求 ID 与 User-Agent 排在用户信息右侧，请求 ID 放大并去掉两行多余间距；内容与参数左右并排，参数默认展开并缩窄，弹框统一为视口 85% 高度并修复高度计算；新增违规通知按钮和确认弹框，发送后 toast 提示结果；两区域独立滚动，保留 JSON 横向阅读格式
- `web/default/src/features/usage-logs/components/request-messages-provider.tsx` — RequestMessagesProvider 上下文，按当前页 request_id 批量加载请求内容；新增 canViewRequestContent 控制，非超级管理员不发起查询
- `web/default/src/features/usage-logs/api.ts` — 新增 getRequestMessages API；批量查询改为 POST /batch 并经 body 传 request_ids，避免分页 100 时 query 过长；新增 notifyRequestMessageViolation API
- `web/default/src/features/usage-logs/types.ts` — 新增 RequestMessage 接口；LogOtherData 复用 user_agent 承载中继请求的原始 User-Agent；新增 NotifyViolationRequest 类型
- `controller/security_audit.go` — 新增非工作时间违规通知接口，校验用户、实际请求时间范围和请求次数，确认飞书绑定后发送安全审计卡片
- `controller/security_audit_test.go` — 覆盖缺少用户、时间范围倒置和请求次数非正数的接口校验
- `web/src/features/security-audit/api.ts`、`web/src/features/security-audit/types.ts` — 增加非工作时间违规通知请求 API 与载荷类型，日志弹窗目标携带用户、实际请求时间范围与请求次数
- `web/src/features/security-audit/components/off-hours-columns.tsx`、`web/src/features/security-audit/components/off-hours-detail-dialog.tsx` — 从非工作时间记录打开日志弹窗时传递通知上下文，在弹窗标题栏右上角、关闭按钮左侧展示违规通知操作
- `web/src/features/security-audit/components/off-hours-violation-notice.tsx` — 新增违规通知按钮、二次确认、发送中禁用以及成功和失败提示
- `web/src/features/security-audit/components/__tests__/off-hours-violation-notice.test.tsx` — 测试覆盖表格不新增违规通知列、日志弹窗右上角展示按钮及选中记录通知入口
- `web/default/src/features/usage-logs/components/usage-logs-table.tsx` — 包裹 RequestMessagesProvider，按当前页日志批量加载请求内容；按用户角色传入可见性，仅超级管理员允许加载
- `web/default/src/features/system-settings/maintenance/log-settings-section.tsx` — 从运维日志维护中移除「记录请求内容」开关
- `web/default/src/features/system-settings/operations/section-registry.tsx` — 运维设置不再传入 RecordRequestMessageEnabled 默认值
- `web/default/src/features/system-settings/operations/index.tsx` — 运维设置默认值移除 RecordRequestMessageEnabled
- `web/default/src/features/system-settings/security/audit-section.tsx` — 安全审计页面新增「记录请求内容」开关，保存审计设置时更新 RecordRequestMessageEnabled
- `web/default/src/features/system-settings/security/section-registry.tsx` — 将 RecordRequestMessageEnabled 服务端配置传入安全审计表单
- `web/default/src/features/system-settings/security/index.tsx` — 安全审计设置补充与后端一致的关闭默认值
- `web/default/src/features/system-settings/security/__tests__/audit-settings.test.tsx` — 测试覆盖请求内容记录开关在安全审计页面的展示和启用状态
- `web/default/src/features/system-settings/types.ts` — 将 RecordRequestMessageEnabled 从 OperationsSettings 迁移到 SecuritySettings
- `web/src/features/system-settings/security/audit-section.tsx` — 安全审计设置改为响应式卡片布局，统一功能说明、时间设置区域与开关层级；桌面端非工作时间审计与请求内容审计并排半宽，移动端单列。
- `web/src/features/system-settings/security/__tests__/audit-settings.test.tsx` — 补充安全审计卡片结构、半宽布局、时间区域及开关状态的测试断言。
- `web/src/i18n/locales/*.json` — 补齐非工作时间审计和图片审计卡片说明的七语言翻译。
- `relay/common/relay_info.go` — RelayInfo 新增 ClientApp 字段，基础中继信息生成时保存原始 User-Agent
- `relay/common/client_app.go` — 新增 DetectClientApp，返回请求携带的原始 User-Agent，不做客户端名称映射
- `relay/common/client_app_test.go` — 覆盖 DetectClientApp 原始 User-Agent 返回、缺失头与 nil 安全场景
- `service/log_info_generate.go` — 文本类使用日志 other 字段写入 user_agent，供前端表格展示
- `web/default/src/i18n/locales/en.json`、`web/default/src/i18n/locales/zh.json`、`web/default/src/i18n/locales/fr.json`、`web/default/src/i18n/locales/ja.json`、`web/default/src/i18n/locales/ru.json`、`web/default/src/i18n/locales/vi.json` — 新增 User-Agent 表头翻译和违规通知相关文案
- `web/default/src/components/dialog.tsx` — Dialog 组件样式调整
- `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 高级筛选移除令牌名称条件；角色筛选可输入角色名称，候选下拉仅展示角色名称、不按内部 role 值过滤；筛选区重排为两排紧凑布局：第一排时间、模型、类型、用户名和请求 ID，第二排分组、上游请求 ID、角色、渠道 ID 和日志范围切换，并微调时间与类型控件宽度
- `web/default/src/features/usage-logs/components/logs-filter-toolbar.tsx` — 支持为主筛选网格传入自定义列宽样式，普通日志页加宽时间选择器并保持其他筛选项紧凑
- `web/default/src/features/usage-logs/index.tsx` — 将全部/仅自己日志范围切换从页面操作区移入普通日志筛选区
- `web/default/src/features/usage-logs/components/usage-logs-table.tsx` — 普通日志表格 URL/列筛选状态移除 token_name 与 token 查询参数映射
- `web/default/src/features/usage-logs/lib/filter.ts` — 构造普通日志筛选 URL 参数时不再写入 token 条件
- `web/default/src/features/usage-logs/lib/utils.ts` — 请求日志接口参数时不再从搜索参数或列筛选生成 token_name 条件
- `web/default/src/features/usage-logs/types.ts` — CommonLogFilters 移除 token 字段
- `web/default/src/routes/_authenticated/usage-logs/$section.tsx` — 使用日志路由搜索参数 schema 移除 token
- `web/default/src/components/ui/combobox-input.tsx` — ComboboxInput 支持关闭自定义值提示与按 value 过滤，筛选输入数值时不弹出无关候选
- `web/default/src/components/ui/combobox.tsx` — 透传 ComboboxInput 的自定义值提示和 value 过滤开关
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 令牌列和详情列摘要仅在管理员日志视图中展示分组倍率或用户专属倍率，避免普通用户及「仅自己」视图泄露倍率
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 日志详情弹框的计费明细仅向管理员日志视图展示分组倍率或用户专属倍率
- `web/src/features/usage-logs/components/dialogs/request-content-dialog.tsx` — 多条请求消息新增单个胶囊按钮，可按当前状态一键切换全部展开或收起；复制反馈按消息唯一标识隔离，避免重复内容同时显示已复制。
- `web/src/features/usage-logs/components/dialogs/__tests__/request-content-collapse.test.tsx`、`request-content-copy.test.tsx` — 测试覆盖批量展开/收起、单条折叠以及重复消息仅高亮实际点击的复制按钮。

## 「仅自己」用户信息展示修复

- `model/log.go` — 抽取日志用户资料批量补充逻辑，个人日志接口同步返回 display_name、avatar_url、open_id 和 gender，确保「仅自己」模式与全部日志的头像及身份数据一致
- `model/log_user_filter_test.go` — 新增个人日志返回展示名、头像、飞书 open_id 和性别字段的测试
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 将日志数据范围与用户列/资料卡权限拆分，管理员切换「仅自己」后仍显示用户列并加载完整资料
- `web/src/features/usage-logs/lib/columns.ts` — 用户列工厂改为接收独立的列可见性和资料加载权限选项
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 用户列支持独立显示控制，完整资料异步加载后同步刷新头像、展示名和用户名
- `web/src/features/usage-logs/components/columns/__tests__/self-scope-user-details.test.tsx` — 新增「仅自己」模式下头像、用户身份文本和悬停资料卡入口保持可见的组件测试

## 2026-08-19 渠道和分组倍率权限收紧

- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 渠道列可见性收紧为仅超级管理员，并向各日志类型列工厂传递权限。
- `web/src/features/usage-logs/lib/columns.ts`、`web/src/features/usage-logs/components/columns/drawing-logs-columns.tsx`、`web/src/features/usage-logs/components/columns/task-logs-columns.tsx` — 绘图日志和任务日志列工厂支持独立控制渠道列，普通管理员不再看到渠道列。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 公共日志的渠道列、令牌列分组倍率摘要和详情预览按超级管理员权限显示。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 详情弹窗的渠道、重试链和分组倍率按独立权限控制，供数据总览复用时隐藏敏感字段。

## 2026-08-21 普通日志渠道搜索

- `controller/log.go` — 普通日志列表和统计接口保留渠道搜索字符串，后端按渠道 ID 或渠道名称处理。
- `model/log.go` — 从主库渠道表解析渠道 ID 和渠道名称模糊匹配结果，再过滤日志数据库中的普通日志和统计数据；新增渠道 ID/名称查询测试覆盖。
- `model/log_user_filter_test.go` — 验证普通日志按渠道 ID 精确查询和按渠道名称模糊查询。
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 筛选框文案由「Channel ID」改为「Channel」。
- `web/src/features/usage-logs/lib/utils.ts`、`web/src/features/usage-logs/types.ts` — 渠道筛选参数改为字符串，保留渠道 ID 或渠道名称输入后传给接口。

## 2026-08-25 普通日志渠道下拉筛选

- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 渠道筛选由文本输入改为可搜索下拉框并分页加载全部渠道；启用渠道优先，随后按优先级、权重和 ID 降序；选项以编号徽章和渠道名称分栏展示，禁用渠道在末尾显示禁用标签，选中后在筛选框中保留完整样式。
- `web/src/components/ui/combobox-input.tsx` — 可搜索下拉选项新增尾部内容和完整选中态渲染能力，将浮层、选项间距、悬停效果及右侧选中对勾统一为 Select 风格。
- `web/src/components/ui/combobox.tsx` — 透传可搜索下拉框的完整选中态配置。

## 2026-08-25 渠道名称搜索忽略大小写

- `model/log.go` — 渠道名称模糊匹配统一对字段和搜索参数应用 `LOWER`，确保 SQLite、MySQL 和 PostgreSQL 下均不区分大小写，同步作用于日志列表和统计查询。
- `model/log_user_filter_test.go` — 使用大写搜索词匹配混合大小写渠道名称，验证大小写不敏感的模糊搜索行为。

## 2026-08-24 模型映射详情悬浮展示

- `web/src/features/usage-logs/components/model-badge.tsx` — 模型映射详情由点击弹窗改为悬浮或键盘聚焦显示，浮层宽度 24rem，允许请求模型和实际模型的长名称完整换行。
- `web/src/features/usage-logs/components/__tests__/model-badge-interaction.test.tsx` — 测试覆盖模型映射详情使用悬浮卡片、24rem 宽度及长模型名称不截断。

## 2026-09-01 演示模式日志隐私遮蔽

- `web/src/lib/demo-mode.ts` — 增加通用金额遮蔽函数，仅把格式化后的金额数字替换为星号并保留货币符号。
- `web/src/lib/__tests__/demo-mode.test.ts` — 测试覆盖美元、人民币及无货币符号金额的演示模式遮蔽规则。
- `web/src/features/usage-logs/components/log-cost-display.tsx` — 费用列在演示模式下隐藏普通费用和订阅费用数字，保留配置的货币符号。
- `web/src/features/usage-logs/components/__tests__/cost-display.test.tsx` — 测试覆盖普通费用、订阅费用及货币符号保留行为。
- `web/src/features/usage-logs/lib/channel-visibility.ts` — 演示模式统一遮蔽渠道编号、渠道名称和悬浮详情，避免无名称渠道继续泄露编号。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 渠道徽章、悬浮详情和重试链隐藏渠道信息；详情列金额保留货币符号并隐藏数字；令牌列不再展示分组倍率；请求内容列改为星号占位并移除完整内容入口。
- `web/src/features/usage-logs/components/columns/column-helpers.tsx` — 任务日志和绘图日志共用渠道列在演示模式下隐藏渠道编号并禁用复制。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 日志详情弹框隐藏渠道、重试链和分组倍率，遮蔽计费明细、违规费用、订阅额度与动态价格中的金额数字。
- `web/src/features/usage-logs/components/dialogs/task-details-dialog.tsx` — 任务详情弹框隐藏渠道编号和配额数字，保留配额货币符号。
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 演示模式停止批量加载请求内容，避免已遮蔽的正文继续进入前端。
- `web/src/features/pricing/components/dynamic-pricing-breakdown.tsx` — 动态计费价格被遮蔽时保留当前配置的货币符号。

## 2026-09-05 普通日志模型下拉筛选

- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 模型筛选由文本输入改为可搜索下拉框；管理员从全部渠道聚合、去重并排序模型，普通用户加载自身可用模型，同时保留自定义模型名称输入。

## 2026-09-10 审计日志用户列统一

- `model/audit_log.go`、`model/log.go` — 审计列表复用使用日志的用户资料批量查询，首屏直接补齐 display_name、avatar_url、open_id 和 gender，不再等前端悬停后逐条加载。
- `controller/access_token_audit_test.go` — 接口与数据库矩阵测试覆盖审计列表首屏返回完整用户展示资料。
- `web/src/features/usage-logs/components/log-user-cell.tsx`、`components/columns/common-logs-columns.tsx` — 抽取并复用日志用户单元格，统一头像、显示名/用户名双行、演示模式遮蔽、飞书跳转和悬停资料卡；使用日志与审计日志的用户 ID 统一为相同的弱化文字色。
- `web/src/features/usage-logs/audit/api.ts`、`components/audit-log-columns.tsx`、`components/audit-log-viewer.tsx` — 审计日志用户列首屏消费完整展示资料；仅管理员全部记录范围在悬停时按需加载资料卡其余字段，个人范围不发起无权限请求。
- `web/src/features/usage-logs/audit/__tests__/viewer.test.tsx` — 测试覆盖详情接口调用前已展示审计日志用户头像、显示名和用户名，悬停后再加载完整资料。

## 2026-09-10 使用日志列字重统一

- `web/src/features/usage-logs/components/log-cost-display.tsx` — 费用列金额由半粗体改为常规字重，保留订阅提示和工具调用附加费标记。
- `web/src/components/data-table/core/data-table-header.tsx`、`column-header.tsx`、`web/src/tanstack-table.d.ts` — 通用数据表格列元数据支持指定列头字重，无排序与可排序列头都将样式应用到标题文字。
- `web/src/features/usage-logs/components/log-ip-address.tsx` — 抽取使用日志与审计日志共用的 IP 地址徽章，统一敏感信息遮蔽、复制、长地址悬浮提示、常规字重和细描边图标。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx`、`log-user-cell.tsx` — 使用日志时间和用户列头改为半粗体，时间值、日志类型标签、用户名称和头像回退文字保持常规字重；令牌徽章用常规字重，IP 地址改为复用公共组件。
- `web/src/features/usage-logs/audit/components/audit-log-columns.tsx`、`audit-log-details-dialog.tsx` — 审计日志时间和用户列头改为半粗体，时间与用户单元格内容保持常规字重，详情列按钮中的“详情”文字用常规字重；IP 地址改为复用公共组件并调整时间、IP 列宽。
- `web/src/features/usage-logs/components/usage-logs-table.tsx`、`audit/components/audit-log-viewer.tsx` — 使用日志和审计日志表格正文及内部元素统一为常规字重。
- `web/src/features/usage-logs/components/__tests__/cost-display.test.tsx`、`group-price-display.test.tsx`、`components/columns/__tests__/self-scope-user-details.test.tsx`、`audit/__tests__/viewer.test.tsx` — 测试覆盖日志列头与内容字重、费用和令牌/IP 样式，以及审计详情按钮字重。

## 2026-09-10 审计日志详情弹框尺寸统一

- `web/src/features/usage-logs/components/dialogs/log-detail-layout.tsx` — 提取日志详情弹框共用的桌面端宽度、移动端边距和内容高度配置。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 使用日志详情弹框改为复用统一尺寸配置。
- `web/src/features/usage-logs/audit/components/audit-detail-value.tsx`、`audit-log-details-dialog.tsx` — 审计详情值支持附加样式；审计日志详情弹框复用使用日志尺寸配置，桌面端统一为视口 50% 宽、内容最高 72dvh，User-Agent 内容宽度占弹框 80%。

## 2026-09-10 User-Agent 采集规则统一

- `common/user_agent.go` — 新增日志与审计共用的 User-Agent 截断方法，保留客户端原始值并按最多 512 个 Unicode 字符安全截断。
- `relay/common/client_app.go` — 使用日志采集原始 User-Agent 时调用公共截断方法，继续写入 `other.user_agent`。
- `model/audit_log.go` — 审计日志写入顶层 `user_agent` 前调用同一公共截断方法，统一采集边界。
- `controller/user.go` — 登录审计不再向 `other.user_agent` 重复写入 User-Agent，统一由审计日志顶层字段保存。
- `model/audit_other.go` — 将 `AuditOther.UserAgent` 标记为仅供历史记录解码兼容的废弃字段，新记录不再赋值。
- `model/log.go` — 更新登录审计注释，明确 User-Agent 统一写入审计表顶层字段。

## 2026-09-11 安全审计整合至审计日志

- `web/src/features/usage-logs/audit/index.tsx`、`api.ts` — 审计日志页新增常规审计、非工作时间请求和图片审计分类；仅超级管理员显示安全审计分类，切换分类时隔离各表分页状态，并按需加载安全审计界面。
- `web/src/features/security-audit/index.tsx` — 安全审计改为嵌入审计日志页面，复用统一分类导航与页面布局；保留日期、用户名筛选，审计开关关闭时展示配置引导。
- `web/src/features/security-audit/components/image-audit-table.tsx`、`off-hours-table.tsx` — 图片审计和非工作时间审计的分页、筛选状态统一写入审计日志路由。
- `web/src/routes/_authenticated/usage-logs/audit.tsx` — 审计日志路由接管安全审计分类、筛选和分页参数，非超级管理员直接访问该分类时跳转无权限页面。
- `web/src/routes/_authenticated/security-audit/$section.tsx` — 原安全审计路由保留为兼容入口，将合法分类和现有查询参数重定向到审计日志页面。
- `web/src/hooks/use-sidebar-data.ts` — 移除重复的独立安全审计侧边栏入口，统一从审计日志进入。
- `web/src/i18n/locales/en.json`、`zh.json`、`zh-TW.json`、`fr.json`、`ja.json`、`ru.json`、`vi.json` — 补齐审计类型、常规审计、禁用状态和配置引导的七语言文案。

## 2026-09-13 普通日志详情列加重

- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 普通日志「详情」列的日志内容与计费摘要改用表格默认字重（半粗体），不再强制常规字重；省略占位符与「+N」折叠计数继续用常规字重以保持层次。

## 2026-09-13 用户身份组件统一

- `web/src/features/usage-logs/components/log-user-identity.tsx` — 新增共用身份块组件 `LogUserIdentity`：头像 + 显示名/用户名 + 悬停资料卡；日志行自带作者信息，移入头像时按 user_id 懒加载完整资料；支持 `sm`/`default`/`lg` 三档字号、`canFetchDetails` 关闭拉取、`children` 承载右侧附加信息；头像统一 34px（`sm` 档 24px），用户名沿用使用日志表格的 `text-muted-foreground/70`，内外两层垂直居中。
- `web/src/components/dialog.tsx` — `Dialog` 新增 `headerLeading`（标题前）与 `headerTrailing`（标题后）两个插槽；未传时行为不变，不影响其它弹框。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 日志详情弹框标题后挂载小尺寸身份块，仅在存在 user_id 或 username 时显示；去掉原本为占位新增的正文身份区块。
- `web/src/features/usage-logs/components/dialogs/task-details-dialog.tsx` — 任务详情弹框标题前挂载身份块；仅管理员任务列表有 username 时显示；按演示模式遮蔽用户名与头像。
- `web/src/features/usage-logs/components/dialogs/request-content-dialog.tsx` — 改为复用共用组件承载头像与显示名/用户名，模型、格式、时间、请求 ID 与 User-Agent 经 `children` 传入，删除内联的头像渲染与资料拉取代码。
- `web/src/features/usage-logs/audit/components/audit-log-details-dialog.tsx` — 审计日志详情弹框正文首行改为「身份块在左、日志摘要与成功/失败状态及时刻在右」的同排布局，删除内联身份代码并补齐演示模式遮蔽。
- `web/src/features/security-audit/components/image-audit-detail-dialog.tsx` — 图片审计生成详情弹框顶栏改用共用组件的 `lg` 档，保留右侧时间。
- `web/src/features/security-audit/components/image-audit-request-content-dialog.tsx` — 图片审计请求内容弹框改用共用组件，User-Agent 等信息经 `children` 传入。
- `web/src/features/data-overview/components/user-stats-dialog.tsx` — 用户统计弹框改用共用组件，删除为悬停卡片手工构造的完整 `UserColumnRow` 映射；身份信息与时间筛选合并为同一行（时间筛选按内容宽度靠右、小屏自动换行），去掉原分隔线并微调上下留白。
- `web/src/features/users/components/data-table-row-actions.tsx` — 行操作传给用户统计弹框的临时用户对象补齐 `avatar_url`、`open_id`、`gender`，修复该弹框头像需悬停后才显示的问题。

## 2026-09-14 审计日志新增余额与订阅分类

- `model/audit_log.go` — 新增 `AuditCategoryBalance`（`balance`）与 `AuditCategorySubscription`（`subscription`）常量并加入 `ValidAuditCategory` 白名单，审计列表接口可按新分类筛选；分类字段仍为 `varchar(24)` / ClickHouse `String`，无 schema 变更，`ValidAuditCategory` 改为 `slices.Contains` 判断。
- `model/log.go` — 拆出 `RecordCategoryAuditLog`，由调用方显式指定分类，用户名查询、`AuditOther` 组装与状态/成功标记推导逻辑不变；`RecordOperationAuditLog` 签名与行为保持不变，内部推导分类后委托，既有十余处调用不动。
- `controller/user_quota.go` — 调整额度成功后审计条目归属改为被操作用户（`actor_role` 仍记录操作者角色），分类记为 `balance`；失败仍记 `operation` 并保留 `failure_reason`；目标用户不存在时归属回退为操作者，避免用户列为空。
- `controller/subscription.go` — 新增 `recordSubscriptionQuotaAudit`：订阅额度增减成功后在 `subscription` 分类下记录订阅 ID、套餐 ID、金额（元）、额度增量与调整前后总额度，归属订阅所属用户并抑制中间件兜底条目；订阅行查询失败时不标记已记录，事件仍由兜底产生。
- `controller/audit.go` — 补充订阅额度增减的英文兜底文案。
- `model/subscription.go` — 新增 `GetUserSubscriptionById`，供审计读取订阅所属用户、套餐与总额度。
- `web/src/features/usage-logs/audit/components/audit-log-filter-bar.tsx`、`web/src/routes/_authenticated/usage-logs/audit.tsx` — 分类筛选新增余额与订阅两项，顺序调整为 全部分类 → 登录 → 订阅 → 余额 → 账户安全 → 操作审计 → Access Token；路由搜索参数的分类枚举同步扩展。
- `web/src/features/usage-logs/lib/quota-audit-operation.ts` — 补上订阅额度增减两条动作，额度调整文案改为动词开头的单行（如 `增加额度：500000 · 500000 → 1000000`），并输出 `outcome`（动词 + 增/减/覆盖色调）与不含动词的数值 `detail`。
- `web/src/features/usage-logs/audit/components/quota-outcome-badge.tsx` — 新增额度调整标记徽标：增加绿、减少红、覆盖灰。
- `web/src/features/usage-logs/audit/components/audit-log-columns.tsx`、`audit-log-details-dialog.tsx` — 事件列与详情弹窗的额度调整改为「彩色徽标 + 数额 · 前 → 后」，不再重复操作动词与目标用户。
- `web/src/features/usage-logs/lib/format.ts` — 使用日志侧的额度审计内容改为动词开头的单行（去掉 `(ID: n)` 那行），并补上订阅额度增减模板。
- `web/src/features/usage-logs/audit/lib/audit-details.ts` — 额度与订阅条目在被操作用户本人查看时不再显示自己为「操作者」，补充订阅 ID 字段标签与 `balance`/`subscription` 的分类兜底文案。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`、`web/src/i18n/static-keys.ts` — 补充「覆盖额度」「订阅 ID」「{{action}}：{{quota}}」等七语言文案并登记动态键，移除已废弃的「请求数额：{{quota}}」。

## 2026-09-16 非工作时间弹框用户身份组件

- `web/src/features/security-audit/components/off-hours-detail-dialog.tsx` — 原标题为 `使用日志 - 用户名 · 日期 · 时段` 的单行拼接文本，改为标题只留「使用日志」、下方复用共用身份组件 `LogUserIdentity` 展示头像与显示名/用户名，日期、时段、请求数经 `children` 传入名字右侧；违规通知按钮仍留在标题行右侧（关闭按钮左侧）。参照图片审计请求内容弹框的用法取 `sm` 档（头像 24px、名字 `text-xs`、用户名 `text-[11px]`），附加信息行同步降为 `text-xs`、间距收到 `gap-1`，头部整体间距 `gap-2.5`。演示模式沿用既有约定：用户名传空、头像置空、关闭 `canFetchDetails`，仅显示脱敏显示名。请求数复用已有 i18n 键 `{{value}} requests`，未新增文案。
- `web/src/features/security-audit/types.ts` — `OffHoursDetailTarget` 新增可选 `avatarUrl`，让弹框首屏即有头像，不必等悬停拉取资料。
- `web/src/features/security-audit/components/off-hours-columns.tsx` — 打开弹框时传入列表行已有的 `avatar_url`。

## 2026-09-17 请求内容弹框新增请求信息区块

- `web/src/features/usage-logs/components/dialogs/request-log-summary.tsx` — 新增 `RequestLogSummary`，把当前请求日志行已有的运行信息以明细行展示：响应时间（流式请求附带 FRT）、输入/输出 Token、缓存读取/写入、费用、渠道（编号 + 名称）、重试链、令牌、分组、模型映射、上游请求 ID、IP 地址；取值为 0 或字段为空时不渲染该行；缓存写入优先取 5 分钟与 1 小时分项之和，无分项时回退 `cache_creation_tokens`；明细行容器用 `flex flex-col gap-2.5` 排布，行间距 10px，只在实际渲染出的行之间生效（字段为空的行不参与）；行内文字尺寸由容器统一覆盖，不改动共用的 `DetailRow`。
- `web/src/features/usage-logs/components/dialogs/request-content-dialog.tsx` — 右栏在请求参数之外新增「请求信息」折叠区块，两个区块各占 50% 高度并各自内部滚动，折叠其中一个时另一个占满剩余高度；请求信息排在请求参数上方，内容左内缩 24px 与区块标题文字对齐，字号在容器上用 `[&_span]:text-[13px]` 覆盖为 13px（`DetailRow` 自身保持 12px，日志详情与审计日志详情弹框不受影响）；`log` 属性为可选，未传入时不渲染该区块；弹框尺寸由 `h-[85vh] sm:max-w-[78rem]` 改为 `h-[92vh] sm:w-[95vw] sm:max-w-[95vw]`，桌面端宽度占视口 95%、高度 92vh，移动端仍为 `w-full`，`h-[92vh]` 未触及 Dialog 默认的 `max-h-[calc(100vh-2rem)]` 上限。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 打开请求内容弹框时传入当前行日志，供区块展示运行信息。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json` — 新增 "Request Info" / 「请求信息」区块标题的七语言翻译。

## 2026-09-23 使用日志多模型筛选、Token 汇总与 Excel 导出

- `controller/log.go` — 管理员与个人日志统计响应新增累计输入、输出 Token 总量字段，供筛选结果汇总展示。
- `controller/log_export.go` — 新增管理员与个人日志导出处理器，校验筛选条件和时区；个人导出强制限定当前用户及权限范围，并通过单用户去重、全局并发上限、十分钟超时与临时文件控制导出资源占用。
- `model/log.go` — 模型名称筛选支持逗号分隔的多值 OR 查询，每个值保留包含匹配或显式通配符语义；日志统计同步汇总全部输入、输出 Token。
- `model/log_export.go` — 新增导出筛选与精简行模型，沿用日志列表的模型、用户、角色、渠道、分组及请求 ID 等筛选语义，以单次结果流遍历导出数据，并兼容 SQLite、MySQL、PostgreSQL 与 ClickHouse 排序。
- `router/api-router.go` — 注册管理员 `/api/log/export` 与个人 `/api/log/self/export` 下载接口；两个接口均收紧为超级管理员认证，普通管理员和普通用户无法直接调用导出。
- `service/log_export.go` — 使用 Excelize 流式生成 XLSX，导出时间、类型、模型、费用及输入/输出/缓存 Token；费用按当前显示币种或额度单位转换，订阅日志优先采用订阅实际消耗，演示模式遮蔽费用，并限制 Excel 单表最大行数。
- `go.mod`、`go.sum` — 引入 Excelize 及其传递依赖，用于流式生成 Excel 工作簿。
- `web/src/features/usage-logs/components/common-logs-export-button.tsx` — 新增导出与取消按钮，按当前日志范围和筛选条件发起下载，展示进行中状态及成功、空数据、失败反馈。
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 模型筛选由单选搜索改为可创建选项的多选组件，以逗号拼接筛选值；工具栏接入日志导出操作，并仅向超级管理员显示导出按钮。
- `web/src/features/usage-logs/lib/export-excel.ts` — 复用当前列表参数构造管理员或个人导出请求，传递浏览器时区、校验 XLSX 响应与导出条数，并按筛选时间范围生成中文下载文件名。
- `web/src/features/usage-logs/components/common-logs-stats.tsx` — 统计栏新增累计 Token 徽标，按当前界面语言格式化并以亿 Token 为单位展示，同时补齐加载骨架与换行布局。
- `web/src/features/usage-logs/constants.ts`、`web/src/features/usage-logs/types.ts` — 日志统计默认值与类型新增 `total_tokens` 字段。

## 2026-09-24 Excel 导出直接使用当前筛选条件

- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 从界面当前尚未提交的筛选草稿构造导出参数，覆盖时间、模型、类型、用户、角色、分组、渠道及请求 ID 等条件；修改条件后无需先点击查询即可直接导出。
- `web/src/features/usage-logs/components/common-logs-export-button.tsx` — 导出按钮改为接收当前筛选参数，不再读取上一次查询写入路由的参数，也不再让旧表格列筛选覆盖当前条件。
- `web/src/features/usage-logs/lib/export-excel.ts` — 收紧导出配置类型，仅保留导出请求实际需要的筛选、范围与用户字段，后端仍按完整筛选结果生成 XLSX。

## 2026-09-24 使用日志 Token 分类汇总

- `controller/log.go` — 管理员与个人统计接口透传请求上下文，并支持按需返回 Token 分类明细；个人统计显式限定当前用户，统计响应直接返回完整结构。
- `model/log.go` — 日志统计拆分额度、实时 RPM/TPM 与 Token 汇总查询；Token 总量改从主库小时聚合数据读取，筛选辅助方法按查询实际使用的数据库方言生成条件，兼容主库与独立日志库。
- `model/log_token_stats.go` — 新增基于 `quota_data` 的 Token 汇总查询，复用日志页的时间、模型、用户、角色、令牌、渠道和分组筛选，并可返回输入、输出、缓存读取及缓存写入四类明细。
- `web/src/features/usage-logs/api.ts`、`web/src/features/usage-logs/types.ts` — 统计请求支持分类明细参数和中止信号，响应类型补充四类 Token 字段。
- `web/src/features/usage-logs/components/common-logs-stats.tsx` — Token 徽标新增详情入口，仅在打开悬浮提示时加载分类明细；筛选变化会取消旧请求，并为汇总和明细分别展示加载、失败及重试状态。
- `web/src/components/token-breakdown-tooltip-content.tsx` — 抽取统一的 Token 分类明细组件，按当前界面语言以亿 Token 展示总量、输入、输出、缓存读取和缓存写入。
- `web/src/features/data-overview/components/department-stats-cards.tsx` — 部门统计卡片复用统一 Token 分类明细组件，移除重复的 Tooltip 内容实现，既有展示口径保持不变。

## 自 CHANGELOG 说明列迁入

使用日志与请求内容优化：完善用户信息、权限控制、分页筛选、列布局与详情弹框；新增 IP、User-Agent、请求内容及生图 Prompt 展示，支持头像资料卡与飞书跳转；使用日志与审计日志统一保存原始 User-Agent（限 512 个 Unicode 字符），登录审计仅写顶层字段并兼容读取历史重复元数据；请求内容支持参数并排查看、独立滚动、复制与违规通知，接口收紧为仅超级管理员可用；弹框支持一键切换全部展开/收起，修复复制重复消息时多个按钮同时显示已复制；优化费用、渠道标签、敏感信息显示及管理员「仅自己」视图；安全审计改响应式布局，非工作时间请求支持违规通知；请求内容弹框折叠触发器改为 div，避免生成原生 button；渠道列与分组倍率等敏感信息进一步收紧为仅超级管理员可见；普通日志渠道筛选改为可搜索下拉框，按启用状态、优先级与权重排序，以编号徽章、禁用标签及完整选中态展示，支持按 ID 精确查询与按名称不区分大小写模糊查询；模型筛选同样可搜索，管理员聚合渠道模型、普通用户加载可用模型，保留自定义输入；模型映射详情改为悬浮展示并加宽，长模型名称支持完整换行；演示模式进一步遮蔽费用数字（保留货币符号）、渠道编号与名称、重试链、详情分组倍率及请求内容，令牌列不显示倍率，并阻断请求内容加载与查看；审计日志用户列复用使用日志的头像、显示名/用户名与悬停资料卡 UI，首屏批量返回用户资料，用户 ID 统一弱化文字色；使用日志费用金额与令牌徽章统一常规字重，IP 地址抽取公共组件供使用日志与审计日志复用，统一常规字重与细描边图标；审计与使用日志的时间、用户列头加粗而正文保持常规字重，审计详情按钮文字不加粗；审计详情弹框与使用日志统一桌面端宽度与内容高度，优化 User-Agent 内容宽度；非工作时间与图片安全审计整合进审计日志页，超级管理员在统一分类中切换，原独立入口自动跳转兼容，普通用户仍仅访问常规审计；普通日志「详情」列（日志内容与计费摘要）改为默认加粗字重，省略占位与「+N」折叠计数保持弱化字重；抽出共用用户身份组件（头像 + 显示名/用户名 + 悬停资料卡 + 演示模式遮蔽），统一用于使用日志详情、任务详情、请求内容、审计日志详情、图片审计详情与图片审计请求内容、用户统计弹框，收敛各弹框重复的头像与资料拉取逻辑（净减约 400 行）；Dialog 新增 headerLeading/headerTrailing 插槽承载标题前后内容：使用日志详情在标题后（小尺寸）、任务详情在标题前、审计日志详情与用户统计弹框在正文首行左侧；身份块头像统一 34px，用户名颜色与字号对齐使用日志表格用户列（70% 弱化色、13px），上下垂直居中；用户统计弹框身份信息与时间筛选合并为同一行，去掉下方分隔线并微调留白；用户管理行操作向该弹框补齐 avatar_url、open_id、gender，修复头像需悬停后才显示；图片审计表格套用与使用日志、审计日志相同的 13px 单元格规则，用户、耗时、请求内容、渠道、模型五列统一弱化色与常规字重（头像首字母 semibold、耗时改弱化常规字重、渠道编号去掉随机彩色改用 70% 弱化色）；用户列列宽对齐使用日志：去掉显式宽度改用默认值，单元格固定 120px、去掉左侧额外内边距，姓名信息块弹性宽度，演示模式占位同步收窄；渠道列改用使用日志的渠道展示口径（编号、名称、悬浮提示与演示模式遮蔽统一），演示模式下禁用编号复制；渠道列加宽至 145px、渠道名宽度放宽至 125px，参数列收窄至 130px 并按内容宽度截断（自动表格布局下仅调列宽会被内容撑破，故两列同时约束内容宽度）
