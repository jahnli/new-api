# 个人资料页订阅卡片优化

**日期**: 2026-09-20

## 涉及文件

- `web/src/features/profile/components/profile-header.tsx` — 将订阅信息从个人资料头部拆出，避免头部同时承载身份与订阅详情。
- `web/src/features/profile/components/subscription-card.tsx` — 以独立卡片和响应式网格展示订阅状态、剩余天数及额度进度；无订阅记录时不渲染订阅区域；放大方案标题、状态、辅助信息及额度进度文字。
- `web/src/features/profile/index.tsx` — 将订阅卡片接入个人资料页，并把动画容器移至订阅组件的有效内容分支，避免无订阅时遗留空元素。

## 变更说明

订阅进度条按 50% 和 80% 阈值依次使用绿色、橙色和红色。加载期间保留订阅骨架屏；加载完成且没有有效或历史订阅记录时，订阅区域及其动画容器均不进入 DOM。

## 自 CHANGELOG 说明列迁入

由 ProfileHeader 内嵌改为独立卡片组件，横向网格（sm 2 列 / lg 3 列），每个订阅独立圆角卡片展示状态、剩余天数与配额进度；进度条按用量分阶段变色（绿→橙→红）
