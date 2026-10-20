# 渠道健康飞书通知与使用日志错误告警

**日期**: 2026-10-20

## 使用日志错误告警

- 渠道健康页面新增错误检查开关、统计窗口和数量阈值，复用飞书群机器人 Webhook。默认关闭，预设为 5 分钟内 10 条；窗口支持 1 至 1440 分钟，阈值支持 1 至 1000000 条，启用前必须配置有效 Webhook。
- 复用系统任务调度器，以 30 秒为检查间隔统计滚动窗口内的错误日志，通过任务执行锁协调多主节点。成功通知后按统计窗口时长冷却，发送失败不推进上次成功通知时间。
- 告警固定简体中文，展示错误数量、阈值、统计时段及主要出错渠道和模型，各最多 5 项；渠道展示名称和错误条数，不附带 ID、最近错误示例或额外说明。
- 卡片末尾并排提供“查看错误日志”和“前往渠道管理”按钮。前者预选错误类型，不附带时间筛选；后者打开渠道管理页，不限定具体渠道。链接均使用系统访问地址。
- 从日志数据库聚合错误数量，从主数据库补充渠道名称；详细统计查询失败时仍尝试发送基础告警，不新增数据库表或迁移。

## 涉及文件

- `setting/operation_setting/monitor_setting.go` — 定义飞书 Webhook、错误告警开关、统计窗口和阈值配置及默认值。
- `setting/operation_setting/feishu_webhook.go` — 校验并规范化飞书官方群机器人 Webhook URL。
- `setting/operation_setting/feishu_webhook_test.go` — 覆盖空值、合法地址及伪造地址校验。
- `controller/option.go` — 通用设置写入前执行飞书 Webhook 后端校验。
- `controller/option_feishu_webhook_test.go` — 验证设置接口拒绝非官方 Webhook 地址。
- `service/feishu_robot_notify.go` — 通过 SSRF 防护客户端发送飞书交互卡片并校验 HTTP 与业务响应；禁用和恢复卡片分别用红色告警、绿色恢复样式，展示渠道、状态、发生时间、禁用原因及处理提示；禁用卡片提供跳转现有渠道管理页的筛选按钮。
- `service/feishu_robot_notify_test.go` — 覆盖交互卡片负载、禁用/恢复视觉语义、渠道管理跳转、HTTP 失败、业务失败及禁用原因脱敏截断。
- `service/channel.go` — 确认自动禁用或启用状态变更后异步发送飞书通知。
- `relay/mjproxy_handler.go` — Midjourney 无可用账号实例统一接入标准自动禁用与通知链路。
- `web/src/features/system-settings/models/routing-reliability-section.tsx` — 路由可靠性页面增加飞书群机器人 Webhook 配置及本地化校验。
- `web/src/features/system-settings/models/feishu-webhook-url.ts` — 提供前端官方飞书 Webhook URL 校验。
- `web/src/features/system-settings/models/section-registry.tsx` — 向路由可靠性区块传递飞书通知配置。
- `web/src/features/system-settings/models/index.tsx` — 增加飞书通知配置默认值。
- `web/src/features/system-settings/types.ts` — 扩展模型系统设置类型。
- `web/src/features/system-settings/models/__tests__/routing-reliability-feishu.test.tsx` — 覆盖配置回显、关闭说明和地址校验。
- `web/src/i18n/locales/en.json` — 增加英文文案。
- `web/src/i18n/locales/zh.json` — 增加简体中文文案。
- `web/src/i18n/locales/zh-TW.json` — 增加繁体中文文案。
- `web/src/i18n/locales/fr.json` — 增加法语文案。
- `web/src/i18n/locales/ja.json` — 增加日语文案。
- `web/src/i18n/locales/ru.json` — 增加俄语文案。
- `web/src/i18n/locales/vi.json` — 增加越南语文案。
- `model/request_policy.go` — 将错误告警参数纳入配置快照及保存校验，检查数值范围和启用时的 Webhook 配置。
- `model/usage_log_alert.go` — 查询错误总数、主要渠道及模型统计，并读取上次成功通知时间。
- `service/usage_log_alert.go` — 注册告警任务，处理阈值、冷却、统计降级及简体中文卡片，复用渠道链接生成逻辑提供双跳转按钮。
- `web/src/features/system-settings/request-policies/channel-health-section.tsx` — 复用设置表单、开关和输入组件，增加告警配置与校验。
- `web/src/features/system-settings/request-policies/defaults.ts` — 补充错误告警设置类型及默认值。
- `web/src/features/system-info/constants.ts` — 增加错误告警任务的显示名称。

`service/feishu_robot_notify.go` 同时扩展支持上下文的发送接口，遵循任务取消及超时；上述七种前端语言文件补充错误告警设置、参数校验与发送失败文案，飞书卡片本身固定简体中文。

## 验证记录

- 2026-10-20 执行 `go build ./...` 和 `git diff --check`，均通过。
- 前端功能实现阶段执行 `bun run typecheck`、`bun run build`、`bun run i18n:sync`，均完成；未新增、修改或运行测试。
- 跨数据库运行验证仍受环境缺失阻塞：未完成 SQLite、MySQL、PostgreSQL 及独立 ClickHouse 日志库验证，无可报告的数据库验证版本及命令结果；未验证真实飞书投递。
