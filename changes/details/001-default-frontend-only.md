# 默认前端与 Classic 移除

**日期**: 2026-07-05

## 涉及文件

- `common/constants.go` — 启动默认主题固定为 default 且仅接受 default 主题设置；legacy `/console/*` 路径始终按新版前端路由重写
- `setting/system_setting/theme.go` — 默认主题配置改为 default
- `common/embed-file-system.go` — 移除按主题切换默认前端与 classic 前端静态资源的文件系统封装
- `controller/option.go` — 系统主题配置仅允许保存 default，拒绝 classic
- `main.go` — 移除 classic 前端的 `go:embed` 资源与 analytics 注入逻辑
- `router/web-router.go` — Web 路由仅挂载 default 前端静态资源，fallback 始终返回 default 首页
- `Dockerfile` — 正式镜像构建移除 classic 前端依赖安装、构建阶段与产物复制
- `Dockerfile.dev` — 开发镜像仅生成 default 前端 embed 占位文件
- `web/package.json` — workspace 移除 classic 包
