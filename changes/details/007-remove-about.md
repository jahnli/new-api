# 移除 About 页面

**日期**: 2026-06-19

移除 About 页面、路由、顶部导航及后台导航配置；相关类型、默认值和专属翻译一并清理。

入口：`web/src/hooks/use-top-nav-links.ts`、`web/src/lib/nav-modules.ts`、`web/src/features/system-settings/maintenance/`；原 web/src/features/about/ 与 routes/about/ 已删除。
