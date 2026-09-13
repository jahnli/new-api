# 个人资料页与日志 IP 记录设置调整

**日期**: 2026-07-02

## 涉及文件

- `web/default/src/features/profile/components/profile-header.tsx` — 移除邮箱旁分组显示、用户 ID 徽章改为默认色、API 请求数万前加空格。
- `web/default/src/features/profile/components/tabs/notification-tab.tsx` — 记录使用和错误日志 IP 地址选项默认开启，仅在超级管理员账号下显示开关。
- `controller/user.go` — 保存个人设置时仅允许超级管理员修改 `record_ip_log`，非超级管理员保留原设置。
- `dto/user_settings.go` — 调整 `record_ip_log` 设置序列化，明确该选项默认开启且仅超级管理员可关闭。
- `model/user.go` — 用户设置读取与新用户初始化时默认开启 `record_ip_log`。
- `model/user_cache.go` — 用户设置缓存读取时默认开启 `record_ip_log`。
