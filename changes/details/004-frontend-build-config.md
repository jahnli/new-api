# 前端开发与构建适配

**日期**: 2026-11-09

## 涉及文件

- `web/rsbuild.config.ts` — 移除开发模式证书读取与 HTTPS 配置，端口占用时允许自动切换；新增图标模块目录别名，通过已安装的 `@lobehub/icons/package.json` 定位其 `es` 目录，避免依赖包提升布局。
- `web/package.json` — 移除开发模式 HTTPS 启动命令；将 `@lobehub/icons` 从 `~5.22.0` 升级至 `~6.15.0`，新增 `@lobehub/ui` 依赖 `^6.15.2`。
- `web/.gitignore` — 配合移除开发模式 HTTPS 调整证书相关忽略配置。
- `web/src/lib/lobe-icon.tsx` — 图标懒加载改用图标模块目录别名，模块后缀与动态导入过滤规则由 `.js` 改为 `.mjs`，适配新版图标包结构。
- `web/bun.lock` — 同步图标库升级、配套 UI 依赖及其传递依赖锁定信息。
