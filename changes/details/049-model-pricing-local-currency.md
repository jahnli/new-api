# 定价货币、精度与档位名称

**日期**: 2026-11-15

- 定价编辑支持 USD/站点货币切换，输入按汇率换算，保存还原美元；保留换算后的数值精度，不使用展示舍入值写回，覆盖普通、分档、表达式和插件价格。
- 超级管理员的 pricing_currency 偏好通过 `/api/user/self` 跨设备保存，未设置默认 USD；仅接受独立字段和 USD/site 值，更新保留其他设置，不再使用浏览器本地偏好。
- 价格变更摘要与对比详情统一按站点货币展示，无效配置回退美元，不改变保存价格。
- 可视化定价规则默认全部展开，保留手动折叠。自定义档位名称原样保存；新建配置、迁移预览、普通及任务表达式的默认或首档空名称使用“标准”，条件规格档位保留规格名。
- base、standard 和“标准”在预览、价格拆解及使用日志中按界面语言统一显示；表达式展示仅替换可解析的 tier 名称字面量，自定义名称和无法解析的表达式保留原文。不批量改写已有表达式或历史日志，不改变价格、条件和计费金额。

入口：`web/src/features/model-pricing/`、`web/src/features/system-settings/models/model-pricing-sheet.tsx`、`web/src/features/system-settings/models/visual-billing-document-editor.tsx`、`web/src/features/pricing/lib/billing-expr.ts`、`web/src/features/pricing/lib/task-expr.ts`、`web/src/stores/pricing-preferences-store.ts`、`controller/user.go`、`model/model_pricing_conversion.go`。
