# 渠道创建与编辑改为居中弹框

**日期**: 2026-11-13

## 2026-11-13 移除供应商推荐注册链接

- `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx` — 移除 SiliconFlow 类型渠道在创建、编辑弹框中显示的推荐注册链接提示，渠道连接与凭据配置逻辑保持不变。
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 删除推荐链接标签及固定邀请地址的七语言键值，通过临时脚本写入并完成国际化同步。
- 验证：在 `web/` 执行 `bunx --no-install tsgo -b`、`bunx --no-install oxlint -c .oxlintrc.json src/features/channels/components/drawers/channel-mutate-drawer.tsx`，并对修改的组件与七个语言文件执行 `oxfmt --check`，均通过；`bun run i18n:sync` 完成，各语言缺失键与多余键均为零。`git diff --check` 通过，前端源码检索未发现该邀请地址或推荐链接标签残留。

## 涉及文件

- `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx` — 调整弹框头部的响应式网格与操作项布局
- `web/src/assets/brand-icons/advanced-custom.svg` — 新增高级自定义渠道的蓝青紫渐变连接图标
- `web/src/lib/lobe-icon.tsx` — 将高级自定义图标接入共享图标加载器，沿用现有图片渲染与尺寸控制
- `web/src/features/channels/lib/channel-utils.ts` — 高级自定义渠道图标映射改为独立标识，统一供应商选择与渠道列表展示
- `web/src/features/channels/lib/channel-type-config.ts` — 同步高级自定义渠道配置中的图标标识

## 自 CHANGELOG 说明列迁入

渠道创建与编辑由侧边抽屉改为居中弹框：移除新增在右、编辑在左的方向切换及方向状态，两者共用同一弹框，高度为视口 95%；头部、供应商选择区、表单与页脚纵向分区，分隔线贯通整宽，弹框自身内边距归零、各分区统一 24px，避免与内部内边距叠加导致内容内缩 48px；状态徽章与供应商切换按钮从标题旁移至头部标题后的操作区，DOM 顺序保持标题→描述→操作，视觉与 Tab 顺序一致

## 变更说明

- 头部改为响应式网格，标题、供应商按钮、粘贴连接信息与敏感配置操作在桌面端分栏对齐，小屏按可用空间换行
- 状态徽章移至描述行并保持固定宽度，供应商描述过长时截断，避免挤压右侧操作
- 新建、编辑及供应商选择阶段使用不同网格行定位，保持操作顺序和键盘焦点顺序一致
- 高级自定义渠道替换为蓝青紫渐变连接图标，在供应商选择、渠道列表及浅色和深色界面中保持一致造型
