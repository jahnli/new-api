# 概览页用量与订阅额度面板优化

**日期**: 2026-11-12

## 2026-11-12：按时间预设展示用量并精简标题说明

- `web/src/features/dashboard/components/overview/summary-usage-cards.tsx` — 独立用量汇总组件，默认当天，支持 13 种时间预设；按所选范围展示总 Token、费用、每亿 Token 单价、请求数及趋势，Token 数值旁复用明细提示。时间范围与预设选择器并排靠右，标题后的问号悬停展示小时汇总与数据延迟说明。
- `web/src/features/dashboard/components/overview/summary-cards.tsx` — 接入独立用量组件，继续保留右侧订阅或钱包面板及其查询。
- `web/src/features/dashboard/hooks/use-dashboard-config.tsx` — 汇总指标调整为 Token、费用、单价和请求数，并统一图标配色。
- `web/src/features/dashboard/components/ui/stat-card.tsx` — 指标值支持 React 节点，以组合 Token 明细入口。
- `web/src/features/dashboard/api.ts` — 用量查询支持取消信号，切换时间范围时可取消旧请求。
- `web/src/lib/date-time-presets.ts`、`web/src/features/usage-logs/components/compact-date-time-range-picker.tsx` — 复用共享时间预设计算，现有选择器兼容扩展按钮和下拉展示，并支持显式预设状态。
- `web/src/components/description-tooltip.tsx` — 兼容扩展可选图标，概览标题使用问号；沿用共享悬停、键盘焦点与无障碍提示行为。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补充用量说明与时间段指标文案的七语言翻译。

## 2026-11-09：总额度与高级模型额度分区展示

- `web/src/features/dashboard/components/overview/subscription-summary.tsx` — 总额度的已用和总额改为左右分列，总额数字采用次要文字色；总进度条旁展示使用百分比。高级模型额度使用独立浅色面板，显示占总额度比例、已用、总额及进度，不再单列标准模型额度。
- 套餐名称允许换行，适配窄屏；下次重置时间拆分为标签和时间元素并允许换行。用量文字与进度继续沿用 50%／80% 的绿、橙、红阈值。

以下为此前布局的历史记录，当前展示以本节为准。

## 涉及文件

- `web/src/features/dashboard/components/overview/summary-cards.tsx` — 保留完整订阅记录并将当前订阅展示交给独立概览组件，使高级模型额度数据能够进入概览面板。
- `web/src/features/dashboard/components/overview/subscription-summary.tsx` — 主数字展示订阅已用额度 / 总额度，并在高级额度策略启用时以双栏展示标准模型与高级模型的已用额度、额度上限、占比和分阶段进度；无限额度、外部模式或未启用高级额度时展示总额度明细。

## 变更说明

- 订阅面板采用中性浅底、描边套餐标签，主数字按“已用 / 总额”展示，移除“订阅剩余额度”和分类额度的“已使用”标签；总额度问号紧随“当前订阅”标题。标准与高级额度左右排列，以细分隔线区分，两栏底部的用量和进度对齐。钱包模式保留原有背景与展示。
- 总额度明细及分类额度说明复用 `QuotaDetailsPopover`，点击问号可查看已用额度、总额度或分类额度口径。继续复用 `Badge`、`Progress`，不新增弹层实现；现有 `SubscriptionQuotaBreakdown` 的圆环与完整明细布局不适合概览窄栏，沿用概览组件组合现有业务弹层。
- 分类额度按 50%／80% 阈值使用绿、橙、红三档状态色，高级模型保留“占比 xx%”文案。未启用分类额度时展示总额度进度，无限额度不绘制进度条。
- 额度数字沿用订阅模块的精确格式化能力，百分比使用当前界面语言对应的数字格式。
- 下一次重置时间保留在面板底部；本次仅调整概览页订阅面板，不修改钱包页订阅列表和后端额度逻辑。

## 自 CHANGELOG 说明列迁入

概览页汇总卡片右侧面板改为订阅详情：展示当前订阅用量与总额、用量进度条（按百分比变色）、下次重置时间，无订阅时显示空状态；移除余额健康状态与续航天数；订阅计划名称以标签形式展示在标题右侧。
