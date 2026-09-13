# 模型定价编辑器支持本地货币输入

**日期**: 2026-07-01

## 涉及文件

- `model/option.go` — 后端注册 ModelPricingInputInLocalCurrency 选项（布尔，默认 false）
- `web/default/src/features/system-settings/types.ts` — ModelSettings/BillingSettings 新增 ModelPricingInputInLocalCurrency 字段
- `web/default/src/features/system-settings/billing/index.tsx` — 计费设置默认值补充新字段
- `web/default/src/features/system-settings/billing/section-registry.tsx` — 模型设置区块注册新字段
- `web/default/src/features/system-settings/models/model-pricing-sheet.tsx` — 定价面板核心逻辑：读取系统汇率配置，本地货币/USD 切换开关，输入值按汇率自动换算，保存时除以汇率还原为 USD；表达式模式显示货币切换并透传 currencySymbol/exchangeRate 给 TieredPricingEditor
- `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx` — 表达式阶梯定价编辑器支持本地货币：VisualTierCard 价格输入/显示按汇率换算，价格后缀徽章跟随货币符号，CostEstimator 输出本地货币金额
- `web/default/src/features/system-settings/models/model-pricing-core.ts` — 预览行价格符号参数化（$ → 动态货币符号）
- `web/default/src/features/system-settings/models/model-pricing-inputs.tsx` — PriceInput/PriceLane 支持 currencySymbol 属性，描述文本参数化
- `web/default/src/features/system-settings/models/model-ratio-form.tsx` — 表单透传 inputInLocalCurrency 属性
- `web/default/src/features/system-settings/models/model-ratio-visual-editor.tsx` — 可视化编辑器透传 inputInLocalCurrency 属性
- `web/default/src/features/system-settings/models/ratio-settings-card.tsx` — 设置卡片绑定 ModelPricingInputInLocalCurrency 开关与持久化
- `web/default/src/features/system-settings/models/pricing-format.ts` — SNAP_EPSILON 精度由 1e-12 调至 1e-9，避免汇率换算后的浮点误差
- `web/default/src/i18n/locales/en.json` — 新增 6 条英文翻译
- `web/default/src/i18n/locales/zh.json` — 新增 6 条中文翻译
