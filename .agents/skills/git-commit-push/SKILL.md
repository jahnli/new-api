---
name: git-commit-push
description: >-
  按约定式提交规范提交并推送单个或多个 Git 仓库的改动，并处理 GitLab
  提交信息校验失败。本项目默认一次提交后同步推送 GitHub 与 GitLab，不负责自动改写历史。
---

# Git 提交

用于用户要求“提交”“创建 commit”或“提交并推送”时。除非用户明确说“仅本地提交”或“不要推送”，否则“提交”默认包含创建 commit 和推送。提交标题遵循[约定式提交
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

## 推送目标

一个本地仓库只创建一次提交，多个 remote 接收同一个提交。本项目默认推送到以下两个远端，不能因为分支只跟踪其中一个就省略另一个：

| remote | 地址 | 默认目标分支 |
| --- | --- | --- |
| `github` | `https://github.com/jahnli/new-api` | 用户指定分支，否则当前分支 |
| `gitlab` | `https://gitlab.semi-tech.com/eed/ai-gateway` | 与 GitHub 相同 |

- 用户明确要求仅本地提交、仅推某个远端或指定其他目标时，以用户要求为准。
- `upstream`（`QuantumNous/new-api`）仅用于拉取上游更新，不属于默认推送目标；不能遍历所有 remote 推送，也不能向它重试推送。
- 提交前检查实际 remote URL 和目标分支。默认目标缺失或 URL 与上表不符时，先查明配置，不能静默跳过或替换远端。
- 当前 `github` 与 `gitlab` 的 fetch refspec 共用 `refs/remotes/origin/*`；`origin/v1` 不能证明两个远端都已同步。分别用 `git ls-remote --heads github <目标分支>` 和 `git ls-remote --heads gitlab <目标分支>` 核对实际 tip。
- 对其他本地仓库，按用户指定目标或该仓库约定推送；没有多远端约定时使用当前分支配置的上游，不套用本项目的远端地址。

## 提交与核验

- 每个目标仓库依次执行 `git add <明确文件>` 和 `git commit -m "..."`，记录提交哈希，再将同一提交依次推送到所有选定远端。只有用户明确要求仅本地提交时才跳过推送。
- 本项目用户要求“提交到 v1”时，默认依次执行 `git push github v1:refs/heads/v1` 和 `git push gitlab v1:refs/heads/v1`；其他分支替换为实际目标分支。推送前确认所有目标远端都允许快进，推送期间不另外创建提交。
- 不要自动使用 `--amend`、`--no-verify`、`--force`、`rebase` 或修改 Git 配置。
- 提交完成后，逐个仓库检查 `git status --short` 和 `git log -1 --oneline`，报告提交哈希、仓库路径和提交标题。
- 每个远端推送后查询其实际目标 tip，与记录的提交哈希比较。所有选定远端一致才算完成；“Everything up-to-date”也须核对实际 tip。
- 逐个报告 remote、分支和结果。普通推送失败时保留完整错误输出，按下文处理 GitLab 提交信息校验失败；无法恢复时停止后续推送，明确已成功、失败和未执行的目标。保留本地提交供续接，不回滚已成功远端，也不能将部分同步报告为完成。

## GitLab 提交信息校验失败

普通推送明确因 GitLab 提交信息格式或 commitlint 校验失败时，读取并使用 `git-push-skip-lint` skill 的流程。先执行普通推送；确认属于该类失败后，保持失败命令的 remote、分支和 refspec，添加 `-o skip-lint` 重试。本项目通常为 `git push -o skip-lint gitlab v1:refs/heads/v1`，不得改用不存在的 `origin` 或切换到其他远端。

不要因权限、认证、网络、分支落后、non-fast-forward、冲突、测试失败或安全扫描失败使用 `-o skip-lint`。重试仍失败时停止，不要强推、改写历史或继续修改提交。
