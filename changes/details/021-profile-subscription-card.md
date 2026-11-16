# 个人资料页订阅卡片

**日期**: 2026-11-09

- 订阅从资料头部拆为独立卡片，展示套餐、状态、日期与额度；加载时保留骨架，无订阅记录时不渲染卡片及动画容器。
- 总额度以圆环展示剩余金额、已用、总额和实际使用比例；圆弧限制在 0–100%，零用量不绘制彩色弧线。
- 高级模型额度单独展示占比、已用、总额及进度，不单列标准额度；宽卡片与圆环并排，窄卡片纵向排列。
- 额度颜色按 50%／80% 阈值使用绿、橙、红。高级额度同时受分类上限与订阅剩余额度限制，其用量计入总额度。
- 复用额度明细弹层展示计算说明和高级模型清单，区分加载失败与未配置，长清单可滚动；保留七语言提示。

## 实现入口

- `web/src/features/profile/components/subscription-card.tsx` — 卡片及空状态。
- `web/src/features/subscriptions/components/subscription-quota-breakdown.tsx` — 圆环与高级额度布局。
- `web/src/features/subscriptions/components/subscription-premium-models.tsx`、`web/src/components/quota-details-popover.tsx` — 模型清单与明细。
