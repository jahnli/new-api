# 在线生图与图片审计

**日期**: 2026-11-15

## 生成与编辑

- 在线生图提供生成、参考图编辑、提示词预设、预览下载、收藏和历史恢复，通过 `/pg/images/generations`、`/pg/images/edits` 复用 Playground 中继、模型分发及真实计费日志。
- 模型适配器分别管理 GPT Image、Seedream 的默认参数、能力、归一化、校验和请求构造；优先选择 gpt-image-2，切换模型族可恢复各自配置，生成使用启动快照并锁定模型与参数。
- GPT Image 按明确型号控制尺寸、品质、背景、压缩、输入保真度、复杂度、流式和输出格式。批次最多 10 张，SVG 限单张；参考图最多 16 张，每张为小于 50 MB 的 PNG/JPEG/WebP，提示词上限 32000 字符，静态自定义尺寸按型号校验。
- 支持适用型号的流式中间预览和 GIF/SVG。GIF 仅自动或自定义尺寸，自定义宽高为正整数且为 16 的倍数，不套用静态图像素预算；帧数 2–16、时长 20–2000 毫秒，不支持流式和压缩，最终组合由上游判定。SVG 只在当前会话展示和下载，不写历史。
- 多图并发发送单图请求，每个请求按 `n: 1` 构建，逐张更新预览、成功或失败占位；结果按原始序号排列，重试沿用原位。单图耗时不含保存，批次耗时取最长请求。
- 成功结果立即展示，历史保存串行排队；保存失败保留结果并提示，生成完成后仍等待保存队列。生成中可停止，保存中显示独立状态，忙碌期间禁用配置及重置。
- 页面仅提供参考图编辑，不提供蒙版或标注图层入口及载荷；该界面边界不代表删除原生 API 的相关协议能力。

## 保存与审计

- `audit_setting.image_studio` 是在线生图保存、现有原生 API 自动归档及图片审计的唯一开关，默认开启，仅超级管理员可修改；归档只覆盖已有响应采集链路，不代表所有提供商、流式或异步接口均支持。
- 文件使用 `IMAGE_STUDIO_S3_DSN` 配置 S3 兼容存储，校验凭据及 Bucket，特殊字符需百分号编码，对象写入 image 目录。历史元数据在数据库，消费日志及扣费独立于保存开关。
- 关闭开关跳过新建及追加图片并返回 `persisted: false`；前端仍临时预览、下载和重试，但不进历史、不更新收藏或用量，刷新后不能恢复，再开启不自动补录。保存中关闭时清理本次已写对象，已有记录保留且仍可查看。
- 展示与存储上限独立，默认分别 20、50，最高 1000；保留 `image_studio_max_history` 作为存储配置键。移除/清空只隐藏，保存后的存储裁剪才永久删除最旧记录及对象，隐藏记录仍计入存储数量。
- 原生 API 成功响应可异步提取 URL/base64 保存，跳过 Playground 重复记录，失败清理已存文件；保存原始 User-Agent，与日志同源。
- 图片审计仅超级管理员可查询，支持日期、用户、图片预览下载和完整请求/参数详情；默认本月、每页 10 条。关闭时隐藏分类、直接访问回退常规审计，服务端拒绝审计查询。实际渠道与列规则见 [#068](068-image-audit-channel-column.md)。

## 主要入口

- `controller/playground.go`、`router/relay-router.go`：图片中继入口。
- `web/src/features/image-studio/`：模型参数、请求与流解析、并发生成、结果和历史。
- `relay/helper/valid_request.go`、`relay/channel/openai/adaptor.go`、`relaykit/dto/openai_image.go`：帧参数及 multipart 协议校验/转发，保留可选字段显式值。
- `model/image_studio.go`、`controller/image_studio_storage.go`、`controller/image_studio_relay_hook.go`、`relay/image_studio_hook.go`：记录、存储、隐藏与自动归档。
- `setting/system_setting/audit_setting.go`、`web/src/features/security-audit/`：配置和审计。

原记录未完成真实生图联调、S3 行为及三库实库验证；这里记录代码行为和限制，不据此宣称提供商能力已联调通过。
