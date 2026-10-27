# 清空渠道内置模型列表及 AWS 模型映射

**日期**: 2026-10-28

## 涉及文件

以下渠道常量文件移除各自内置模型列表：

- `relay/channel/ali/constants.go`
- `relay/channel/baidu/constants.go`
- `relay/channel/baidu_v2/constants.go`
- `relay/channel/claude/constants.go`
- `relay/channel/cloudflare/constant.go`
- `relay/channel/codex/constants.go`
- `relay/channel/cohere/constant.go`
- `relay/channel/coze/constants.go`
- `relay/channel/deepseek/constants.go`
- `relay/channel/gemini/constant.go`
- `relay/channel/jimeng/constants.go`
- `relay/channel/jina/constant.go`
- `relay/channel/lingyiwanwu/constrants.go`
- `relay/channel/minimax/constants.go`
- `relay/channel/mistral/constants.go`
- `relay/channel/mokaai/constants.go`
- `relay/channel/moonshot/constants.go`
- `relay/channel/ollama/constants.go`
- `relay/channel/openai/constant.go`
- `relay/channel/palm/constants.go`
- `relay/channel/perplexity/constants.go`
- `relay/channel/siliconflow/constant.go`
- `relay/channel/submodel/constants.go`
- `relay/channel/tencent/constants.go`
- `relay/channel/vertex/constants.go`
- `relay/channel/volcengine/constants.go`
- `relay/channel/xai/constants.go`
- `relay/channel/xinference/constant.go`
- `relay/channel/xunfei/constants.go`
- `relay/channel/zhipu/constants.go`
- `relay/channel/zhipu_4v/constants.go`

- `relay/channel/aws/constants.go` — 清空模型名称到 Bedrock 模型 ID 的映射及模型跨区域支持配置。
