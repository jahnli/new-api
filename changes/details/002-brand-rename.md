# 品牌统一为 AI Gateway

**日期**: 2026-07-09

前后端界面、系统默认名、CLI、错误类型 AIGatewayError、构建产物、Electron 标识及项目文档使用 AI Gateway；品牌帮助入口改用飞书。清理中继、脚本和多语言品牌残留。

保留 Go 模块导入路径、兼容 API 路径及 X-Oneapi-Request-Id 等协议标识，不因品牌替换改变客户端兼容性。

入口：`common/constants.go`、`relaykit/types/error.go`、`main.go`、`web/`、`electron/`、`Dockerfile`、`.github/workflows/`。
