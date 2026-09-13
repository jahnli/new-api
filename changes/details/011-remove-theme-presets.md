# 移除 Anthropic 和 Simple Large-font 主题颜色预设

**日期**: 2026-06-19

## 涉及文件

- `web/default/src/lib/theme-customization.ts` — `THEME_PRESETS` 数组移除 `anthropic` 和 `simple-large` 条目，`PRESET_DEFAULT_FONT` 映射移除 `anthropic: 'serif'`，更新相关注释
- `web/default/src/styles/theme-presets.css` — 移除 `data-theme-preset='simple-large'` 和 `data-theme-preset='anthropic'` 两个 CSS 块（含 light/dark 双方案），语义表面桥选择器中去掉对应的 `:not()` 排除项
- `web/default/src/i18n/locales/en.json` — 移除 `preset.anthropic`、`preset.simple-large` 翻译键
- `web/default/src/i18n/locales/zh.json` — 同上
- `web/default/src/i18n/locales/ja.json` — 同上
- `web/default/src/i18n/locales/fr.json` — 同上
- `web/default/src/i18n/locales/ru.json` — 同上
- `web/default/src/i18n/locales/vi.json` — 同上
