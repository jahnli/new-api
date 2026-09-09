# 新增在线生图功能

**日期**: 2026-09-09

## 涉及文件

- `controller/playground.go` — 将 Playground 中继抽为可复用逻辑，新增图片格式的 Playground 入口。
- `router/relay-router.go` — 新增 `/pg/images/generations` 和 `/pg/images/edits` 路由。
- `middleware/distributor.go` — 让 Playground 图片生成/编辑请求参与模型解析和 relay mode 设置。
- `relay/constant/relay_mode.go` — 支持将 Playground 图片路径识别为图片生成/编辑模式。
- `web/default/src/features/image-studio/` — 新增在线生图前端功能，包含参数配置、生成/编辑面板、结果展示、历史记录、提示词预设和本地存储；补充 gpt-image-2 参数适配、模型专属参数、4K 尺寸预设、自定义尺寸校验、最多 4 张生成、生成进度与停止按钮展示，并让结果参数值支持翻译；生成/编辑请求不再发送 n 参数，多张生成改为并行单图请求，部分失败时保留成功图片、显示灰色失败占位并汇总消费日志，不再弹出 warning toast。
- `web/default/src/routes/_authenticated/image-studio/index.tsx` — 新增在线生图认证路由。
- `web/default/src/hooks/use-sidebar-config.ts` — 注册在线生图路由对应的侧边栏配置。
- `web/default/src/hooks/use-sidebar-data.ts` — 在快捷方式分组中新增“在线生图”入口。
- `web/default/src/routeTree.gen.ts` — 更新 TanStack Router 生成路由树。
- `web/default/package.json`、`web/bun.lock` — 新增前端依赖以支持在线生图功能。
- `relay/image_handler.go`、`constant/context_key.go`、`service/text_quota.go` — 图片生成消费日志写入结构化参数详情，覆盖尺寸、品质、生成数量、背景、输出格式、输出压缩、审核敏感度、水印等配置。
- `relay/helper/valid_request.go` — 图片请求校验新增生成数量上限，超过 4 张时直接拒绝。
- `web/default/src/features/usage-logs/components/dialogs/details-dialog.tsx`、`web/default/src/features/usage-logs/types.ts` — 使用日志详情新增图片参数区块，按结构化字段本地化展示图片生成配置。
- `relay/channel/openai/adaptor.go`、`relay/channel/openai/image_edit_test.go` — OpenAI 图生图支持将前端 JSON data URL 图片转换为 multipart 文件上传，补齐 Content-Length 并增加回归测试，避免上游空图或 EOF。
- `web/default/src/features/image-studio/index.tsx`、`web/default/src/features/image-studio/lib/image-utils.ts` — 历史生成结果支持一键带入图生图，远程图片会先转换为 data URL；重置时清空提示词、参考图、当前结果与错误。
- `web/default/src/features/image-studio/components/generate-panel.tsx`、`web/default/src/features/image-studio/components/result-grid.tsx` — 生成进度文案移除单图预估时间，思考动画加快，清空按钮改为重置。
- `web/default/src/i18n/locales/*.json`、`web/default/src/i18n/locales/_reports/*.json`、`web/default/src/i18n/locales/_extras/*.json` — 补齐图片参数日志详情和并行生成失败占位文案的多语言翻译，并更新同步报告、清理过期额外翻译清单。
- `model/image_studio.go` — 新增 ImageStudioGeneration 数据库模型，含图片元数据（尺寸、格式、大小）和收藏/用量字段，CRUD 方法支持按用户分页查询、收藏标记、用量更新和删除。
- `controller/image_studio_storage.go`、`controller/image_studio_storage_backend.go` — 图片存储由本地磁盘迁移至 MinIO，对象统一写入 `image` 目录，并继续通过 API 提供访问、删除等能力；MinIO 地址、访问账号、访问密码和 Bucket 改由单个 DSN 环境变量配置，并校验连接信息完整性。
- `controller/image_studio_storage_backend_test.go` — 验证 MinIO 对象目录为 `image`、从 DSN 读取 Bucket，以及缺失访问凭据时拒绝初始化。
- `.env.example`、`docker-compose.yml` — 在线生图 MinIO 配置统一使用单个 DSN 环境变量，并说明凭据特殊字符的百分号编码要求。
- `go.mod`、`go.sum` — 引入 MinIO Go SDK 依赖。
- `model/main.go` — 注册 ImageStudioGeneration 模型的数据库迁移。
- `router/api-router.go` — 注册 /api/image-studio 路由组（CRUD + 静态文件访问）。
- `web/default/src/features/image-studio/api.ts` — 新增服务端存储相关 API 调用函数（store/list/delete/clear/favorite/usage）。
- `web/default/src/features/image-studio/types.ts` — 新增服务端数据类型定义（ImageStudioGenerationRecord、StoreImageStudioGenerationPayload 等），并从上游生图请求类型移除 n 字段，保留历史记录中的请求总数和失败图片数量元数据。
- `web/default/src/features/image-studio/lib/storage.ts` — 历史记录存储层重构为调用服务端 API，移除 localStorage 实现；根据请求总数与成功图片数恢复失败占位数量。
- `web/default/src/features/image-studio/hooks/use-image-studio.ts` — 生成完成后调用服务端存储 API 持久化图片，返回服务端 URL 替代 data URL；多张生成按所选数量并行发送不带 n 的单图请求，聚合成功结果、失败数量和各请求消费日志，并移除部分失败 warning toast。
- `web/default/src/features/image-studio/hooks/use-generation-history.ts` — 历史加载改为从服务端 API 获取。
- `web/default/src/features/image-studio/components/result-grid.tsx` — 结果网格适配服务端图片 URL 展示；部分请求失败时追加等量灰色“生图失败”占位卡；大图预览将图片与提示词框统一为最大 960px/92vw 宽度，图片、提示词和操作栏作为整体按视口居中，优化三部分间距并保持缩放与旋转操作。
- `web/default/src/features/image-studio/components/history-panel.tsx` — 历史面板适配服务端数据结构。
- `web/default/src/features/image-studio/constants.ts` — 新增 IMAGE_STUDIO_GENERATIONS API 端点常量；在线生图最大生成数量改为 4。
- `controller/security_audit.go`、`router/api-router.go`、`setting/system_setting/audit_setting.go` — 新增图片审计分页接口与独立开关，默认启用；安全审计路由收紧为仅超级管理员访问，关闭图片审计开关时接口拒绝查询。
- `model/image_studio.go` — 图片生成记录新增安全审计查询，关联用户展示信息并批量加载图片资源，兼容 SQLite、MySQL 和 PostgreSQL。
- `web/default/src/features/security-audit/` — 安全审计新增图片审计页，提供日期与用户筛选、图片缩略图及大图预览、请求内容 Tooltip、生成详情、图片下载和分页；安全审计入口与页面仅超级管理员可见，关闭图片审计开关时隐藏对应区块；图片审计表格默认分页调整为每页 10 条；预览界面移除冗余提示词标签，统一详情标签尺寸；生成详情与请求内容弹框统一为最大 78rem、视口 85% 高度，头像和用户资料展示保持一致并放大详情文字，图片数量改为主题色标签；审计大图预览同步统一图片和提示词宽度、视口居中及三部分间距；请求内容列改为可点击入口，打开参考使用日志布局的独立弹框，左右展示完整提示词与生成参数并支持复制；弹框底部以 `contain` 完整比例展示最多 4 张生成图片，点击图片时叠层打开大图预览且关闭后返回请求内容弹框；头像悬停按需加载并展示完整用户资料卡片；移除图片审计表格详情列；图片审计默认选中本月，非工作时间请求默认筛选当天。
- `web/default/src/i18n/locales/*.json`、`web/default/src/i18n/locales/_reports/*.json` — 补充图片审计界面多语言文案并更新同步报告。
- `constant/context_key.go`、`dto/openai_image.go`、`relay/channel/openai/relay_image.go`、`relay/image_handler.go`、`relay/image_studio_hook.go` — 新增原生 API 生图自动归档链路：从成功响应提取 URL 或 base64 图片，跳过 Playground 重复记录，并在响应完成后异步调度存储。
- `controller/image_studio_relay_hook.go` — 下载或解码原生 API 生成图片，写入对象存储和在线生图历史；失败时清理已存文件，并按配置裁剪超限历史。
- `setting/system_setting/audit_setting.go`、`model/image_studio.go`、`controller/image_studio_storage.go` — 新增原生 API 生图自动保存开关与每用户历史存储上限（1–1000，当前默认 50），列表和裁剪统一读取管理员配置，超限记录连同对象存储图片一并删除。
- `web/src/features/system-settings/security/`、`web/src/features/system-settings/types.ts`、`web/src/i18n/locales/*.json` — 安全审计设置新增自动保存开关和历史上限输入，串接默认值、类型、表单校验、回归测试及七语言文案。
- `model/image_studio.go`、`controller/image_studio_storage.go`、`controller/image_studio_relay_hook.go`、`relay/image_studio_hook.go` — 生图记录采集 User-Agent：ImageStudioGeneration 新增 UserAgent 字段（varchar(512)，随 AutoMigrate 加列），在线生图 UI 存储路径取 `c.Request.UserAgent()`，原生 API 中继路径 ImageAutoRecordInput 携带 `info.ClientApp`；与使用日志同源，仅记录原始 User-Agent 不做客户端名称映射。
- `web/src/features/security-audit/types.ts`、`web/src/features/security-audit/components/image-audit-request-content-dialog.tsx` — ImageAuditItem 新增可选 user_agent 字段，图片审计请求内容弹框在头像右侧模型/模式/时间行下方单独一行完整展示 User-Agent（break-all 不截断），与使用日志请求内容弹框展示口径一致。
- `setting/system_setting/audit_setting.go`、`setting/system_setting/audit_setting_test.go` — 将历史限制拆分为独立的在线生图展示上限与存储上限，保留旧配置键作为存储上限以兼容已有部署；展示上限默认值调整为 20，存储上限默认值调整为 50，并覆盖两个上限的默认值、独立配置和边界钳制。
- `model/image_studio.go`、`model/image_studio_test.go` — 生图记录新增 `hidden_from_studio` 展示隐藏标记；普通历史查询排除隐藏记录，单条移除与清空仅设置隐藏状态，不删除数据库数据；存储裁剪继续统计全部记录并永久删除超限的最旧记录，补充隐藏、清空和裁剪回归测试。
- `controller/image_studio_storage.go`、`controller/image_studio_relay_hook.go` — 历史列表按展示上限查询并向前端下发展示数量；在线生图删除接口改为仅隐藏记录，只有 UI 保存和原生 API 自动归档后的存储裁剪会永久删除数据库记录及 MinIO 图片。
- `web/src/features/system-settings/security/`、`web/src/features/system-settings/types.ts` — 安全审计设置将原历史上限拆分为“在线生图展示上限”和“在线生图存储上限”，分别保存独立配置并补充设置界面回归测试。
- `web/src/features/image-studio/` — 历史加载及新增记录统一使用服务端下发的动态展示上限，前端无服务端响应时的展示兜底值调整为 20；删除和清空文案明确仅从在线生图历史隐藏，补充展示裁剪、删除行为和可访问文案回归测试。
- `web/src/i18n/locales/*.json` — 补齐展示上限、存储上限及历史隐藏行为的七语言文案。
- `model/ability.go` — 分组可用模型按名称倒序返回，使在线生图默认优先选择名称以 g 开头的模型。
- `controller/model_list_test.go` — 补充分组模型名称倒序接口回归测试，固定 `gpt-image` 排在 `dall-e` 前的契约。
- `web/src/features/image-studio/lib/model-params/`、`web/src/features/image-studio/types.ts` — 将模型参数重构为可辨识联合类型和模型适配器注册表，由各适配器集中管理默认值、支持范围、参数校验、配置归一化与请求构建；GPT Image 和 Seedream 参数类型、尺寸及数量约束相互隔离。
- `web/src/features/image-studio/hooks/use-image-studio-state.ts`、`web/src/features/image-studio/hooks/use-image-studio.ts` — 默认选择 `gpt-image-2`，按模型族缓存并恢复参数，模型或分组切换时归一化配置；生成过程中禁用参数和模型切换，单次任务使用启动时的参数快照，避免异步生成期间配置漂移。
- `web/src/features/image-studio/components/generate-panel.tsx`、`web/src/features/image-studio/components/params-panel.tsx`、`web/src/features/image-studio/index.tsx` — 参数面板改为基于当前模型适配器渲染，数量参数下沉至模型专属配置，并统一生成按钮、参考图和模型选择器的禁用状态。
- `web/src/features/image-studio/components/__tests__/*.test.tsx`、`web/src/features/image-studio/hooks/__tests__/generation-progress.test.tsx` — 更新模型专属参数布局测试，并增加生成期间锁定模型与参数控件的回归覆盖。
