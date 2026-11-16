# 移除兑换码界面

**日期**: 2026-06-19

移除兑换码管理、路由、侧边栏入口及钱包兑换输入，清理 API、类型、审计模板、设置和翻译。无在线充值方式时引导联系管理员；后端及旧表处理见 [#008](009-remove-redemption-backend.md)。

入口：`web/src/features/wallet/`、`web/src/hooks/use-sidebar-config.ts`、`web/src/features/system-settings/maintenance/sidebar-modules-section.tsx`。
