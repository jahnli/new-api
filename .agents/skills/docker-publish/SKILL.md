---
name: docker-publish
description: 触发 jahnli/new-api 的 Docker 发布工作流，等待完成并返回实际镜像标签、结果和运行链接。用于 /docker-publish 或构建发布镜像。
---

# Docker Publish

## 默认配置

- 仓库：`jahnli/new-api`；工作流：`docker-publish.yml`；[工作流页面](https://github.com/jahnli/new-api/actions/workflows/docker-publish.yml)。GitHub 操作使用 `gh`，显式指定仓库。
- 构建请求授权触发一次，无需重复确认；编辑或解释技能时不触发。
- ref 使用用户指定的远端分支或标签，否则查询远端默认分支。`reason` 使用用户原文，否则为 `Manual Docker Publish via agent`。
- 仅构建远端代码，不自动提交、推送、创建标签或修改配置。要求构建本地未推送代码时，说明限制并询问远端 ref。

## 1. 核实工作流

```sh
gh auth status --hostname github.com
gh api repos/jahnli/new-api --jq .default_branch
gh api repos/jahnli/new-api/actions/workflows/docker-publish.yml --jq '{state: .state, path: .path}'
gh api 'repos/jahnli/new-api/contents/.github/workflows/docker-publish.yml?ref=<ref>' --jq .content
```

URL 编码 ref，解码 Base64，检查默认分支和目标 ref 的定义（相同时只读一次）。要求工作流为 `active`、默认分支包含 `workflow_dispatch`；按远端定义核实输入和发布行为，只询问无默认值的缺失必填项。执行前简述 ref、原因及发布行为。

CLI 缺失、未登录或工作流不可用时报告阻塞，不自动启用工作流或索取令牌。

## 2. 触发并定位

记录触发前 UTC 时间和已有运行 ID，再提交一次：

```sh
gh run list --repo jahnli/new-api --workflow docker-publish.yml --event workflow_dispatch --limit 20 --json databaseId,createdAt,headBranch,headSha,url,status,conclusion
gh workflow run docker-publish.yml --repo jahnli/new-api --ref '<ref>' --raw-field 'reason=<reason>'
```

- 安全转义用户输入，只传工作流定义的参数；未定义 `reason` 时省略，不传凭据。
- 命令成功仅代表请求已接受；超时或结果不明先查运行，不重复触发。错误时不擅自切换仓库或 ref。
- 复用 `gh run list`，最多查询 4 次、间隔约 3 秒，匹配新增 ID、目标 ref 和触发时间；标签构建核对 `headSha`。CLI 返回的 ID/链接优先核实。
- 找不到唯一运行时返回工作流或候选链接，说明归属未确认，不直接选最新记录。

## 3. 等待与交付

轮询同一运行 ID，默认等待完成：

```sh
gh run view <run-id> --repo jahnli/new-api --json databaseId,url,status,conclusion,headBranch,headSha,event
```

单次等待不超过 30 秒，每 60 秒内更新进度。仅 `conclusion=success` 表示成功；查询受阻时返回状态和链接，不重新触发。用户只要求触发时，注明镜像标签尚未核实。

成功读取 `--log`，失败读取 `--log-failed`：

```sh
gh run view <run-id> --repo jahnli/new-api --log
```

- 从 `Building version:`、镜像标签及推送完成记录核实实际镜像，返回**完整版本标签**、结果和运行链接，不从 SHA 或本地版本推测。
- 标签无法核实时注明；命名空间被脱敏时仅返回已核实的 `ai-gateway:<tag>`，不猜测。
- 失败时简述失败步骤及脱敏错误，不输出完整日志或密钥，不自动重跑。
