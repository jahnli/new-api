# 企业通知存储与发送

**日期**: 2026-10-12

## 内容和投递

- 正文与图片复用 IMAGE_STUDIO_S3_DSN，保存在 notification/YYYYMMDD-HHmmss.SSS/；按服务器时区的提交/保存时间命名，message.json 与 UUID 图片同层，多接收人共用快照。
- 保留 notification_messages、notification_deliveries 两张业务表，保存摘要、对象路径、收件人及结果；启动不再创建旧 notification_payloads 或搬迁旧数据库内容，升级不能依赖自动内容迁移。
- 预览经权限接口按需加载，不在详情内嵌图片；再次编辑可复用图片引用。删除历史/模板/草稿立即清理对象，失败留补偿记录每 10 分钟重试；中断上传或被替换快照保留 24 小时宽限期。
- 正式、测试、失败重试每条通知最多 10 人并发，逐人持久化结果；仅明确失败可重试，结果不确定不自动重发，取消和超时贯穿上传/发送。

## 公司范围与收件人

- 飞书/钉钉正式发送最多选 100 家公司，全部校验后按公司独立创建快照及记录，使用各自应用；按用户 company 精确匹配，不实时查平台目录，排除软删除、无效身份并在公司内去重，不因账号禁用排除。
- 任一公司无有效收件人阻止发送；执行时部分公司失败返回分公司结果，不自动重发整批。模板/请求兼容旧 company_id，界面预览各公司人数与结果。
- 平台测试按所选每家公司发送到手填最多 20 个标识；邮件正式/测试使用编辑器邮箱，测试最多 20 人并校验地址。输入 @ 后支持常见域名补全，发送中禁止关闭确认框。

## 展示

- 邮件主题保留标题，正文不重复插入标题；Markdown 与附件图片使用等比限宽、圆角样式。
- 飞书使用 JSON 2.0，正文支持一至六级 Markdown 标题、原生表格及图片；需兼容该卡片版本的客户端，旧客户端显示升级提示。
- 飞书测试卡片标题后显示靛蓝色“🏷️ Test”，固定文案不随语言变化；测试状态取自发送记录，首次与重试一致，正式通知不显示，预览同步标识。

入口：`pkg/objectstorage/s3.go`、`pkg/notificationstore/store.go`、`model/notification.go`、`model/notification_storage.go`、`service/notification.go`、`service/notification_worker.go`、`service/notification_sender.go`、`web/src/features/notification/`。

原记录未完成三库实库、S3 清理及飞书客户端投递验证；历史构建结果不替代这些验证。
