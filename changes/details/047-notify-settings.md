# 数据总览通知与报表接口

**日期**: 2026-08-19

数据总览提供个人通知配置：数据报告周期、部门超额及请假超额提醒，经 `/api/report-notify-setting/self` 读取保存并验证参数。

内部 `/api/internal/report-notify/user-reports` 供报表服务读取统计，使用 REPORT_NOTIFY_SIGNING_SECRET（至少 32 字节）对方法、路径、时间戳与请求体哈希进行 HMAC-SHA256 校验，时间戳允许正负 5 分钟，请求体上限 1 MiB。按 BP 显式部门配置和部门负责人关系合并精确范围，支持跨公司，不因管理员角色自动扩大权限；复用数据总览统计并返回飞书接收人 open_id。

入口：`model/report_notify_setting.go`、`controller/report_notify_setting.go`、`controller/report_notify_internal.go`、`middleware/report_notify.go`、`service/report_notify.go`、`web/src/features/data-overview/components/notify-settings-dialog.tsx`。
