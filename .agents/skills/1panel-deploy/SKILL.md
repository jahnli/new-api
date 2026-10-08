---
name: 1panel-deploy
description: 从 .1panel.local.json 读取所选系统的地址和凭据，通过 1Panel API 部署 ai-gateway，支持对内、对外或同时发布、更换镜像标签、强制拉取和重建，并验证部署结果。用于 /1panel-deploy 或查询部署版本。
---

# 1Panel 部署

## 配置来源与目标选择

- 多系统使用根目录 `.1panel.local.json` 的 `targets.internal`（对内）和 `targets.external`（对外），每个目标独立配置 `baseUrl`、`apiKey`、`node`、`statusUrl` 和 `accessUrl`，可选 `host` 用于复用主机地址。`baseUrl` 包含 `/api/v2`，`statusUrl` 是该系统的应用状态接口地址，`accessUrl` 是该系统供使用者访问的完整入口地址，`node` 默认 `local`。`baseUrl`、`statusUrl` 支持完整地址或 `{host}` 占位符，按下文规则在内存中解析后使用；`accessUrl` 只接受完整地址。
- 面板 API 地址、应用状态地址和应用访问地址分别仅从所选目标的 `baseUrl`、`statusUrl` 和 `accessUrl` 读取，不在技能中固定主机或端口，也不在它们之间互相推算。
- 每次独立调用本技能执行部署时，必须使用 AskQuestion 提供单选项，标签严格为“仅对内”“仅对外”“同时发布”，等待用户选择后执行。不要求用户填写 `target`，不通过参数、自然语言目标或 `defaultTarget` 跳过选择。三个选项在内部映射为 `internal`、`external`、`both`。由 `release` 串联调用时，复用该次发布中用户已通过选择项作出的选择，不再次询问。查询在多系统模式下未指定目标时提供“仅对内”“仅对外”“同时查询”三个选项。
- 未知目标或目标配置不完整时停止，不猜测、不切换到另一系统。文件无 `targets` 时停止并提示按目标结构补齐配置。
- 编排和容器：`ai-gateway`；镜像：`jahnlis/ai-gateway`。
- 用户指定值优先；缺少镜像标签时询问，不默认用 `latest`。
- 部署请求授权一次更新，无需重复确认；强制拉取和重建支持同标签。查询或编辑技能时不部署。
- 使用 API；镜像构建交给 `docker-publish`，不自动提交或推送代码。
- 不执行独立预检。进入部署阶段后，直接在请求进程中读取凭据、查询修改编排所需的配置并提交更新；由 `release` 串联时，Docker 发布成功且镜像核实后才开始这些操作。
- 直接使用内联终端命令发送 API 请求，不创建临时脚本、包装脚本或额外实现文件。凭据、签名、Compose、env 和请求体仅保留于进程内存，不写入临时文件。

## 两个系统的执行方式

- 用户选择“同时发布”表示授权更新 `internal` 和 `external`，内部目标为 `both`，无需逐系统再次确认。两套系统使用同一完整镜像引用；“同时发布”指本次覆盖两套系统，实际按下述顺序执行。
- 在部署请求进程内先检查两个目标的本地配置均完整，且面板 API 地址不同；缺项或地址相同时停止，说明需要补齐或修正的目标，不发送更新请求。这是请求进程内的配置校验，不另设远端预检。
- 按 `internal` → `external` 顺序，对每套系统分别完整执行第 1–4 步；每套有独立 UUID、原配置、容器和镜像 ID、日志及核验结果，不能混用凭据或任务上下文。
- 第一套成功或已符合目标并核验通过后，再处理第二套。任一套失败、超时或结果不明时，停止后续更新，保留已成功结果，不自动回滚或重跑。
- 最终逐系统报告成功、失败、阻塞或未执行及原因；只有两套均核验通过才报告全部成功。两个都查询时分别报告查询结果，不执行更新。

## 凭据与鉴权

- 在请求进程内读取根目录 `.1panel.local.json`，仅读取选定目标的非空字符串 `apiKey`、`baseUrl` 和 `statusUrl`（用于鉴权、请求与核验）、`accessUrl`（用于报告应用访问地址），以及解析占位符所需的 `host`。先按下述规则解析地址，再校验为有效的 HTTP(S) URL。`node` 未提供时用 `local`，提供时须为非空字符串。所有请求、任务轮询和核验固定使用同一目标解析后的地址、Key 和节点。`apiKey`、`baseUrl`、`statusUrl` 缺失时停止；`accessUrl` 缺失、非字符串或不是合法 HTTP(S) URL 时不阻断部署，仅在最终报告中注明应用访问地址未核实。
- `baseUrl` 或 `statusUrl` 含 `{host}` 时，使用该目标的非空字符串 `host` 做字面替换（PowerShell：`$url.Replace('{host}', $target.host)`），不执行表达式或环境变量展开。`host` 只能是主机名、IPv4 或带方括号的 IPv6，不得包含协议、端口、路径、用户信息、空白或占位符；`{host}` 只能用于 URL 的主机部分。替换后仍有花括号、主机不合法或 URL 不合法时停止，不发送请求。完整 URL 无需 `host`，保留其原值；不从 `baseUrl` 推算 `statusUrl`；`accessUrl` 不参与占位符替换，直接使用其原值。双系统配置校验、API 调用和最终地址展示均使用解析后的 URL。
- 例如同一目标配置 `"host": "192.0.2.10"`、`"baseUrl": "http://{host}:8080/api/v2"`、`"statusUrl": "http://{host}:3002/api/status"`、`"accessUrl": "https://gateway.example.com/"`，主机地址只需填写一次。JSON 本身不会展开 `{host}`，请求命令必须先执行上述替换；`accessUrl` 已是完整地址，直接使用。
- 文件不存在、无效或所选目标缺少必需字段时停止并提示补齐配置，不回退到顶层 `apiKey`、环境变量、会话凭据或其他目标；不得输出 Key 或签名。
- 缺少凭据时提示填写本地文件，并在面板启用 API、配置客户端 IP 白名单。
- 每次请求使用新的 Unix 秒级时间戳和以下请求头：

```text
1Panel-Timestamp: <timestamp>
1Panel-Token: <小写十六进制签名>
CurrentNode: <所选目标的 node，默认 local>
Content-Type: application/json; charset=utf-8
```

按目标版本和已确认配置选择鉴权算法。MD5：`hex(md5('1panel' + API-Key + timestamp))`；目标版本支持时优先 HMAC-SHA256：`hex(hmac_sha256(API-Key, '1panel:' + timestamp))`，以 [官方文档](https://1panel.cn/docs/v2/dev_manual/api_manual/) 为准。一套系统的算法验证结果不自动适用于另一套。鉴权失败检查 API 开关、白名单、时钟和算法，不降低安全设置或循环猜测。

## 1. 读取部署配置

以下查询用于取得更新所需的原配置和容器信息，不另设预检或重复查询阶段。接口均为 POST，将下列路径追加到所选目标的 `baseUrl`（去掉末尾斜杠），不重复追加 `/api/v2`；要求 HTTP 成功且响应 `code == 200`。

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

执行前说明所选系统、面板 API 地址、目标镜像和短暂中断。生成唯一 UUID，保留原配置和容器/镜像 ID，提交一次：

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
- 读取配置后直接提交更新；仅当期间发生中断或有并发修改迹象时重新读取，发现配置变化则停止，避免覆盖其他操作。
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

最终简要报告所选系统及面板 API 地址、目标镜像、任务结果/ID、容器短 ID、运行/健康状态、应用 HTTP 结果及版本、应用访问地址（取所选目标的 `accessUrl`，缺失或非法时注明未核实）；未执行更新时注明仅查询。

## 调用示例

- `/1panel-deploy`：提供“仅对内”“仅对外”“同时发布”选择项，并询问缺少的镜像标签，随后部署。
- `/1panel-deploy tag=<镜像标签>`：提供“仅对内”“仅对外”“同时发布”选择项，选择后部署。
- “查询对外系统部署版本”：仅查询 `external`。
