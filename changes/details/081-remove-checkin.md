# 移除用户签到

**日期**: 2026-09-22

个人资料不展示签到日历，不提供每日签到或随机额度奖励；后端删除签到模型、接口、路由、开关与奖励配置，前端清理请求、类型、设置及翻译。

`model/main.go` 不再自动迁移签到表，也没有删除旧签到表的启动逻辑。

入口：`router/api-router.go`、`model/main.go`、`web/src/features/profile/`、`web/src/features/system-settings/`。
