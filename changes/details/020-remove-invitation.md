# 移除邀请人/邀请码功能

**日期**: 2026-06-20

## 涉及文件

### 后端

- `model/user.go` — 移除 `AffCode`、`AffCount`、`AffQuota`、`AffHistoryQuota`、`InviterId` 字段；删除 `inviteUser()`、`TransferAffQuotaToQuota()`、`GetUserIdByAffCode()` 函数；清理 `Insert()`、`InsertWithTx()`、`FinalizeOAuthUserCreation()` 中的邀请奖励逻辑
- `model/main.go` — 新增 `dropInvitationColumns()` 迁移，启动时自动删除数据库中 5 个邀请列（MySQL/PostgreSQL）
- `model/option.go` — 移除 `QuotaForInviter`/`QuotaForInvitee` 的 OptionMap 初始化与 updateOptionMap case
- `common/constants.go` — 移除 `QuotaForInviter`、`QuotaForInvitee` 变量
- `controller/user.go` — 移除 `GetAffCode()`、`TransferAffQuota()` 控制器；清理 `Register()` 和 `GetSelf()` 中的邀请逻辑
- `controller/option.go` — 移除 `QuotaForInviter`/`QuotaForInvitee` 合规检查 case
- `controller/oauth.go` — 移除 OAuth 流程中的邀请码 session 处理
- `router/api-router.go` — 移除 `/aff` 和 `/aff_transfer` 路由
- `i18n/keys.go` — 移除 `MsgUserInviteQuotaInsufficient`、`MsgUserTransferQuotaMinimum`、`MsgUserAffCodeEmpty` 常量
- `i18n/locales/{en,zh-CN,zh-TW}.yaml` — 移除对应 3 个翻译条目

### 默认前端（删除的文件）

- `web/default/src/features/wallet/components/affiliate-rewards-card.tsx` — 删除
- `web/default/src/features/wallet/components/dialogs/transfer-dialog.tsx` — 删除
- `web/default/src/features/wallet/hooks/use-affiliate.ts` — 删除
- `web/default/src/features/wallet/lib/affiliate.ts` — 删除

### 默认前端（修改的文件）

- `web/default/src/features/system-settings/billing/index.tsx` — 移除 `defaultBillingSettings` 中残留的 `QuotaForInviter`/`QuotaForInvitee` 默认值
- `web/default/src/features/wallet/index.tsx` — 移除邀请卡片、转账对话框与 useAffiliate hook
- `web/default/src/features/wallet/hooks/index.ts` — 移除 `use-affiliate` 导出
- `web/default/src/features/wallet/lib/index.ts` — 移除 `affiliate` 导出
- `web/default/src/features/wallet/api.ts` — 移除 `getAffiliateCode()`、`transferAffiliateQuota()` 函数
- `web/default/src/features/wallet/types.ts` — 移除 affiliate 类型与 UserWalletData 中的 aff 字段
- `web/default/src/features/users/types.ts` — 从 userSchema 移除 5 个 aff/inviter 字段
- `web/default/src/features/users/components/users-columns.tsx` — 移除 `invite_info` 列
- `web/default/src/features/profile/types.ts` — 从 UserProfile 移除 aff/invite 字段
- `web/default/src/features/usage-logs/types.ts` — 从 UserInfo 移除 aff 字段
- `web/default/src/features/usage-logs/components/dialogs/user-info-dialog.tsx` — 移除邀请信息展示
- `web/default/src/features/system-settings/types.ts` — 从 BillingSettings 移除 `QuotaForInviter`/`QuotaForInvitee`
- `web/default/src/features/system-settings/general/quota-settings-section.tsx` — 移除邀请奖励表单字段与合规提示
- `web/default/src/features/system-settings/billing/section-registry.tsx` — 移除邀请相关 prop 与默认值
- `web/default/src/features/auth/api.ts` — 移除 OAuth 中 aff 参数
- `web/default/src/features/auth/types.ts` — 从 RegisterPayload 移除 `aff_code`
- `web/default/src/features/auth/sign-up/components/sign-up-form.tsx` — 移除邀请码存储与提交
- `web/default/src/features/auth/lib/storage.ts` — 移除邀请码 localStorage 存储
- `web/default/src/routes/__root.tsx` — 移除 aff URL 参数保存
- `web/default/src/lib/oauth.ts` — 移除 OAuth 中的 aff 参数逻辑
- `web/default/src/stores/auth-store.ts` — 从 AuthUser 移除 aff/inviter 字段
- `web/default/src/components/status-badge.tsx` — 移除 `invited` 预设

### 前端 i18n

- `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json` — 移除 25 个邀请/推荐相关翻译键，修改 2 个描述文案
