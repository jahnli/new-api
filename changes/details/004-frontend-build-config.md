# 前端图标与构建适配

**日期**: 2026-11-09

- Lobe 图标升级至 6.15 系列，增加配套 UI 依赖；动态加载通过已安装包定位 es 目录、使用别名与 .mjs 模块路径，避免依赖包提升布局。
- 开发服务端口配置为 5173，代理目标可按本地后端端口设置；OIDC 代理 Host 规则见 [#029](029-remove-github-discord-telegram-linuxdo-oauth.md)，定价构建期密钥见 [#055](055-pricing-square.md)。

入口：`web/rsbuild.config.ts`、`web/package.json`、`web/bun.lock`、`web/src/lib/lobe-icon.tsx`。
