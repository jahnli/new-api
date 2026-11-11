---
name: git-commit
description: >-
  按约定式提交规范提交单个或多个 Git 仓库的改动，并在用户要求推送时处理
  GitLab 提交信息校验失败。用于创建提交或提交并推送，不负责自动改写历史。
---

# Git 提交

用于用户要求“提交”“创建 commit”或“提交并推送”时。提交标题遵循[约定式提交
(Conventional Commits)](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```text
<type>[optional scope][!]: <description>
```

常用 `type` 包括 `feat`、`fix`、`refactor`、`perf`、`docs`、`test`、`build`、`ci`、`chore` 和 `revert`。标题使用祈使语气、首字母小写、不以句号结尾；破坏性变更在类型后加 `!`，并在正文或页脚写明 `BREAKING CHANGE:`。

## 提交前

1. 确认当前仓库根目录，并检查所有相关仓库的 `git status`、未暂存差异和已暂存差异。
2. 识别本次任务涉及的仓库。单个仓库只创建一个提交；配置了多个仓库时，每个有本次改动的仓库分别创建一个提交，不能把多个仓库的改动合并成一个提交。
3. 只暂存本次任务产生的文件。保留用户已有的无关改动，不使用 `git add -A` 覆盖式暂存，除非已确认工作区全部改动都属于本次任务。
4. 根据实际改动选择最具体的 `type` 和可选 `scope`，检查提交标题是否符合 Conventional Commits。

如果一个仓库有多个 remote，remote 不等同于多个仓库；创建提交仍只做一次。只有用户明确要求推送时才执行推送，并根据当前分支的上游配置使用对应 remote 和 refspec。

## 提交与核验

- 每个目标仓库依次执行 `git add <明确文件>` 和 `git commit -m "..."`。
- 不要自动使用 `--amend`、`--no-verify`、`--force`、`rebase` 或修改 Git 配置。
- 提交完成后，逐个仓库检查 `git status --short` 和 `git log -1 --oneline`，报告提交哈希、仓库路径和提交标题。
- 如果用户要求推送，逐个仓库推送并报告 remote、分支和结果。普通推送失败时，先保留完整错误输出。

## GitLab 提交信息校验失败

只有在用户要求推送，且普通 `git push` 的错误明确指向 GitLab 的 commit message、commitlint、push rule、pre-receive hook 或 lint 校验时，才读取并使用 `git-push-skip-lint` skill 的流程。先执行普通推送；确认属于该类失败后，用相同的 remote、分支和 refspec 添加 `-o skip-lint` 重试。

不要因权限、认证、网络、分支落后、non-fast-forward、冲突、测试失败或安全扫描失败使用 `-o skip-lint`。重试仍失败时停止，不要强推、改写历史或继续修改提交。
