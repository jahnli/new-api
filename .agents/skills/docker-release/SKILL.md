---
name: docker-release
description: 用于触发 Docker 构建、发布镜像或调用 /docker-release。运行 jahnli/new-api 的 docker-release.yml，默认等待完成并返回实际镜像 tag、构建结果和运行链接。
---

# Docker Release

## 范围与默认值

- 仓库：`jahnli/new-api`；工作流：`docker-release.yml`；[工作流页面](https://github.com/jahnli/new-api/actions/workflows/docker-release.yml)。全部 GitHub 操作使用 `gh`，显式指定仓库。
- 请求构建或调用技能即授权触发一次，无需重复确认；仅编辑或解释技能时不触发。
- ref 使用用户指定的远端分支或标签，否则查询远端默认分支。`reason` 使用用户原文，否则为 `Manual Docker Release via agent`。
- 仅构建远端代码，不顺带提交、推送、创建标签或修改配置。要求构建未提交或未推送代码时，说明限制并询问远端 ref。

## 1. 核实远端定义

确认 `gh` 可用并已登录，查询默认分支及工作流状态：

```sh
gh auth status --hostname github.com
gh api repos/jahnli/new-api --jq .default_branch
gh api repos/jahnli/new-api/actions/workflows/docker-release.yml --jq '{state: .state, path: .path}'
gh api 'repos/jahnli/new-api/contents/.github/workflows/docker-release.yml?ref=<ref>' --jq .content
```

- `<ref>` 在 API URL 中须 URL 编码；解码返回的 Base64，检查默认分支和目标 ref 的定义，相同时只读一次。
- 工作流须为 `active`，默认分支须包含 `workflow_dispatch`。核实输入、默认值和镜像发布行为，以远端定义为准；不自动启用工作流。
- 只询问缺少且无默认值的必填输入。执行前简述仓库、ref、reason 和发布行为。
- `gh` 缺失或未登录时，报告阻塞，提示安装或执行 `gh auth login --hostname github.com`；不读取、打印或索取令牌。

## 2. 触发一次

记录触发前 UTC 时间和已有运行 ID：

```sh
gh run list --repo jahnli/new-api --workflow docker-release.yml --event workflow_dispatch --limit 20 --json databaseId,createdAt,headBranch,headSha,url,status,conclusion
gh workflow run docker-release.yml --repo jahnli/new-api --ref '<ref>' --raw-field 'reason=<reason>'
```

按当前 shell 安全替换占位符，只传远端定义的输入；未定义 `reason` 时省略。不要拼接未转义的用户文本或传入凭据。

退出码成功才报告“触发请求已接受”。超时或响应不明时先查运行记录，不重复触发；鉴权、ref 或参数错误时报告原因，不切换仓库或分支。

## 3. 定位并等待

复用上面的 `gh run list`，最多查询 4 次，间隔约 3 秒：

- 匹配新增 ID、目标 ref 和触发后的创建时间；标签构建还须用 `headSha` 核实目标提交。CLI 返回的 ID 或链接优先使用并核实。
- 无匹配项时报告运行记录尚未出现，附工作流链接；多个候选无法区分时列出链接，说明归属未确认，不直接选最新一条。

找到唯一运行后，轮询同一 ID 至最终结论：

```sh
gh run view <run-id> --repo jahnli/new-api --json databaseId,url,status,conclusion,headBranch,headSha,event
```

每次等待不超过 30 秒，至少每 60 秒更新进度。区分已触发、排队中、运行中和最终结果；只有 `conclusion=success` 才报告成功。查询受阻时返回当前状态和链接，说明结果未取得，不重新触发。

默认等待完成并核实 tag；用户明确要求只触发时，返回当前状态、链接及“版本 tag 尚未核实”。

## 4. 核实结果并交付

成功后读取日志；失败时读取失败日志：

```sh
gh run view <run-id> --repo jahnli/new-api --log
gh run view <run-id> --repo jahnli/new-api --log-failed
```

- 成功：从 `Building version:`、镜像 tags 和推送完成记录核实完整版本 tag，突出显示并附构建结果、运行链接及其他已核实标签（如 `latest`）。不从 SHA 或本地 `git describe` 推测。
- tag 无法核实：明确说明“构建成功，版本 tag 未能核实”，附运行链接。
- 命名空间被脱敏时，仅返回已核实的 `ai-gateway:<tag>`，不猜测用户名或读取秘密补全。
- 失败：概述失败步骤和相关非敏感错误，不粘贴完整日志、泄露密钥或自动重跑。

## 示例

- `/docker-release`：构建远端默认分支，等待完成并返回 tag、结果和链接。
- `触发 Docker 构建，分支 v1，原因：发布渠道管理修复`：构建 `v1`，原样传入原因。
