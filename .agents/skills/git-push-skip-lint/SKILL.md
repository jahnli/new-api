---
name: git-push-skip-lint
description: 已获授权的 GitLab 普通推送明确因提交信息格式或 commitlint 被拒绝时，保持原 remote、源和目标 refspec，添加
  skip-lint 选项重试一次；不处理其他 hook、权限或分支失败。
---

# GitLab 提交信息拒绝回退

本技能不固定项目、remote 名称、服务器地址或分支。创建、检查或修改本技能不执行 push。

## 适用条件

必须同时满足：已获目标推送授权，实际目标确认为 GitLab，普通推送已失败，完整输出明确说明提交信息格式或 commitlint 拒绝，例如 `invalid commit message`、`message does not follow`、`body-max-line-length`。

只有 `push rule`、`pre-receive hook declined`、`lint failed` 或一般 rejected 不足以触发回退。权限、认证、网络、保护分支要求 PR、non-fast-forward、测试、构建或安全扫描失败不适用。

## 执行

1. 读取原命令及完整脱敏输出，核对实际目标 URL 和项目授权。复用已有普通失败，不为满足步骤再次普通推送。
2. 保持失败命令的实际 remote/URL、源提交或分支、目标分支及 refspec，仅添加 `-o skip-lint` 重试一次。不根据 tracking ref 猜 remote，不把示例名当成固定值。

   ```text
   普通：git push <原remote> <原source>:refs/heads/<原target>
   重试：git push -o skip-lint <原remote> <原source>:refs/heads/<原target>
   ```

3. hook 不支持 push option 或重试仍失败则停止并报告；不 force、不 amend、不改配置、不改写历史、不改投其他目标。
4. 成功后查询实际 push 目标的分支 tip，与原定提交核对；独立 push URL 不能误用 fetch URL。返回调用流程，继续核验与处理其余已选目标，不能缩减原多远端范围。

报告普通失败原因、是否满足回退条件、是否重试、实际 remote/分支及最终结果。缺原命令或明确拒绝证据时说明缺项，不猜测执行。
