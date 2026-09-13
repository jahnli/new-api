# 主题预设定制：新增碧空、移除海风、调整默认与显示

**日期**: 2026-06-19 ~ 2026-06-23

## 变更概要

- 新增 Azure Sky（碧空）主题预设（primary `#0064fa`、secondary `#eaf5ff`），设为默认并置于列表首位
- 移除 Ocean Breeze（海风）主题预设
- 侧边栏选中菜单项文字颜色改为主题色（`text-primary`）
- 移除颜色预设色块下方的名称文字，删除所有 `preset.*` 翻译 key
- 调整预设显示顺序（Lake View 与 Underground 对调）
- 修复非 `default` 预设作为默认值时 `data-theme-preset` 属性不生效的 Bug

## 涉及文件

- `web/default/src/lib/theme-customization.ts` — 新增 `azure-sky`、移除 `ocean-breeze`、默认值改为 `azure-sky`、调整预设顺序
- `web/default/src/styles/theme-presets.css` — 新增 azure-sky light/dark CSS 变量、删除 ocean-breeze CSS 变量
- `web/default/src/components/ui/sidebar.tsx` — 选中态文字颜色 `data-active:text-sidebar-accent-foreground` → `data-active:text-primary`
- `web/default/src/context/theme-customization-provider.tsx` — `data-theme-preset` 属性仅对 `'default'` 预设移除，其余始终设置
- `web/default/src/components/config-drawer.tsx` — 删除预设色块下方名称文字，`aria-label` 改用 `preset.name`
- `web/default/src/i18n/locales/en.json` — 新增 `azure-sky` key、删除 `ocean-breeze` key、删除全部 `preset.*` key
- `web/default/src/i18n/locales/zh.json` — 同上
- `web/default/src/i18n/locales/fr.json` — 同上
- `web/default/src/i18n/locales/ja.json` — 同上
- `web/default/src/i18n/locales/ru.json` — 同上
- `web/default/src/i18n/locales/vi.json` — 同上
