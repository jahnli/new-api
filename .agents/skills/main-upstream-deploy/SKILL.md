---
name: main-upstream-deploy
description: 将 GitHub jahnli/new-api 的 main 分支直接合并 QuantumNous/new-api 上游 main，推送后 SSH 到 10.16.7.111，进入部署目录拉取镜像并强制重建 Docker Compose 服务。用于 /main-upstream-deploy，无需逐文件确认，与 v1 无关。
disable-model-invocation: true
---

# main 上游合并与服务器发布

用户调用本技能即授权合并提交、推送 GitHub main，以及通过 SSH 依次执行下列固定的三个命令。连续完成，不询问常规确认，不创建 PR，不套用二开 v1 的逐文件确认、CHANGELOG、复盘或分支清理流程。

## 固定目标

- 仓库：`https://github.com/jahnli/new-api.git`，分支：`main`。
- 上游：`https://github.com/QuantumNous/new-api.git`，分支：`main`。
- SSH 主机：`10.16.7.111`，用户：`root`，端口：`22`。
- 部署目录：`/srv/ai-gateway/new-api`。
- 凭据：读取调用时工作区根目录 `.main-upstream-deploy.local.json`，字段为 `host`、`port`、`username`、`password`、`directory`；该文件必须被 Git 忽略。不要打印密码，也不要将其写入技能、Git、命令行参数或发布日志。

## 执行

1. 记录当前工作区绝对路径，读取本地凭据，并使用 `git check-ignore` 确认凭据文件已被 Git 忽略；未忽略时先停止并报告。凭据仅用于后续 SSH 连接，不在合并阶段连接服务器。
2. 在系统临时目录建立独立克隆，使用 `git clone --branch main --single-branch https://github.com/jahnli/new-api.git <临时目录>`，再添加并拉取上述 upstream main。所有 Git 修改仅发生在临时克隆。记录合并前 main SHA 和 upstream SHA；不切换当前工作区分支，不操作 `v1`，不修改 Git 用户配置。
3. 在临时克隆执行 `git merge --no-edit upstream/main`，无冲突直接完成提交。已包含上游时继续发布。若实际出现冲突，执行 `git merge --abort` 并报告阻塞，不偏向 ours/theirs、不强制覆盖。推送使用 `git push origin HEAD:main`，禁止 force；若远端 main 已前进，重新 fetch、合并 origin/main，无冲突后重试一次。记录最终远端 main SHA。
4. 合并并推送完成后，直接使用可用 SSH 工具连接服务器；没有 SSH 工具时可用 Python Paramiko，从配置文件在进程内部读取密码。优先校验已有 SSH 主机密钥；首次连接保存主机指纹，后续指纹变化必须停止。不要输出包含凭据的完整配置或环境变量。
5. 在同一 SSH shell 中按顺序执行以下三个固定命令，无需再次询问命令内容。每条命令成功后才执行下一条，记录退出码及必要输出；任一命令失败立即停止，报告失败命令及原因，不自行替换命令。

   ```bash
   cd /srv/ai-gateway/new-api
   docker compose pull
   docker compose up -d --force-recreate
   ```

6. 服务器执行范围限于上述三个命令。不增加部署方式探测、构建安装、服务管理或健康检查步骤，不因服务器存在本地修改或未跟踪文件提前停止，也不自行清理、暂存、还原或覆盖这些文件；若指定命令自身因本地修改失败，按实际错误报告。

## 交付

只简要给出 main 最终提交、SSH 服务器，以及三个命令各自的执行结果。全部命令成功时报告命令执行完成，不将命令退出成功描述为已验证服务器运行版本或接口健康。遇到实际阻塞说明失败步骤和原因。创建或修改技能本身不等于调用本技能；用户要求修改本技能时只修改技能文件，只有用户明确要求执行发布时才修改 GitHub 和服务器。
