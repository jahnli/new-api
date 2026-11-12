---
name: git-push-skip-lint
description: >-
  当执行 git push 到 GitLab 因提交信息不规范、commit message lint、commitlint、push rule、server-side hook
  等提交信息校验失败时使用。先正常推送；仅在明确属于提交信息校验失败时，保持同一 remote 和 refspec 添加 `-o skip-lint` 重试。
---

# Git Push Skip Lint Fallback

用于处理 GitLab 推送时因为提交信息不规范或远端 lint/push rule 拒绝导致的失败。

## 适用场景

已获推送授权、普通推送失败，且实际目标是 GitLab、错误明确说明提交信息格式或 commitlint 校验失败时使用，例如：

- `commit message`、`commit-msg`、`commitlint`
- `message does not follow`、`invalid commit message`
- `body-max-line-length` 等提交信息规则失败

只有 `push rule`、`pre-receive hook declined` 或一般 `lint failed` 字样不足以触发重试，必须结合完整输出确认属于提交信息校验。

## 不适用场景

不要因为以下错误使用 `-o skip-lint`：

- 远端有新提交导致 `fetch first`、`non-fast-forward`、`rejected`、`behind`
- 权限、认证、网络、远端不存在、分支保护要求 PR
- 测试失败、构建失败、安全扫描失败
- 用户没有要求推送，或当前操作不是 git push

这些情况应按正常 Git 流程处理，不要跳过校验。

## GitLab lint 远端

重试必须使用失败命令的实际 remote、分支和 refspec，不能根据 tracking ref 名称猜测 remote。本项目 GitLab remote 名为 `gitlab`，不是 `origin`；`refs/remotes/origin/*` 只是共享的本地 tracking 命名空间。

例如普通命令为 `git push gitlab v1:refs/heads/v1`，重试为：

```bash
git push -o skip-lint gitlab v1:refs/heads/v1
```

对应 GitLab 地址：

```ini
[remote "gitlab"]
	url = https://gitlab.semi-tech.com/eed/ai-gateway
	fetch = +refs/heads/*:refs/remotes/origin/*
```

## 工作流程

1. 先执行普通推送命令，保持用户指定的 branch 和 refspec 不变。

   示例：

   ```bash
   git push gitlab dev2:refs/heads/dev2
   ```

2. 如果普通推送成功，返回调用流程，继续核验该远端并完成其余已选远端的推送。

3. 如果普通推送失败，读取完整错误输出，判断是否明确是提交信息不规范或 lint/push rule 拒绝。

4. 只有在确认是提交信息校验失败时，保持同一 remote、branch/refspec，并加上 `-o skip-lint` 重试一次。

   示例：

   ```bash
   git push gitlab dev2:refs/heads/dev2 -o skip-lint
   ```

   或等价写法：

   ```bash
   git push -o skip-lint gitlab dev2:refs/heads/dev2
   ```

5. 如果 `-o skip-lint` 仍失败，停止并把错误原因告知用户，不要继续尝试 force push 或修改 Git 配置。
6. 重试成功后返回调用流程，继续核验该远端并完成其余已选远端的推送；本技能不能将推送范围缩减为一个远端。

## 安全规则

- 不要自动使用 `--force`、`--force-with-lease`。
- 不要修改 git config。
- 不要改写提交历史、不要 amend、不要 rebase，除非用户明确要求。
- `-o skip-lint` 只用于远端 hook 支持 push option 的场景。
- 如果错误是远端落后或冲突，必须先 fetch/merge/rebase 并让用户确认策略，不要用 `skip-lint` 掩盖。

## 输出格式

成功时简洁说明：

- 普通推送是否失败
- 是否已用 `-o skip-lint` 重试
- 最终推送到哪个 remote/branch

失败时说明：

- 普通推送失败原因
- 是否符合 `skip-lint` 条件
- 如果重试也失败，给出远端返回的关键错误
