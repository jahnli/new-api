---
name: git-commit-push
description: 为单个或多个 Git 仓库创建英文约定式提交，并按用户授权及当前项目配置推送、逐远端核验。目标从各仓库实际配置取得，可处理明确的 GitLab
  提交信息拒绝。
---

# Git 提交与推送

创建、检查或修改本技能不提交或推送。读取各目标仓库适用 AGENTS.md 及[项目配置](../../skill-project.md)的 `git`，已有授权无需重复询问。

## 授权与目标

- “仅本地提交”“不要推送”或限定远端优先遵循。明确要求提交并推送时执行相应阶段；仅说“提交”时，只有项目 `git.push_after_commit` 或现有会话约定为真才含推送，否则只本地提交。
- 各仓库分别解析目标：用户指定优先，其次项目 `git.push_targets`，最后才采用当前分支明确配置的 push remote/refspec。多个 remote 不代表全部推送；目标缺失或映射多义时完成本地准备并说明缺项，不猜 origin 或沿用其他项目地址。
- 配置了目标集合就保留完整集合，不因分支只跟踪一个而漏掉其余。预期 URL 须与 `git remote get-url --push --all <remote>` 核对，包括额外 push URL；不匹配或多出未授权目标时停止推送，不自动改配置或跳过。
- 排除 `read_only_remotes` 和只读上游。分支跟踪 upstream 不构成推送许可，不能遍历所有 remote 或根据 tracking ref 猜目标。用户明确授权其他目标时才按其要求处理。
- 固定源提交和目标分支，查询实际远端 tip 并检查快进关系；共享 tracking namespace 不能证明多个远端已同步。目标分支由用户或项目约定决定，否则用实际当前分支；detached HEAD、wildcard、mirror 或多义映射需先明确。

## 准备与提交

1. 确认各目标仓库根目录，检查状态、未暂存和暂存 diff、任务范围与部分暂存。只暂存本次明确路径或片段，不用 `git add -A` 混入无关内容。
2. 已有无关暂存时，不取消用户暂存，也不直接整库 commit 混入；能安全隔离则只提交任务范围，否则给出具体待决项。无任务差异不造空提交。
3. 默认每仓库为本次逻辑变化创建一次提交；多仓库分别提交，用户要求分拆时遵循。多远端接收同一次提交，推送期间不另外造提交。
4. 用英文 Conventional Commit：`<type>[optional scope][!]: <description>`，标题祈使、小写开头、不加句号；正文与页脚也用英文。破坏性变化标 `!` 并解释 `BREAKING CHANGE:`。按项目要求附 sign-off，使用现有 Git 身份，不改配置。
5. 完成当前项目适用检查，不套用其他项目测试、不跳过当前门槛。失败如实报告，不用 `--no-verify` 掩盖；不自动 amend、rebase 或改写历史。

## 推送与核验

- 已获授权时，对全部选定目标使用显式 remote/refspec 普通推送，如 `git push <remote> <source>:refs/heads/<branch>`。示意值须替换，按实际 shell 安全传参。
- 不自动 force、force-with-lease、改配置或回滚远端。non-fast-forward 按已有授权策略处理，没有策略则保留本地提交并说明，不借提交任务擅自改写历史。
- 每个目标推送后，用 `git ls-remote --heads <remote> refs/heads/<branch>` 核实 tip 等于固定提交；remote 配有独立 push URL 时查询实际 push 目标，不能误查 fetch 地址。含认证信息的 URL 须脱敏。
- 普通失败保留脱敏关键输出。只有实际 GitLab 目标明确拒绝提交信息时才读取同仓库 `git-push-skip-lint`；技能缺失时也只能在满足相同条件后保持原 remote/refspec 添加 `-o skip-lint` 重试一次，其他错误不适用。
- 无法恢复则停止后续推送，报告成功、失败、未执行目标，不回滚已成功目标。回退成功后继续剩余目标。所有目标实际 tip 一致才算同步完成，Everything up-to-date 也须核验。

最后逐仓库查 `git status --short`、`git log -1 --oneline`，报告路径、哈希、英文标题与各远端/分支结果；区分只完成本地提交与完成全部推送。
