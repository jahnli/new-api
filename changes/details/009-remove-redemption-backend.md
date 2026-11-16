# 移除兑换码后端与数据表

**日期**: 2026-06-19

删除兑换码模型、CRUD/兑换控制器、路由、状态常量、权限、审计及国际化配置。充值信息不再启用兑换码，前端同步移除兑换入口。

`model/main.go` 不再注册兑换码模型，启动时若检测到 redemptions 表则尝试删除并记录结果；升级会删除该表数据。接口与配置清理位于 `router/api-router.go`、`controller/user.go`、`controller/topup.go`。
