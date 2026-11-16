# 主题预设与侧边栏选中态

**日期**: 2026-06-23

- Azure Sky（碧空）为默认且位于首位，移除 Ocean Breeze（海风）；Lake View 使用薄荷绿色系并置于 Underground 之前。
- 预设色块不显示名称文字，使用预设名称作为无障碍标签；非 default 预设始终设置 data-theme-preset，使默认预设正确生效。
- 侧边栏选中项及悬停选中项使用 sidebar-primary，避免悬停色覆盖；各预设提供明暗配色。

入口：`web/src/lib/theme-customization.ts`、`web/src/styles/theme-presets.css`、`web/src/components/ui/sidebar.tsx`、`web/src/context/theme-customization-provider.tsx`、`web/src/components/config-drawer.tsx`。
