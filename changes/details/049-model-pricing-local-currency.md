# 模型定价编辑器支持本地货币输入与档位名称原样回显

**日期**: 2026-09-23

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
- `web/src/features/model-pricing/pricing-amount-input.tsx` — 本地货币换算后的美元价格保留数值精度，不再使用展示格式化结果保存
- `model/model_pricing_conversion.go` — 旧倍率定价迁移为表达式时，普通 Token 档位名称使用“标准”
- `web/src/features/pricing/lib/tier-expr.ts` — 新建可视化配置的默认档位名称使用“标准”
- `web/src/features/system-settings/models/tiered-pricing-editor.tsx` — 预设模板采用“标准”“长上下文”档位名，读取已有表达式时保留原始档位名称
- `web/src/features/system-settings/models/visual-billing-document-editor.tsx` — 档位输入框与卡片标题原样展示名称，输入内容原样写回

## 变更说明

### 2026-09-23：价格精度与档位名称

- 本地货币输入换算为美元后，使用 `String(nextUSD)` 保存数值，不再经 `formatPricingNumber` 舍入，避免展示精度改变实际保存价格；展示格式保持不变。
- 档位名称作为配置数据原样保存、回显：不再将 `base` 自动改成 `standard`，也不再将 `base`、`standard` 翻译为“标准”或将输入的“标准”反向改为英文。
- 新建配置及预设模板中的 `standard` 档位直接使用“标准”；GPT-5.4、Claude Sonnet 4.5 和 GPT-5.4 Priority/Flex 模板中的 `long_context` 直接使用“长上下文”。
- 旧倍率定价的迁移预览生成 `tier("标准", …)`，各项价格、条件及计算逻辑保持不变。
- 已保存表达式不批量改名；其档位按原文展示，需要改名时由管理员编辑并保存。
