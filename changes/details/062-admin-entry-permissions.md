# 管理入口权限

**日期**: 2026-08-27

- 模型、订阅管理、系统信息及系统设置保留超级管理员入口限制。
- 普通管理员默认无渠道界面查看权限；获得 `channel.interface_view` 后显示渠道菜单并允许进入，超级管理员自动放行。侧栏和路由同时检查角色及权限。
- 用户角色变化递增认证版本，使旧会话重新认证；保存权限时按最终角色写入或清理，防止降级残留，也支持升级时同时授权。

## 实现入口

- `service/authz/resources_channel.go`、`controller/user.go`、`model/user.go` — 权限与角色更新。
- `web/src/lib/admin-permissions.ts`、`web/src/hooks/use-sidebar-view.ts` — 前端权限矩阵。
- `web/src/hooks/use-sidebar-data.ts`、`web/src/routes/_authenticated/channels/index.tsx` — 导航及路由。
