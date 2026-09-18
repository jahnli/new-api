# CLAUDE.md — AI Gateway / new-api 项目规范

@AGENTS.md

## 强制要求：使用 Read 工具读取 AGENTS.md

不得将 `@AGENTS.md` 视为已经加载。Claude Code 无法可靠地内联该导入。

在进行任何规划、编码、审查或回答项目问题之前，必须使用 Read 工具读取仓库根目录的 `AGENTS.md`，并等待其完整内容返回。这是每次会话和每个新任务的第一个操作。

规则：

- 遵循 `AGENTS.md` 中的共享项目规范。
- 不得仅依据记忆、摘要或本文件开始工作。
- 不得因为之前的对话提到过 `AGENTS.md` 而跳过读取。
- 不得使用 grep、glob 或局部浏览代替 Read 工具的完整读取。
- 读取完成后，在后续工作中遵循 `AGENTS.md` 的全部规则。
- 如果任务涉及 `web/`，在编辑前端文件前还必须使用 Read 工具读取 `web/AGENTS.md`。
- 如果任务符合 `AGENTS.md` 中“计费规则（强制读取）”的定义，在规划或编辑前还必须使用 Read 工具完整读取 `.agents/rules/billing.md`；不符合该定义的任务可跳过。
