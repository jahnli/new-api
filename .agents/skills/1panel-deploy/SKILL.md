---
name: 1panel-deploy
description: 通过 1Panel API 部署 ai-gateway，支持更换镜像标签、强制拉取和重建，并验证部署结果。用于 /1panel-deploy 或查询部署版本。
---

# 1Panel 部署

## 默认配置

- 面板：`http://ai.semi-tech.com:8080/api/v2`；节点：`local`。
- 编排和容器：`ai-gateway`；镜像：`jahnlis/ai-gateway`。
- 应用状态：`http://ai.semi-tech.com:3002/api/status`。
- 用户指定值优先；缺少镜像标签时询问，不默认用 `latest`。
- 部署请求授权一次更新，无需重复确认；强制拉取和重建支持同标签。查询或编辑技能时不部署。
- 使用 API；镜像构建交给 `docker-publish`，不自动提交或推送代码。

## 凭据与鉴权

- 在请求进程内读取根目录 `.1panel.local.json` 的非空字符串 `apiKey`。文件无效时停止；文件不存在时回退到 `ONEPANEL_API_KEY`、当前会话凭据。
- 缺少凭据时提示填写本地文件，并在面板启用 API、配置客户端 IP 白名单。
- 凭据文件须被 Git 和 Docker 忽略。密钥不写入命令或脚本，不展示凭据文件、签名、完整响应、日志、Compose 或 `.env`；只输出非敏感字段和脱敏错误。
- 每次请求使用新的 Unix 秒级时间戳和以下请求头：

```text
1Panel-Timestamp: <timestamp>
1Panel-Token: <小写十六进制签名>
CurrentNode: local
Content-Type: application/json; charset=utf-8
```

本面板已验证 MD5：`hex(md5('1panel' + API-Key + timestamp))`。目标版本支持时优先 HMAC-SHA256：`hex(hmac_sha256(API-Key, '1panel:' + timestamp))`，以 [官方文档](https://1panel.cn/docs/v2/dev_manual/api_manual/) 为准。鉴权失败检查 API 开关、白名单、时钟和算法，不降低安全设置或循环猜测。

## 1. 查询配置

以下接口均为 POST，路径相对 `/api/v2`；要求 HTTP 成功且响应 `code == 200`。

```text
/containers/compose/search
{"page":1,"pageSize":100}

/containers/inspect
{"id":"ai-gateway","type":"compose","detail":"<实际 path>"}

/containers/inspect
{"id":"ai-gateway","type":"container"}
```

- 分页查找名称精确匹配的唯一编排，保留 `name`、`path`、`createdBy`、完整 `env` 和 Compose 于内存。
- 容器 `data` 若为 JSON 字符串先解析，确认唯一目标；记录容器 `Id`、`Image`、`Config.Image`、运行/健康状态和 `RestartCount`。
- 仅修改目标服务的镜像标签，保留其余配置和 Unicode 内容。多服务、变量、锚点、digest 或多文件编排须核实目标和路径，不全局替换或擅自改为 tag。
- 配置和运行标签已符合目标时仅报告；明确要求强制拉取和重建时继续。

## 2. 更新编排

执行前说明目标镜像和短暂中断。生成唯一 UUID，保留原配置和容器/镜像 ID，提交一次：

```text
POST /containers/compose/update
```

```json
{
  "taskID": "<UUID>",
  "name": "<原 name>",
  "path": "<原 path>",
  "detailPath": "<实际修改的 Compose 文件路径>",
  "content": "<仅修改目标镜像的完整 Compose>",
  "createdBy": "<原值>",
  "env": "<完整原值>",
  "forcePull": true
}
```

- 用 JSON 序列化器生成请求体；PowerShell 发送 UTF-8 字节，响应从 `RawContentStream` 按 UTF-8 解码。
- 多文件编排须核实 `detailPath`，不能把逗号拼接的路径当单文件。保留 `env`、其他服务和卷。
- 请求接受不代表部署成功；超时或结果不明先查任务及容器，不重复提交。

## 3. 等待任务

```text
POST /logs/tasks/read
```

```json
{
  "id": 0, "type": "task", "name": "",
  "page": 1, "pageSize": 500, "latest": false,
  "taskID": "<同一 UUID>",
  "taskType": "", "taskOperate": "", "resourceID": 0
}
```

按 `data.totalLines` 分页读取必要日志，每 5–10 秒查询，单次等待不超过 30 秒，每 60 秒内报告进度，最多等待 10 分钟。要求 `taskStatus == 'Success'`，并确认拉取成功、容器 `Recreated` 和 `Started`；日志结束不代表成功。超时或接口状态缺失时报告阻塞，不自动重跑。

## 4. 验证结果

重新查询配置、容器和应用状态，确认：

1. Compose 和 `Config.Image` 均为目标镜像。
2. 要求重建时容器 ID 已改变；记录新旧镜像 ID，同标签镜像 ID 可以不变。
3. 容器为 `running`；有健康检查时须为 `healthy`，无健康检查则注明；记录重启次数。
4. 应用状态接口 HTTP 200、`success == true`；有 `data.version` 时核对目标版本。

失败时报告现状和脱敏错误，不自动改配置或回滚。回滚须有用户授权，并核实原镜像 ID/digest 和数据库迁移兼容性。

最终简要报告目标镜像、任务结果/ID、容器短 ID、运行/健康状态、应用 HTTP 结果及版本；未执行更新时注明仅查询。
