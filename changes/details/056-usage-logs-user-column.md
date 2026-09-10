# 使用日志增强：用户信息、请求内容与审计

**日期**: 2026-09-10

## 涉及文件

- `model/log.go` — 日志只读字段增加 DisplayName/AvatarUrl/OpenId；批量补充用户资料；模型名称筛选支持去除首尾空格的包含匹配，并复用跨 SQLite、MySQL、PostgreSQL、ClickHouse 的 LIKE 转义。
- `model/clickhouse_log_test.go` — 覆盖 ClickHouse 模型名称匹配和通配符转义。
- `model/task.go`、`model/user.go`、`model/user_cache.go`、`controller/task.go`、`dto/task.go`、`relay/relay_task.go` — 任务日志透传 open_id，并复用用户基础缓存填充资料。
- `web/default/src/lib/utils.ts`、`web/default/src/features/home/components/sections/cta.tsx` — 统一构造飞书 openId 聊天链接。
- `web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 用户列展示头像、显示名、资料卡和飞书跳转；调整列顺序/宽度、IP、User-Agent、详情固定列和错误色；费用提示保留订阅来源；请求内容与倍率按权限显示。
- `web/src/features/usage-logs/` — 工具调用费用显示与测试、固定详情列、每页 10 条、请求内容批量查询及违规通知。
- `model/request_message.go`、`controller/request_message.go`、`service/request_message.go` — 新增请求内容模型、批量查询和违规通知；异步记录文本、多模态、生图/编辑 Prompt 及模型参数，支持长度截断和序列化。
- `controller/relay.go`、`router/api-router.go`、`model/option.go`、`model/main.go`、`common/constants.go` — 中继接入请求记录，注册模型、开关及仅超级管理员可访问的批量/通知路由。
- `web/default/src/features/usage-logs/components/dialogs/request-content-dialog.tsx`、`request-messages-provider.tsx`、`api.ts`、`types.ts` — 请求内容弹框和按页批量加载；内容/参数左右独立滚动，展示用户资料、User-Agent，支持复制和违规通知；非超级管理员不发起请求内容查询。
- `controller/security_audit.go`、`service/feishu_department.go`、`service/violation_notice_test.go` — 非工作时间违规通知按用户、实际时间范围和请求次数校验，并发送飞书安全审计卡片。
- `web/src/features/security-audit/` — 从审计日志打开通知入口，补充请求上下文、发送中禁用和成功/失败提示。
- `web/default/src/features/system-settings/security/`、`web/src/features/system-settings/security/` — 将请求内容开关迁移至安全审计，并优化审计设置响应式布局及七语言文案。
- `relay/common/relay_info.go`、`relay/common/client_app.go`、`service/log_info_generate.go` — 保存并写入原始 User-Agent，不做客户端名称映射。
- `web/default/src/features/usage-logs/` — 普通日志筛选改为紧凑两排布局，移除令牌名称条件，角色支持名称输入；修复管理员“仅自己”范围的用户资料显示。
- `web/src/features/usage-logs/components/log-cost-display.tsx` — 工具调用附加费组件接入后恢复订阅抵扣费用金额直接展示，悬停或键盘聚焦金额时提示订阅扣款来源，同时保留工具附加费标记
- `web/src/features/usage-logs/components/__tests__/cost-display.test.tsx` — 补充订阅抵扣金额可见、订阅来源 Tooltip 和工具附加费标记共存的回归测试
- `web/default/src/features/usage-logs/components/columns/task-logs-columns.tsx` — 任务日志用户列头像点击改为通过 open_id 跳转飞书，不再打开用户信息弹框
- `web/default/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 日志详情弹框桌面端宽度调整为屏幕宽度 50%
- `web/default/src/features/usage-logs/components/usage-logs-mobile-card.tsx` — 移动端使用日志卡片在令牌前展示 IP 地址字段
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 自定义行渲染合并固定列样式，确保详情列的表头和内容单元格都固定在右侧；默认分页大小统一改为每页 10 条
- `web/default/src/features/usage-logs/components/logs-filter-toolbar.tsx` — 高级筛选默认展开，避免筛选条件入口默认折叠
- `web/default/src/features/usage-logs/index.tsx` — 普通日志页不再渲染冗余页标题，任务日志仍保留任务日志标题与子分类切换
- `web/default/src/features/usage-logs/section-registry.tsx` — 普通日志导航标题统一为 Usage Logs
- `web/default/src/components/layout/components/section-page-layout.tsx` — 页面布局在无标题、操作区和面包屑时跳过顶部 header 容器，避免空元素继续占据空间
- `web/default/src/features/usage-logs/data/schema.ts` — Zod schema 新增 display_name、avatar_url、open_id、gender 字段
- `web/default/src/features/usage-logs/types.ts` — UserInfo 接口扩展完整用户详情字段并补充 open_id，TaskLog 补充 open_id
- `web/default/src/i18n/locales/en.json` — 新增 "Timing / First Token"、"Request Content"、"Record request content" 等翻译
- `web/default/src/i18n/locales/zh.json` — 新增 "耗时 / 首字"、"请求内容"、"记录请求内容" 等翻译
- `model/request_message.go` — 新增 RequestMessage 模型（request_id 关联 logs 表），存储用户提示词和模型参数
- `controller/request_message.go` — 管理员和普通用户批量查询 request_message 接口；新增 POST body 批量查询解析，避免分页 100 时 request_ids 拼入 URL 导致线上网关 502；新增违规通知接口，校验用户 open_id 后发送飞书安全审计提醒
- `service/request_message.go` — 中继请求后异步记录用户输入：提取多模态内容为占位符、截断超长对话、序列化参数；支持从生图与图片编辑请求中提取 Prompt，使使用日志可展示图片请求内容
- `service/request_message_test.go` — 补充生图 Prompt 记录、首尾空白清理和空提示词跳过的回归测试
- `service/feishu_department.go` — 新增飞书交互卡片发送与违规通知卡片构造；单请求卡片展示请求时间、模型与 Request ID，非工作时间卡片展示当天实际请求时间范围与请求次数，并提示正常业务可忽略、异常操作需检查账号及密钥
- `service/violation_notice_test.go` — 覆盖单请求与非工作时间两类违规通知卡片的红色模板、正文和关键字段
- `controller/relay.go` — 中继入口调用 RecordRequestMessage 记录请求内容
- `router/api-router.go` — 新增 /api/request_message 和 /api/request_message/self 路由；管理端批量查询接口改为 RootAuth，仅超级管理员可读取任意用户请求内容；补充 /batch 与 /self/batch POST 路由承载批量 request_ids；新增 /notify-violation 违规通知路由及仅超级管理员可调用的 /api/security_audit/off_hours/notify-violation 非工作时间通知路由
- `common/constants.go` — 新增 RecordRequestMessageEnabled 全局开关
- `model/option.go` — 系统选项注册和运行时更新 RecordRequestMessageEnabled
- `model/main.go` — AutoMigrate 注册 RequestMessage 模型
- `web/default/src/features/usage-logs/components/dialogs/request-content-dialog.tsx` — 请求内容详情弹窗，展示完整用户消息列表和请求参数；模型/格式/时间信息移至请求 ID 上方，请求 ID 字号放大并去除两行之间多余间距；新增违规通知按钮和确认弹框，发送后 toast 提示结果；请求内容与请求参数改为左右并排展示，请求参数默认展开并缩窄宽度，弹框统一为视口 85% 高度并修复高度计算；顶部新增头像、显示名和用户名，头像悬停加载完整用户资料，模型、格式、时间、请求 ID 与 User-Agent 排列在用户信息右侧；请求内容与请求参数区域均支持独立滚轮滚动，同时保留 JSON 横向阅读格式
- `web/default/src/features/usage-logs/components/request-messages-provider.tsx` — RequestMessagesProvider 上下文，按当前页 request_id 批量加载请求内容；新增 canViewRequestContent 控制，非超级管理员不发起请求内容批量查询
- `web/default/src/features/usage-logs/api.ts` — 新增 getRequestMessages API 调用；请求内容批量查询改为 POST /batch 并通过 body 传递 request_ids，避免分页 100 时 query 过长；新增 notifyRequestMessageViolation API 调用
- `web/default/src/features/usage-logs/types.ts` — 新增 RequestMessage 接口定义；LogOtherData 复用 user_agent 字段承载中继请求的原始 User-Agent；新增 NotifyViolationRequest 类型
- `controller/security_audit.go` — 新增非工作时间违规通知接口，校验用户、实际请求时间范围和请求次数，确认用户已绑定飞书后发送安全审计卡片
- `controller/security_audit_test.go` — 覆盖缺少用户、时间范围倒置和请求次数非正数的接口校验
- `web/src/features/security-audit/api.ts`、`web/src/features/security-audit/types.ts` — 增加非工作时间违规通知请求 API、载荷类型，并在日志弹窗目标中携带用户、实际请求时间范围与请求次数
- `web/src/features/security-audit/components/off-hours-columns.tsx`、`web/src/features/security-audit/components/off-hours-detail-dialog.tsx` — 从非工作时间记录打开日志弹窗时传递通知上下文，并在弹窗标题栏右上角、关闭按钮左侧展示违规通知操作
- `web/src/features/security-audit/components/off-hours-violation-notice.tsx` — 新增违规通知按钮、二次确认、发送中禁用以及成功和失败提示
- `web/src/features/security-audit/components/__tests__/off-hours-violation-notice.test.tsx` — 回归覆盖表格不新增违规通知列、日志弹窗右上角展示按钮及选中记录通知入口
- `web/default/src/features/usage-logs/components/usage-logs-table.tsx` — 包裹 RequestMessagesProvider，按当前页日志批量加载请求内容；基于当前用户角色传入请求内容可见性，仅超级管理员允许加载
- `web/default/src/features/system-settings/maintenance/log-settings-section.tsx` — 从运维日志维护中移除「记录请求内容」开关
- `web/default/src/features/system-settings/operations/section-registry.tsx` — 运维设置不再传入 RecordRequestMessageEnabled 默认值
- `web/default/src/features/system-settings/operations/index.tsx` — 运维设置默认值移除 RecordRequestMessageEnabled
- `web/default/src/features/system-settings/security/audit-section.tsx` — 安全审计页面新增「记录请求内容」开关，并在保存审计设置时更新 RecordRequestMessageEnabled
- `web/default/src/features/system-settings/security/section-registry.tsx` — 将 RecordRequestMessageEnabled 服务端配置传入安全审计表单
- `web/default/src/features/system-settings/security/index.tsx` — 安全审计设置补充与后端一致的关闭默认值
- `web/default/src/features/system-settings/security/__tests__/audit-settings.test.tsx` — 回归测试覆盖请求内容记录开关在安全审计页面的展示和启用状态
- `web/default/src/features/system-settings/types.ts` — 将 RecordRequestMessageEnabled 从 OperationsSettings 迁移到 SecuritySettings
- `web/src/features/system-settings/security/audit-section.tsx` — 安全审计设置改为响应式卡片布局，统一功能说明、时间设置区域与开关层级；桌面端非工作时间审计和请求内容审计并排半宽展示，移动端保持单列。
- `web/src/features/system-settings/security/__tests__/audit-settings.test.tsx` — 补充安全审计卡片结构、半宽布局、时间区域及开关状态的回归断言。
- `web/src/i18n/locales/*.json` — 补齐非工作时间审计和图片审计卡片说明的七语言翻译。
- `relay/common/relay_info.go` — RelayInfo 新增 ClientApp 字段，在基础中继信息生成时保存原始 User-Agent
- `relay/common/client_app.go` — 新增 DetectClientApp，返回请求携带的原始 User-Agent，不做客户端名称映射
- `relay/common/client_app_test.go` — 覆盖 DetectClientApp 原始 User-Agent 返回、缺失头与 nil 安全场景
- `service/log_info_generate.go` — 文本类使用日志 other 字段写入 user_agent，供前端表格展示
- `web/default/src/i18n/locales/en.json`、`web/default/src/i18n/locales/zh.json`、`web/default/src/i18n/locales/fr.json`、`web/default/src/i18n/locales/ja.json`、`web/default/src/i18n/locales/ru.json`、`web/default/src/i18n/locales/vi.json` — 新增 User-Agent 表头翻译和违规通知相关文案
- `web/default/src/components/dialog.tsx` — Dialog 组件样式调整
- `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 普通日志高级筛选移除令牌名称条件；角色筛选支持输入角色名称，候选下拉仅展示角色名称且不按内部 role 值过滤；筛选区重排为两排紧凑布局，第一排依次展示时间、模型、类型、用户名和请求 ID，第二排依次展示分组、上游请求 ID、角色、渠道 ID 和日志范围切换，并微调时间与类型控件宽度
- `web/default/src/features/usage-logs/components/logs-filter-toolbar.tsx` — 支持为主筛选网格传入自定义列宽样式，以便普通日志页加宽时间选择器并保持其他筛选项紧凑排列
- `web/default/src/features/usage-logs/index.tsx` — 将全部/仅自己日志范围切换从页面操作区移入普通日志筛选区
- `web/default/src/features/usage-logs/components/usage-logs-table.tsx` — 普通日志表格 URL/列筛选状态移除 token_name 与 token 查询参数映射
- `web/default/src/features/usage-logs/lib/filter.ts` — 构造普通日志筛选 URL 参数时不再写入 token 条件
- `web/default/src/features/usage-logs/lib/utils.ts` — 请求日志接口参数时不再从搜索参数或列筛选生成 token_name 条件
- `web/default/src/features/usage-logs/types.ts` — CommonLogFilters 移除 token 字段
- `web/default/src/routes/_authenticated/usage-logs/$section.tsx` — 使用日志路由搜索参数 schema 移除 token
- `web/default/src/components/ui/combobox-input.tsx` — ComboboxInput 支持关闭自定义值提示与按 value 过滤，便于筛选输入数值时不弹出无关候选
- `web/default/src/components/ui/combobox.tsx` — 透传 ComboboxInput 的自定义值提示和 value 过滤开关
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 令牌列和详情列摘要仅在管理员日志视图中展示分组倍率或用户专属倍率，避免普通用户及「仅自己」视图泄露倍率
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 日志详情弹框的计费明细仅向管理员日志视图展示分组倍率或用户专属倍率
- `web/src/features/usage-logs/components/dialogs/request-content-dialog.tsx` — 多条请求消息新增单个胶囊按钮，可根据当前状态一键切换全部展开或收起；复制反馈按消息唯一标识隔离，避免重复内容同时显示已复制。
- `web/src/features/usage-logs/components/dialogs/__tests__/request-content-collapse.test.tsx`、`request-content-copy.test.tsx` — 回归覆盖批量展开/收起、单条折叠以及重复消息仅高亮实际点击的复制按钮。

## 「仅自己」用户信息展示修复

- `model/log.go` — 抽取日志用户资料批量补充逻辑，并让个人日志接口同步返回 display_name、avatar_url、open_id 和 gender，确保「仅自己」模式与全部日志保持一致的头像及身份数据
- `model/log_user_filter_test.go` — 新增个人日志返回展示名、头像、飞书 open_id 和性别字段的回归测试
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 将日志数据范围与用户列/资料卡权限拆分，管理员切换「仅自己」后仍显示用户列并允许加载完整资料
- `web/src/features/usage-logs/lib/columns.ts` — 用户列工厂改为接收独立的列可见性和资料加载权限选项
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 用户列支持独立显示控制，并在完整资料异步加载后同步刷新头像、展示名和用户名
- `web/src/features/usage-logs/components/columns/__tests__/self-scope-user-details.test.tsx` — 新增「仅自己」模式下头像、用户身份文本和悬停资料卡入口保持可见的组件回归测试

## 2026-08-19 渠道和分组倍率权限收紧

- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 使用日志表格的渠道列可见性收紧为仅超级管理员，并向各日志类型列工厂传递权限。
- `web/src/features/usage-logs/lib/columns.ts`、`web/src/features/usage-logs/components/columns/drawing-logs-columns.tsx`、`web/src/features/usage-logs/components/columns/task-logs-columns.tsx` — 绘图日志和任务日志列工厂支持独立控制渠道列，普通管理员不再看到渠道列。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 公共日志的渠道列、令牌列分组倍率摘要和详情预览按超级管理员权限显示。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 详情弹窗的渠道、重试链和分组倍率按独立权限控制，供数据总览复用时隐藏敏感字段。

## 2026-08-21 普通日志渠道搜索

- `controller/log.go` — 普通日志列表和统计接口保留渠道搜索字符串，支持后端按渠道 ID 或渠道名称处理。
- `model/log.go` — 从主数据库渠道表解析渠道 ID 和渠道名称模糊匹配结果，再过滤日志数据库中的普通日志和统计数据；新增渠道 ID/名称查询回归覆盖。
- `model/log_user_filter_test.go` — 验证普通日志按渠道 ID 精确查询和按渠道名称模糊查询。
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 普通日志筛选框文案由「Channel ID」改为「Channel」。
- `web/src/features/usage-logs/lib/utils.ts`、`web/src/features/usage-logs/types.ts` — 渠道筛选参数改为字符串，保留渠道 ID 或渠道名称输入后传给接口。

## 2026-08-25 普通日志渠道下拉筛选

- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 渠道筛选由文本输入改为可搜索下拉框并分页加载全部渠道；启用渠道优先，随后按优先级、权重和 ID 降序排列；选项以编号徽章和渠道名称分栏展示，禁用渠道在末尾显示禁用标签，选中后在筛选框中保留完整样式。
- `web/src/components/ui/combobox-input.tsx` — 可搜索下拉选项新增尾部内容和完整选中态渲染能力，并将浮层、选项间距、悬停效果及右侧选中对勾统一为 Select 风格。
- `web/src/components/ui/combobox.tsx` — 透传可搜索下拉框的完整选中态配置。

## 2026-08-25 渠道名称搜索忽略大小写

- `model/log.go` — 渠道名称模糊匹配统一对字段和搜索参数应用 `LOWER`，确保 SQLite、MySQL 和 PostgreSQL 下均不区分大小写，并同步作用于日志列表和统计查询。
- `model/log_user_filter_test.go` — 使用大写搜索词匹配混合大小写渠道名称，回归保护大小写不敏感的模糊搜索行为。

## 2026-08-24 模型映射详情悬浮展示

- `web/src/features/usage-logs/components/model-badge.tsx` — 模型映射详情由点击弹窗改为悬浮或键盘聚焦显示，浮层宽度调整为 24rem，并允许请求模型和实际模型的长名称完整换行。
- `web/src/features/usage-logs/components/__tests__/model-badge-interaction.test.tsx` — 回归覆盖模型映射详情使用悬浮卡片、24rem 宽度及长模型名称不截断。

## 2026-09-01 演示模式日志隐私遮蔽

- `web/src/lib/demo-mode.ts` — 增加通用金额遮蔽函数，仅将格式化后的金额数字替换为星号并保留货币符号。
- `web/src/lib/__tests__/demo-mode.test.ts` — 回归覆盖美元、人民币及无货币符号金额的演示模式遮蔽规则。
- `web/src/features/usage-logs/components/log-cost-display.tsx` — 使用日志费用列在演示模式下隐藏普通费用和订阅费用数字，同时保留配置的货币符号。
- `web/src/features/usage-logs/components/__tests__/cost-display.test.tsx` — 回归覆盖普通费用、订阅费用及货币符号保留行为。
- `web/src/features/usage-logs/lib/channel-visibility.ts` — 演示模式统一遮蔽渠道编号、渠道名称和悬浮详情，避免无名称渠道继续泄露编号。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 渠道徽章、悬浮详情和重试链隐藏渠道信息；详情列金额保留货币符号并隐藏数字；令牌列不再展示分组倍率；请求内容列改为星号占位并移除完整内容入口。
- `web/src/features/usage-logs/components/columns/column-helpers.tsx` — 任务日志和绘图日志共用渠道列在演示模式下隐藏渠道编号并禁用复制。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 日志详情弹框隐藏渠道、重试链和分组倍率，并遮蔽计费明细、违规费用、订阅额度与动态价格中的金额数字。
- `web/src/features/usage-logs/components/dialogs/task-details-dialog.tsx` — 任务详情弹框隐藏渠道编号和配额数字，保留配额货币符号。
- `web/src/features/usage-logs/components/usage-logs-table.tsx` — 演示模式停止批量加载请求内容，避免已遮蔽的正文继续进入前端。
- `web/src/features/pricing/components/dynamic-pricing-breakdown.tsx` — 动态计费价格被遮蔽时保留当前配置的货币符号。

## 2026-09-05 普通日志模型下拉筛选

- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 模型筛选由文本输入改为可搜索下拉框；管理员从全部渠道聚合、去重并排序模型，普通用户加载自身可用模型，同时保留自定义模型名称输入。

## 2026-09-10 审计日志用户列统一

- `model/audit_log.go`、`model/log.go` — 审计列表复用使用日志的用户资料批量查询，首屏响应直接补齐 display_name、avatar_url、open_id 和 gender，不再等待前端悬停后逐条加载。
- `controller/access_token_audit_test.go` — 接口与数据库矩阵回归覆盖审计列表首屏返回完整用户展示资料。
- `web/src/features/usage-logs/components/log-user-cell.tsx`、`components/columns/common-logs-columns.tsx` — 抽取并复用日志用户单元格，统一头像、显示名/用户名双行、演示模式遮蔽、飞书跳转和悬停资料卡行为。
- `web/src/features/usage-logs/audit/api.ts`、`components/audit-log-columns.tsx`、`components/audit-log-viewer.tsx` — 审计日志用户列首屏消费完整展示资料；仅管理员全部记录范围在悬停时按需加载资料卡的其余字段，个人范围不发起无权限请求。
- `web/src/features/usage-logs/audit/__tests__/viewer.test.tsx` — 回归覆盖详情接口调用前已经展示审计日志用户头像、显示名和用户名，悬停后再加载完整资料。
