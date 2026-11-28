# 使用日志、请求内容与审计

**日期**: 2026-11-28

## 日志查询与身份

- 使用、任务及常规审计批量补充显示名、真实头像、平台身份和性别，首屏可展示身份，完整资料按权限悬停加载；管理员“仅自己”范围仍显示身份，不将是否显示用户列与资料读取权限混同。
- 头像、显示名/用户名、资料卡及飞书跳转复用共享身份组件，演示模式遮蔽真实身份并停止详情请求。任务详情同步真实头像，插件作者与安全链接置于悬停提示。
- 使用与审计保存原始 User-Agent，最多 512 个 Unicode 字符；新审计只写顶层字段，旧重复元数据兼容读取，错误日志同步记录客户端信息，仅影响新记录。
- 普通日志支持时间、类型、角色、用户、分组、渠道、请求及上游请求 ID 筛选。模型可多选或自定义，逗号多值作 OR 匹配；渠道可搜索下拉，启用、优先级及权重排序，后端兼容 ID 精确和名称不区分大小写包含匹配。
- 渠道位于主筛选，请求 ID 位于默认收起的高级筛选；保留手动展开，不显示条件数徽章。普通日志中，管理员的「全部 / 仅自己」切换位于桌面筛选栏顶部右侧，紧邻「展开 / 收起」按钮，收起高级筛选时仍可切换。移动端在筛选抽屉中切换。日志类型分页独立，默认每页 10 条，详情固定右侧。
- 渠道、重试链和分组倍率等敏感详情仅超级管理员可见；订阅消费金额及来源持续展示，保留工具附加费标记。模型映射悬停显示，请求处理名称去重后仅向超级管理员显示“已处理 · 名称”。
- 桌面消费与错误日志在客户端列显示传输协议，移动端在状态旁显示；日志详情以独立「请求协议」行放在响应时间下方，请求内容弹框放在右侧「请求信息」的 IP 地址下方，请求 ID 旁不再显示协议。请求 ID 以 `-ws-数字` 结尾或请求路径为 `/v1/realtime` 时显示 `WS`，支持悬停和键盘聚焦查看 WebSocket 全称；其他请求有路径时显示 `HTTP`，缺少路径且请求 ID 无 WebSocket 后缀时隐藏协议行及标记。

## Token 汇总与导出

- 普通日志支持按请求发生时记录的 API 密钥名称筛选。输入关键词可忽略大小写匹配部分名称，即使密钥后来改名或删除，仍可按旧名查询。选中候选项后按所属用户 ID 和完整名称匹配，同一用户的同名密钥合并展示。筛选条件保存在 URL 中，列表、统计与 XLSX 导出共用。
- 个人范围默认列出本人最近使用的最多 10 个密钥名称。管理员在「全部」范围输入关键词后可按用户名区分候选，搜索最多返回 20 项。「仅自己」按当前登录用户 ID 限定日志，保留管理员可见的明细。
- Token 汇总、明细和综合单价仅超级管理员日志视图展示。按密钥名称筛选时，统计和导出均根据匹配的消费日志还原输入、输出、缓存读取和缓存写入。其他查询沿用主库 `quota_data` 汇总。四类 Token 与主统计一次返回，RPM/TPM、金额与百分比复用语言相关格式化。
- 汇总缓存命中率为缓存读取 ÷（非缓存输入 + 缓存读取 + 缓存写入），无输入显示占位符，保留一位小数。单条明细按 usage_semantic 区分 OpenAI 输入已含缓存与 Anthropic 输入不含缓存，旧日志回退 claude 标记；包含各时长写入缓存，输出不参与分母，无输入或数量不一致显示 `-`，保留两位小数。
- 单条 Token 点击打开分类，移出数值和浮层后延迟关闭；总量、输入/输出、缓存明细复用共享组件。
- 仅超级管理员可从全部或个人范围导出 XLSX，使用界面当前筛选草稿，无需先查询；个人接口仍强制当前用户。支持取消、单用户去重、全局并发限制和十分钟超时，单次流式读取后落临时文件，明细与汇总同源并受 Excel 行数上限保护。
- 导出按当前货币或额度单位换算，订阅优先取实际消费，金额以十进制额度累计、八位小数数值写入；输入按 usage 语义扣除已包含缓存，缓存分项不重复相加。说明保留订阅消费与钱包实扣差别、筛选边界和尾差，演示模式遮蔽费用和渠道，请求传递浏览器时区，文件名标明筛选范围。

## 请求内容留存

- `RecordRequestMessageEnabled` 默认关闭，在安全审计设置中独立配置；中继异步保存文本、多模态占位、生图/编辑 Prompt 及请求参数，按 request_id 关联日志并截断超长内容。
- Responses WebSocket 的首次请求及连接复用后的每次 `response.create` 均使用同一采集逻辑，按该次请求 ID 留存用户输入和参数，标记为流式请求；没有可留存用户输入时不写入记录，渠道重试不重复采集。仅对开启留存后的新请求生效，历史缺失内容不会自动补回。
- 管理端批量读取与通知接口仅超级管理员可用，POST body 承载批量 ID；普通日志界面非超级管理员或演示模式不加载、不开放完整内容入口。
- 摘要仅截断展示，点击查看完整会话。弹框支持整组展开/收起、逐消息复制反馈，消息、请求参数与运行信息独立滚动；运行信息按权限展示耗时、Token、费用、渠道、令牌、映射、IP 等。

## 审计分类与异常时段

- 常规审计支持登录、订阅、余额、账户安全、操作及 Access Token 分类。额度/订阅成功事件归属被操作用户并记录操作者、增减前后与订阅关联；失败保留操作审计，颜色区分增加、减少和覆盖。
- 常规审计用户筛选按当前用户名或显示名包含匹配，去除首尾空格并转义 LIKE 特殊字符；从主库找用户 ID 后查询独立日志库，兼容中文组合输入。
- 异常时段、图片及 SMTP 审计整合在审计日志页，仅超级管理员可访问，旧安全审计路由保留重定向，各类分页筛选隔离。图片保存及审计开关见 [#058](058-online-image-generation.md)。
- 异常时段审计使用结构化 off_hours 配置，默认启用、窗口 03–07 时，支持时间和用户筛选、按天数排序、常用模型及日志详情。旧版审计配置仍按兼容逻辑转换；关闭时提示配置引导。

## 通知及发送前预览

- 超级管理员可从含用户和请求 ID 的消费/错误日志详情或请求内容发送通知，“仅自己”详情同样可用，演示模式隐藏。支持非工作内容、安全风险、频繁请求、模型切换、客户端与模型匹配五类；切换模型必须选择已启用且关联模型的供应商系列，由后端校验并填充名称。
- 异常时段通知校验用户、实际起止时间及正请求次数，并与请求通知共用收件人、响应式预览弹框、语言及错误重试；预览不发送消息，加载失败或刷新中不可发送，发送中防重复提交。
- 两类通知共用预览布局。宽屏左侧集中展示收件人和可用选项，右侧留出更多空间预览通知，窄屏上下排列。请求通知类型以紧凑的图标列表呈现，勾选标记显示当前类型，选择模型切换时在该选项下方显示目标模型系列。
- 目标模型系列复用共享可搜索下拉，列表最大高度为 24rem（默认字号下 384px），同时限制在弹层可用高度减去 0.5rem 的范围内；超出内容在列表内滚动，展示更多供应商选项。
- 请求通知按用户公司配置选择飞书/钉钉及独立平台身份；公司缺失、不存在或未设平台时才回退邮箱。公司停用、凭据不全或身份无效直接报错，邮件校验邮箱与 SMTP。异常时段通知按所属公司飞书应用发送，凭据规则见 [#026](026-feishu-credentials.md)。正式发送最长 90 秒。
- 预览和发送共用七语言内容与分类图片，非工作/安全风险/频繁请求及异常时段采用红色，模型切换与客户端匹配采用橙色。安全风险分项说明，频繁请求提示检查脚本、并发和重试；模型切换显示当前与目标系列、提示无法保证可用性并尽快更换；匹配提醒说明 Claude Code/Claude 与 Codex/GPT 的对应关系。
- 飞书图片上传在 HTTP 429/5xx 时最多重试两次，遵循取消；SMTP 通知附加用途、用户等审计关联。

## SMTP 发送审计

- 邮件发送记录用途、用户/操作者、通知投递、请求 ID、阶段耗时、TLS 和接受/失败/不确定状态，不保存正文、验证码、凭据或原始 SMTP 错误响应；上下文和最长 90 秒超时贯穿发送。
- 独立主库表保存每次尝试，列表脱敏邮箱并省略阶段事件，详情显示诊断时间线；支持状态、用途、收件人、用户、请求 ID、时间及测试标记筛选，仅超级管理员可读取。
- 每分钟维护超时未完成状态并按 `SMTP_AUDIT_RETENTION_DAYS` 清理，默认 90 天。

## 主要入口

- `model/log_key_filter.go` 生成候选并按历史名称匹配日志。`router/api-router.go`、`middleware/access_token_routes.go` 和 `controller/log.go` 分别接入全部与个人范围的候选查询。
- `web/src/features/usage-logs/components/log-key-name-filter.tsx` 与 `web/src/components/ui/combobox-input.tsx` 支持候选选择和自由输入。`web/src/routes/_authenticated/usage-logs/$section.tsx` 校验可恢复的密钥名称、所属用户 ID 与用户名。
- `web/src/features/usage-logs/` 下的 `api.ts`、`types.ts`、`lib/filter.ts` 与 `lib/utils.ts` 传递候选与查询参数，`components/common-logs-stats.tsx` 和 `components/usage-logs-table.tsx` 应用当前筛选及查看范围。七种界面语言均提供「API 密钥名称」标签。
- `model/log.go`、`model/log_token_stats.go`、`controller/log.go`：日志及汇总；`model/log_export.go`、`controller/log_export.go`、`service/log_export.go`：导出。
- `model/request_message.go`、`controller/request_message.go`、`service/request_message.go`：留存、批量读取与通知。
- `relay/responses_websocket.go`：在首次请求和连接复用路径中采集请求内容，每次请求在准备计费前调用留存服务。
- `model/security_audit.go`、`controller/security_audit.go`、`setting/system_setting/audit_setting.go`：异常时段与配置兼容。
- `service/request_notice.go`、`service/feishu_department.go`：公司路由、预览与通知；`common/smtp_audit.go`、`model/smtp_audit.go`、`service/system_task.go`：SMTP 审计。
- `web/src/features/usage-logs/`、`web/src/features/security-audit/`、`web/src/features/system-settings/security/`：页面与配置。公共提示规则见 [#039](039-user-management-table.md)。
- `web/src/features/usage-logs/components/log-request-transport-badge.tsx` 统一判断并显示传输协议，由 `columns/common-logs-columns.tsx`、`common-log-mobile-card.tsx`、`dialogs/details-dialog.tsx` 和 `dialogs/request-log-summary.tsx` 复用；`dialogs/request-content-dialog.tsx` 将请求 ID 传给右侧运行信息，用于识别 WebSocket 后缀。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`：协议标签及「请求协议」行标题覆盖七种界面语言。
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx`、`web/src/features/usage-logs/components/logs-filter-toolbar.tsx`：普通日志范围切换与筛选栏布局。
- `web/src/features/usage-logs/components/dialogs/request-notice-button.tsx`、`web/src/features/usage-logs/components/dialogs/request-notice-dialog.tsx`：通知类型选择、目标模型系列选择及共用预览布局。
