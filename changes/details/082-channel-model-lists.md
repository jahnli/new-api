# 精简渠道内置模型与 AWS 映射

**日期**: 2026-10-28

- 阿里、百度、百度 v2、Cloudflare、Cohere、Coze、Gemini、即梦、Jina、零一万物、MiniMax、Mistral、MokaAI、Moonshot、Ollama、PaLM、Perplexity、SiliconFlow、Submodel、腾讯、Vertex、火山、xAI、Xinference、讯飞、智谱及智谱 4V 的原内置列表为空。
- OpenAI、Claude、Codex、DeepSeek 当前保留少量内置项，其余旧列表不再提供；实际列表以对应渠道常量为准。
- AWS 清空名称到 Bedrock ID 的模型映射及模型跨区域支持表，保留区域前缀映射。

入口：`relay/channel/` 下对应渠道常量文件及 `relay/channel/aws/constants.go`。
