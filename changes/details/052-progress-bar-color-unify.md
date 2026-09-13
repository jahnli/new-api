# 全站进度条分阶段变色统一（50%/80% 阈值）

**日期**: 2026-07-01

## 涉及文件

- `web/default/src/features/dashboard/components/overview/summary-cards.tsx` — 概览页订阅进度条阈值 70/90 → 50/80，颜色改为 emerald/amber/red
- `web/default/src/features/users/components/shared-user-columns.tsx` — 用户表格订阅额度进度条阈值 70/90 → 50/80（颜色不变）
- `web/default/src/features/profile/components/subscription-card.tsx` — 个人资料订阅卡片进度条分阶段变色（已在 #021 记录）
- `web/default/src/features/data-overview/components/sub-department-stats.tsx` — 修复 formatCNY 传入 undefined 导致 TypeError 崩溃
