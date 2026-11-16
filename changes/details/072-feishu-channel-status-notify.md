# 渠道健康飞书通知与错误告警

**日期**: 2026-10-20

- 配置有效的飞书官方群机器人 Webhook 后，渠道实际自动禁用/恢复时异步发送红色告警/绿色恢复卡片，包含渠道、状态、时间及脱敏截断原因；禁用通知可跳转渠道筛选，Midjourney 无可用实例沿用该自动禁用链路。
- 错误数量告警默认关闭，默认 5 分钟内 10 条；窗口 1–1440 分钟、阈值 1–1000000，启用前校验 Webhook。
- 每 30 秒检查滚动窗口，以任务锁协调多主节点；通知成功后按窗口时长冷却，失败不推进成功时间。日志库聚合错误，主库补渠道名，详细查询失败仍尝试基础告警。
- 告警固定简体中文，展示总数、阈值、时段及各最多 5 个主要渠道/模型，不附原始错误或凭据。提供错误日志和渠道管理跳转，使用系统访问地址，错误日志只预选错误类型、不限定时间。
- 发送复用 SSRF 防护客户端，校验 HTTP 与业务结果，遵循任务取消和超时；设置界面提供七语言校验提示。

入口：`setting/operation_setting/monitor_setting.go`、`setting/operation_setting/feishu_webhook.go`、`service/feishu_robot_notify.go`、`service/channel.go`、`service/usage_log_alert.go`、`model/usage_log_alert.go`、`model/request_policy.go`、`web/src/features/system-settings/request-policies/channel-health-section.tsx`。

原记录未完成三库、独立 ClickHouse 日志库及真实飞书投递验证，本次不补称已验证。
