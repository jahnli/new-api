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
- 不执行独立预检，不提前查询登录状态、工作流状态或工作流定义；直接使用 `gh` 完成发布，不创建临时脚本、包装脚本或额外实现文件。

## 1. 确定 ref

用户指定 ref 时直接使用；未指定时仅查询远端默认分支：

```sh
gh api repos/jahnli/new-api --jq .default_branch
```

简述 ref、原因及发布行为，然后进入触发步骤。实际命令报告 CLI 缺失、未登录或工作流不可用时停止并报告阻塞，不自动启用工作流或索取令牌。

## 2. 触发并定位

记录触发前 UTC 时间和已有运行 ID，再提交一次：

```sh
gh run list --repo jahnli/new-api --workflow docker-publish.yml --event workflow_dispatch --limit 20 --json databaseId,createdAt,headBranch,headSha,url,status,conclusion
gh workflow run docker-publish.yml --repo jahnli/new-api --ref '<ref>' --raw-field 'reason=<reason>'
```

- 安全转义用户输入；默认工作流传入 `reason`，不传凭据。用户指定其他工作流时，仅在确定其输入所必需时读取定义，只传其支持的参数。
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
- `release` 需要核实脱敏镜像的发布仓库或应用版本规则时，可在构建成功后读取本次 `headSha` 对应的远端工作流定义；这属于发布结果核验，不提前执行。
- 失败时简述失败步骤及脱敏错误，不输出完整日志或密钥，不自动重跑。
