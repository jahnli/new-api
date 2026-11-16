# 飞书凭据按公司配置

**日期**: 2026-11-16

- 飞书部门查询和通知读取所属公司的应用凭据，不使用全局 `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 或邮箱后缀兜底。
- 非工作时间通知使用收件人公司的应用，校验公司启用状态、飞书平台、凭据和接收人身份；移除全局单租户令牌缓存及部署变量透传。
- `FEISHU_SUPPORT_OPEN_ID` 仅用于支持联系人，通过惰性读取避免早于 `.env` 加载；与企业通知应用凭据分开。

## 实现入口

- `service/feishu_client.go`、`service/feishu_department.go` — 公司凭据和通知。
- `setting/system_setting/feishu.go`、`.env.example`、`docker-compose.yml` — 支持联系人及部署配置。
- 通知预览与卡片见 [使用日志与审计](056-usage-logs-user-column.md)。
