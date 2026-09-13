# 日期范围选择器快捷预设扩展

**日期**: 2026-06-24 ~ 2026-07-17

## 涉及文件

- `web/default/src/features/usage-logs/components/compact-date-time-range-picker.tsx` — 快捷预设由 5 个扩展为 13 个（最近一小时、今天、昨天、本周、上周、本月、上月、本季度、上季度、本半年、上半年、本年、去年）；新增周一起始日计算，本周和上周固定按周一至周日取值，不受 locale 配置影响
- `web/default/src/lib/dayjs.ts` — 新增 quarterOfYear 插件支持季度计算
- `web/default/src/i18n/locales/en.json` — 添加新预设英文翻译
- `web/default/src/i18n/locales/zh.json` — 添加新预设中文翻译
- `web/default/src/i18n/locales/fr.json` — 添加新预设法语翻译
- `web/default/src/i18n/locales/ru.json` — 添加新预设俄语翻译
- `web/default/src/i18n/locales/ja.json` — 添加新预设日语翻译
- `web/default/src/i18n/locales/vi.json` — 添加新预设越南语翻译
