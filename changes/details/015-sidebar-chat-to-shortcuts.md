# 侧边栏「聊天」菜单重命名为「快捷方式」

**日期**: 2026-06-20

## 涉及文件

- `web/default/src/hooks/use-sidebar-data.ts` — 侧边栏分组与菜单项标题由 `t('Chat')` 改为 `t('Shortcuts')`
- `web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx` — 管理员侧边栏模块配置中 chat 模块标题与描述更新
- `web/default/src/features/profile/components/sidebar-modules-card.tsx` — 用户侧边栏模块配置中 chat 模块标题与描述更新
- `web/default/src/i18n/locales/en.json` — 新增 `Shortcuts`、`Quick access links to chat applications.`、`Quick access links to chat applications` 翻译键
- `web/default/src/i18n/locales/zh.json` — 同上，中文：快捷方式
- `web/default/src/i18n/locales/fr.json` — 同上，法语：Raccourcis
- `web/default/src/i18n/locales/ja.json` — 同上，日语：ショートカット
- `web/default/src/i18n/locales/ru.json` — 同上，俄语：Ярлыки
- `web/default/src/i18n/locales/vi.json` — 同上，越南语：Lối tắt
