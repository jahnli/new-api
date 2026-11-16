# 概览页用量、订阅与钱包面板

**日期**: 2026-11-15

- 用量默认当天，支持 13 种共享时间预设；按所选范围展示 Token、费用、每亿 Token 单价、请求数及趋势，提供 Token 明细和小时汇总延迟说明，切换范围取消旧请求。
- “常用模型”复用同一范围数据，按请求次数展示前三项、品牌图标和完整名称提示，保留加载与空状态。
- 订阅面板展示总额度已用／总额、百分比及重置时间；高级模型额度独立分区，不单列标准额度。无限额度不绘制进度，其他用量按 50%／80% 使用绿、橙、红状态色。
- 额度说明复用明细弹层，数值保留订阅精度；套餐与重置时间适配窄屏换行。
- 钱包模式保留余额健康、近 24 小时消耗与可用时长，优化字号、图标和换行。

## 实现入口

- `web/src/features/dashboard/components/overview/summary-usage-cards.tsx`、`web/src/features/dashboard/components/overview/top-models-summary.tsx` — 用量及常用模型。
- `web/src/features/dashboard/components/overview/subscription-summary.tsx`、`web/src/features/dashboard/components/overview/wallet-summary.tsx` — 订阅与钱包。
- `web/src/lib/date-time-presets.ts`、`web/src/features/dashboard/api.ts` — 时间范围与查询。
