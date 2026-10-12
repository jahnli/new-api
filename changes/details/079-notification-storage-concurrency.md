# 企业通知对象存储与并发发送

**日期**: 2026-09-28 ~ 2026-10-12

## 2026-10-12 飞书测试通知标识

飞书测试卡片在标题文字后显示靛蓝色「🏷️ Test」标签，发送确认预览同步显示标签图标和固定 `Test` 文案，位置紧跟标题文字。标识不随界面、服务器或飞书客户端语言变化；仅飞书测试通知显示，正式通知不显示。

- `dto/notification.go` — 新增仅供发送过程使用的 `IsTest` 字段，不参与 JSON 序列化或反序列化，不从请求、模板内容读取。
- `service/notification_worker.go` — 在统一投递入口从发送记录读取测试状态，首次发送和失败重试均保留标识。
- `service/notification_sender.go` — 测试卡片使用飞书原生标题后缀标签，颜色设为靛蓝色，文案固定为「🏷️ Test」。
- `web/src/features/notification/components/send-dialog.tsx` — 复用现有 `Badge` 组件，配合标签图标展示浅底深字、细边框和轻阴影，适配深色模式；徽标紧跟标题文字。

验证记录：根目录 `go build ./...`、`git diff --check` 通过；`web/` 下 `bun run typecheck`、`bun x oxlint -c .oxlintrc.json src/features/notification/components/send-dialog.tsx`、`bun x oxfmt --check src/features/notification/components/send-dialog.tsx` 通过。未运行测试或实际发送通知，最终样式尚未在飞书客户端验证。

## 2026-10-12 飞书卡片 Markdown 标题支持

通知正文中的 `#`、`##`、`###` 至 `######` 使用飞书原生 Markdown 渲染为一级至六级标题，标题标记后需留空格。沿用现有表格、图片与正文的排列顺序，以及卡片标题和主题色。

- `service/notification_sender.go` — 飞书卡片声明 `schema: "2.0"`，将内容组件移至 `body.elements`，宽度配置改用 `width_mode: "default"`。
- `service/notification_feishu.go` — 更新表格转换说明，明确继续使用原生表格以保留列对齐与分页配置。

兼容要求：飞书客户端需为 7.20 或以上版本；更低版本可显示卡片标题，正文显示升级提示。参考[飞书 JSON 2.0 富文本文档](https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-json-v2-components/content-components/rich-text)。

验证记录：`gofmt -w service/notification_sender.go service/notification_feishu.go`、`go build ./...` 和 `git diff --check` 均通过。未运行测试或实际发送通知，尚未验证飞书客户端中的实际展示。

## 2026-10-12 公司多选与收件范围限制

飞书、钉钉正式通知从全站收件范围改为仅面向所选公司的成员：根据公司 ID 读取公司名称，再匹配用户资料的 `company` 字段，不实时查询平台通讯录。排除已删除用户，跳过空白或格式无效的收件标识，同一公司内去重；保留原有不按账号启用状态筛选的行为。

公司最多选择 100 家，全部校验通过后再按公司依次发送，每家公司使用自己的应用配置和独立收件快照、发送记录。任一所选公司没有有效收件人时阻止正式发送；部分公司执行失败时返回分公司结果，不自动重发整批。测试发送仍使用手填的最多 20 个收件人，由每家所选公司分别发送；邮件继续使用填写的邮箱地址。

- `controller/notification.go` — 接收公司数组并返回分公司发送结果，兼容旧单公司请求；错误响应补充结构化国际化键与参数。
- `dto/notification.go` — 消息结构新增可选 `company_ids`，用于多公司请求及模板保存。
- `model/notification_audience.go` — 查询收件标识时增加用户公司名称条件。
- `service/notification_audience.go` — 收件人数预览和正式发送统一使用所选公司的成员范围。
- `service/notification.go` — 校验公司数量、重复及无效 ID，预先校验所有公司和消息；按公司构建快照并独立执行发送，保留单公司处理入口。
- `model/notification.go` — 平台投递详情中的用户名筛选及用户资料匹配限制在记录所属公司，避免跨公司同名标识关联错误。
- `web/src/features/notification/components/delivery-settings.tsx` — 复用 `MultiSelect` 实现公司多选，复用 `DescriptionTooltip` 说明发送范围；占位文案为“选择公司”，切换渠道清空所选公司。
- `web/src/features/notification/api.ts` — 并行查询各公司人数并汇总，提交公司数组，兼容单条记录和分公司结果响应。
- `web/src/features/notification/components/send-dialog.tsx` — 展示所选公司及各公司人数，提示测试发送范围，汇总发送结果并提示部分未完成情况；请求失败后刷新历史记录。
- `web/src/features/notification/components/history.tsx`、`web/src/features/notification/components/record-detail.tsx` — 增加公司标识，便于区分各公司的发送记录和失败重试入口。
- `web/src/features/notification/index.tsx` — 校验所选公司与渠道匹配，将公司配置传递给发送确认和历史界面。
- `web/src/features/notification/lib/message.ts` — 校验公司多选与数量上限，将旧模板、历史消息中的单个 `company_id` 转换为公司数组。
- `web/src/features/notification/types.ts` — 补充公司数组、分公司人数、发送结果及历史记录公司字段。
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐公司选择、发送范围、校验和部分失败提示；简化选择公司的占位文案。

验证记录：根目录 `go build ./...` 通过；`web/` 下 `bun run typecheck`、`bun run build` 通过，修改的 8 个前端文件经 `bun x oxlint -c .oxlintrc.json` 和 `bun x oxfmt --check` 检查通过；`bun run i18n:sync` 完成，相关字面量翻译键在全部七种语言中均存在；`git diff --check` 通过。未运行测试或实际发送通知。SQLite、MySQL、PostgreSQL 实库验证仍受环境限制而阻塞，未取得数据库版本及运行结果，不能据此确认三库兼容验证通过。

## 2026-10-06 补记邮箱测试与邮件展示优化

- `web/src/features/notification/components/send-dialog.tsx` — 邮箱测试使用编辑器中填写的收件人，展示邮箱渠道和人数，不再提供飞书或钉钉 ID 输入；正文预览独立滚动。测试确认框支持点击外部空白关闭，发送期间禁止关闭。
- `web/src/features/notification/index.tsx` — 邮箱正式发送与测试均校验收件人存在且邮箱合法，邮箱测试最多允许 20 个收件人。
- `service/notification_sender.go` — 邮件正文移除重复插入的标题，标题保留在邮件主题中；Markdown 图片与附加图片统一使用内联宽度、等比高度及圆角样式，避免超出邮件内容区。
- `web/src/components/confirm-dialog.tsx`、`web/src/components/ui/alert-dialog.tsx` — 共享确认弹框新增可选的点击遮罩关闭能力，默认仍保持原行为，加载时不允许点击遮罩关闭。

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
