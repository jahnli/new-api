# 任务插件官方市场标题与来源展示优化

**日期**: 2026-11-13

## 涉及文件

- `web/src/features/task-plugins/components/marketplace-panel.tsx` — 官方索引标题 “New API Official Plugins” 显示为 “Official Plugins”
- `web/src/features/task-plugins/components/marketplace-source-menu.tsx` — 主站与备用站仅展示名称，当前来源按钮及各来源选项复用共享悬停提示显示 URL，保留原来源切换逻辑
- `web/src/features/task-plugins/__tests__/marketplace-panel.test.tsx` — 覆盖官方标题替换及切换到其他市场源后的标题行为
- `web/src/i18n/locales/en.json` — 新增英文标题及主站、备用站名称
- `web/src/i18n/locales/zh.json` — 新增简体中文标题及主站、备用站名称
- `web/src/i18n/locales/zh-TW.json` — 新增繁体中文标题及主站、备用站名称
- `web/src/i18n/locales/fr.json` — 新增法语标题及主站、备用站名称
- `web/src/i18n/locales/ja.json` — 新增日语标题及主站、备用站名称
- `web/src/i18n/locales/ru.json` — 新增俄语标题及主站、备用站名称
- `web/src/i18n/locales/vi.json` — 新增越南语标题及主站、备用站名称

## 来源悬停提示验证

- 在 `web/` 执行 `bunx --no-install tsgo -b`，类型检查通过
- 在 `web/` 执行 `bunx --no-install oxlint -c .oxlintrc.json src/features/task-plugins/components/marketplace-source-menu.tsx`，静态检查通过
- 在 `web/` 执行 `bunx --no-install oxfmt --check src/features/task-plugins/components/marketplace-source-menu.tsx src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/ja.json src/i18n/locales/ru.json src/i18n/locales/vi.json src/i18n/locales/zh.json src/i18n/locales/zh-TW.json`，格式检查通过
- 在 `web/` 执行 `bun run i18n:sync`，七种语言缺失键和额外键均为零
- 执行 `git diff --check`，差异格式检查通过
