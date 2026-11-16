# 移除邀请与奖励

**日期**: 2026-06-20

- 移除邀请码、邀请关系及额度奖励，注册和 OAuth 不再保存邀请参数、分配奖励；钱包不提供邀请卡片或奖励转余额操作。
- 清理模型映射、接口、默认侧边栏、计费设置及类型与翻译，不再注册 QuotaForInviter / QuotaForInvitee。
- 当前启动代码没有旧邀请列删除迁移；既有数据库残留列不再参与应用读写，不应把旧记录中的删除列方案当作当前升级行为。

入口：`model/user.go`、`model/option.go`、`controller/user.go`、`controller/oauth.go`、`router/api-router.go`、`web/src/features/wallet/`、`web/src/features/system-settings/billing/`。
