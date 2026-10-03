# 企业通知对象存储与并发发送

**日期**: 2026-09-28 ~ 2026-10-04

## 2026-10-04 邮箱收件人域名补全

- `web/src/features/notification/components/email-recipients-input.tsx` — 新增邮箱收件人输入组件，输入 `@` 后按已输入后缀筛选 `qq.com`、`163.com`、`gmail.com` 候选；支持键盘选择和点击补全，补全后保留或追加分隔符并恢复光标，候选浮层跟随输入光标定位。
- `web/src/features/notification/components/delivery-settings.tsx` — 邮箱收件人字段接入补全组件，保留多收件人拆分及表单引用、失焦处理。
- `web/src/components/ui/popover.tsx` — `PopoverContent` 增加 `anchor` 属性并传入定位器，供收件人候选浮层锚定光标位置。

## 功能说明

- 通知正文与图片复用 `IMAGE_STUDIO_S3_DSN`，保存到 `notification/YYYYMMDD-HHmmss.SSS/`；目录按服务器时区下的提交发送或保存时间命名，`message.json` 与使用 UUID 文件名的图片位于同一层，同一通知的多个接收人共用内容快照。
- 通知数据保留 `notification_messages` 与 `notification_deliveries` 两张表，数据库保存摘要、对象路径、接收人和发送结果；移除数据库内容分块读写及旧结构迁移代码，启动不再创建 `notification_payloads`，不迁移旧数据库内容。
- 删除历史记录、模板或草稿时立即尝试清理对象文件；清理失败时保留内部清理记录，由后台每 10 分钟重试。中断上传与替换后的旧快照保留 24 小时清理宽限期。
- 图片预览通过带权限校验的接口按需读取，详情响应不再内嵌图片数据；再次编辑和发送时可复用已有图片引用。
- 飞书、钉钉和邮箱的正式发送、测试发送及失败重试统一采用每条通知最多 10 个接收人并发，完成后继续分配后续接收人；结果逐人保存，明确失败可重试，结果不确定的接收人不自动重发。
- 延续此前飞书卡片正文不强制首行加粗的格式调整。

## 涉及文件

- `.env.example` — 补充共用 S3 配置、通知目录命名、私有桶权限及存储要求。
- `pkg/objectstorage/s3.go` — 提供共用 S3 配置解析、客户端缓存及对象读写、删除能力。
- `controller/image_studio_storage_backend.go` — 生图存储复用共用 S3 实现。
- `dto/notification.go` — 定义通知内容与图片引用的共享数据结构。
- `pkg/notificationstore/store.go` — 保存通知内容快照和原始图片，校验图片完整性，生成预览引用并按通知目录删除对象。
- `model/notification.go` — 用对象路径替代内容分块，更新发送记录、模板、草稿的保存读取与删除流程，移除载荷模型。
- `model/notification_storage.go` — 在现有消息表中记录上传和清理状态，处理图片访问权限、快照读取失败及对象清理补偿。
- `model/main.go` — 直接注册两张通知表，移除旧通知迁移调用。
- `model/notification_migration.go` — 删除旧表、内容分块及发送尝试记录的迁移实现。
- `controller/notification.go` — 读取对象存储中的消息，校验可复用图片引用并提供受权限控制的图片接口。
- `router/api-router.go` — 注册通知图片读取路由。
- `service/notification.go` — 复用共享消息结构与图片限制，创建通知时传递请求上下文。
- `service/notification_worker.go` — 统一最多 10 人并发调度，串行保存各接收人的发送结果，处理取消与异常，并定期清理存储对象。
- `service/notification_image_upload.go` — 飞书和钉钉图片上传遵循发送上下文的取消与超时。
- `service/notification_sender.go` — 向图片上传传递上下文，保留现有飞书卡片正文格式。
- `web/src/features/notification/api.ts` — 通过现有请求客户端加载图片并转换为预览地址。
- `web/src/features/notification/components/message-content.tsx` — 按会话缓存并按需加载图片引用，支持本地图片与已保存图片预览。
- `web/src/features/notification/index.tsx` — 保存模板后更新编辑器内已复用的图片，避免继续依赖被替换的旧快照。
- `web/src/features/notification/lib/message.ts` — 校验通知图片接口引用。
- `web/src/features/notification/types.ts` — 为图片类型增加可选引用地址。
