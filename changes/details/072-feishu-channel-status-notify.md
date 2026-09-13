# 路由可靠性新增飞书渠道状态通知

**日期**: 2026-08-24

## 涉及文件

- `setting/operation_setting/monitor_setting.go` — 新增飞书渠道状态 Webhook 配置字段及默认值。
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
