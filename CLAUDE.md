# CLAUDE.md — AI Gateway / new-api 项目规范

每次会话和每个新任务开始时，在规划、编码、审查或回答项目问题前，必须使用 Read 工具完整读取仓库根目录的 `AGENTS.md`，等待内容返回，并在后续工作中遵循其中全部规则。Claude Code 无法可靠地内联 `@AGENTS.md`；记忆、摘要、grep、局部浏览或先前对话中的提及均不能替代本次完整读取。

- 如果任务涉及 `web/`，在编辑前端文件前还必须使用 Read 工具读取 `web/AGENTS.md`。
- 如果任务符合 `AGENTS.md` 中“计费规则（强制读取）”的定义，在规划或编辑前还必须使用 Read 工具完整读取 `.agents/rules/billing.md`；不符合该定义的任务可跳过。
