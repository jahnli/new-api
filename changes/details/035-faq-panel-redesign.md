# 常见问答面板重构：移除问答列表，改为插画+外链跳转

**日期**: 2026-06-24

## 涉及文件

- `web/default/src/features/dashboard/components/overview/faq-panel.tsx` — 移除 Accordion 问答列表，改为居中插画图标 + 外链按钮（新标签页跳转飞书文档）；按钮灰色背景、箭头 hover 动画；移除 description 描述文字
- `web/classic/src/components/dashboard/index.jsx` — 注释掉 FaqPanel 导入和渲染
- `web/default/src/i18n/locales/en.json` — 新增 "Click to visit FAQ" 翻译键；移除 "Answers for common access and billing questions"
- `web/default/src/i18n/locales/zh.json` — 同上（中文）
- `web/default/src/i18n/locales/fr.json` — 同上（法语）
- `web/default/src/i18n/locales/ja.json` — 同上（日语）
- `web/default/src/i18n/locales/ru.json` — 同上（俄语）
- `web/default/src/i18n/locales/vi.json` — 同上（越南语）
