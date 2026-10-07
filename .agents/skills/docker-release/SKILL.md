---
name: docker-release
description: 触发 GitHub 仓库 jahnli/new-api 的 Docker Release 工作流（docker-release.yml），默认等待构建完成，返回实际发布的镜像版本 tag、结果和运行链接。用于用户请求“触发 Docker 构建”“构建发布镜像”“运行 docker-release”或调用 /docker-release 时。
---

# 触发 Docker Release

## 目标与授权范围

- 固定仓库：`jahnli/new-api`。
- 固定工作流：`docker-release.yml`。
- 页面：https://github.com/jahnli/new-api/actions/workflows/docker-release.yml
- 使用 GitHub CLI `gh` 执行全部 GitHub 操作，命令必须显式指定仓库。
- 用户调用本技能或明确请求触发构建，即授权执行一次 `workflow_dispatch`。参数明确后直接执行，无需重复确认。
- 如果用户只要求编写、修改或解释技能，仅处理技能文件，不触发构建。
- 本地已知工作流会构建并推送 Docker Hub 的 `ai-gateway:latest` 和版本标签；每次执行前核实远端定义，以远端为准。
- 不顺带提交、推送本地代码、创建标签、修改工作流或仓库配置。构建的是所选远端 ref 的代码。

## 1. 检查环境和远端定义

确认 `gh` 可用，再执行：

```sh
gh auth status --hostname github.com
gh api repos/jahnli/new-api --jq '{default_branch: .default_branch, permissions: .permissions}'
gh api repos/jahnli/new-api/actions/workflows/docker-release.yml --jq '{id: .id, state: .state, path: .path}'
```

若 `gh` 缺失或未登录，报告阻塞及相应操作：安装 GitHub CLI，然后执行 `gh auth login --hostname github.com`。不要读取、打印或要求用户在聊天中粘贴令牌。

工作流必须处于 `active` 状态，且远端默认分支中的定义必须包含 `workflow_dispatch`；不自动启用停用的工作流。

通过 Contents API 获取定义：

```sh
gh api 'repos/jahnli/new-api/contents/.github/workflows/docker-release.yml?ref=<ref>' --jq .content
```

将 `<ref>` 替换为 URL 编码后的实际分支或标签，解码返回的 Base64 内容。先检查默认分支，再检查将构建的 ref；两者相同时只读取一次。核实输入字段、必填项、默认值和发布行为，不依赖本地 YAML 的旧副本。

## 2. 确定分支和参数

- 用户明确指定分支或标签时，使用该 ref。
- 用户未指定时，使用通过 API 查询到的仓库默认分支；不要根据本地当前分支或 `origin` 推断。
- 本地已知输入只有可选字符串 `reason`。用户提供原因时原样传递；否则使用 `Manual Docker Release via agent`。
- 若远端新增了无默认值的必填参数，只询问缺失参数，再继续执行。
- 如果用户要求构建本地未提交或未推送代码，说明远端构建无法包含这些修改，并询问要构建的远端 ref；不要擅自提交或推送。

执行前简短告知仓库、ref、reason 和远端已核实的镜像发布行为。用户已明确授权触发时，该告知不构成新的审批步骤。

## 3. 触发一次构建

记录触发前 UTC 时间，并先读取该工作流最近的手动运行 ID，作为后续查找依据：

```sh
gh run list --repo jahnli/new-api --workflow docker-release.yml --event workflow_dispatch --limit 20 --json databaseId,createdAt,headBranch,headSha,url,status,conclusion
```

将下列占位符替换为已核实的实际值，并按当前 shell 安全传参；不要拼接未经转义的用户文本，不要将凭据放入参数：

```sh
gh workflow run docker-release.yml --repo jahnli/new-api --ref '<ref>' --raw-field 'reason=<reason>'
```

若远端不再定义 `reason`，省略该参数。若有其他输入，仅传递核实过的字段。检查命令退出码，成功才报告“触发请求已接受”。

网络超时或响应不明确时，先查询运行记录确认是否已创建运行；不要直接重复触发。鉴权失败、ref 不存在或参数不合法时，报告具体错误，不改用其他仓库或分支。

## 4. 找到本次运行并交付

短暂等待后查询：

```sh
gh run list --repo jahnli/new-api --workflow docker-release.yml --event workflow_dispatch --limit 20 --json databaseId,createdAt,headBranch,headSha,url,status,conclusion
```

筛选触发前列表中不存在、ref 相符、创建时间位于本次触发时间之后的运行。如果 CLI 直接返回运行 ID 或链接，优先使用并核实。标签构建时结合 `headSha` 校验目标提交，不仅凭 `headBranch` 判断。

最多查询 4 次，每次间隔约 3 秒。没有匹配项时报告“触发请求已接受，运行记录尚未出现”，附工作流页面链接。多个并发运行无法区分时，列出候选链接并说明归属尚未确认；不要把最新一条无条件当成本次运行。

找到唯一运行后读取详情：

```sh
gh run view <run-id> --repo jahnli/new-api --json databaseId,url,status,conclusion,headBranch,headSha,event
```

找到运行后继续等待完成并提取 tag，不能仅返回运行链接就结束。区分“已触发”“排队中”“运行中”和“构建成功”，只有 `conclusion=success` 才能宣称成功。用户明确要求只触发、不等待时，才返回链接及当前状态，并说明版本 tag 尚未核实。

## 5. 等待完成并返回实际发布的 tag

默认轮询同一个 run ID，直到获得最终结论；每次等待不超过 30 秒，工作期间至少每 60 秒更新一次进度。查询受阻时报告当前状态与运行链接，明确尚未取得最终结果，不重新触发构建。

成功后读取本次运行日志：

```sh
gh run view <run-id> --repo jahnli/new-api --log
```

- 从版本生成步骤的 `Building version:` 和构建推送步骤的镜像 tags、`pushing manifest ... done` 等记录中核实实际版本 tag；以远端工作流和本次日志为准。
- 保留 tag 的完整原文，不能根据 `headSha` 截断猜测，也不能用本地 `git describe` 代替远端结果。
- 最终回复必须突出版本 tag（例如 `ef803d20c`），并给出构建结果、本次运行链接和日志已核实的其他标签（例如 `latest`）。
- 镜像命名空间若被日志脱敏为 `***`，只给出已核实的 `ai-gateway:<tag>`；不要猜测 Docker Hub 用户名或读取秘密来补全地址。
- 构建成功但日志不可用或无法提取 tag 时，明确说明“构建成功，版本 tag 未能核实”，附运行链接，不能捏造标签。

失败时使用：

```sh
gh run view <run-id> --repo jahnli/new-api --log-failed
```

总结失败步骤和与失败相关的非敏感错误。不要粘贴完整日志或可能包含密钥的内容，不自动重新运行失败构建。

## 使用示例

- `/docker-release`：使用远端默认分支触发一次构建，等待完成后返回实际版本 tag、构建结果和运行链接。
- `触发 Docker 构建，分支 v1，原因：发布渠道管理修复`：使用 `v1`，将给定原因传入 `reason`。
- `运行 docker-release，构建标签 v1.2.3，并等到完成`：构建指定标签，跟踪同一运行到最终结果。
