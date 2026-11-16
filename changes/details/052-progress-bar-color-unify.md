# 额度进度颜色

**日期**: 2026-07-01

概览订阅、用户共享额度列和个人资料订阅卡片使用 50%/80% 阈值，按消耗进度从绿转橙、红；个人资料的当前圆环呈现见 [#021](021-profile-subscription-card.md)。子部门金额格式化处理缺省数值，避免空数据崩溃。

入口：`web/src/features/dashboard/components/overview/summary-cards.tsx`、`web/src/features/users/components/shared-user-columns.tsx`、`web/src/features/profile/components/subscription-card.tsx`、`web/src/features/data-overview/components/sub-department-stats.tsx`。
