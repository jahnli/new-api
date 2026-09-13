# 弹出层和卡片背景色不再混入主题色

**日期**: 2026-06-20

## 涉及文件

- `web/default/src/styles/theme-presets.css` — 移除 `.dark` 预设中 popover 和 card 的背景色混合，浅/深模式各用纯净底色
- `web/default/src/components/ui/dialog.tsx` — dialog footer 去掉背景色（`bg-foreground/[0.03]`），与内容区域统一
