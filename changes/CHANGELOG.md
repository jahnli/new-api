# 变更日志

仅列当前仍有效的本地定制及必要兼容约束；已撤销的中间方案通过 Git 历史查询。详情见 [details/](details/)。

| 编号 | 日期 | 说明 | 详情 |
|------|------|------|------|
| 002 | 2026-07-09 | 全局品牌统一为 AI Gateway，保留协议及模块兼容标识。 | [详情](details/002-brand-rename.md) |
| 003 | 2026-09-02 | 定制首页 Hero、三步上手和统计动画；底部展示已配置的飞书支持联系人。 | [详情](details/003-homepage-customization.md) |
| 004 | 2026-11-09 | 升级 Lobe 图标依赖并适配安装目录别名与 .mjs 动态加载；开发服务使用本地端口配置。 | [详情](details/004-frontend-build-config.md) |
| 005 | 2026-06-19 | 移除开发环境 devtools 面板 | `web/src/routes/__root.tsx` |
| 006 | 2026-06-19 | 删除 About 页面及所有相关引用 | [详情](details/007-remove-about.md) |
| 007 | 2026-06-19 | 删除兑换码管理界面及前端引用 | [详情](details/008-remove-redemption-frontend.md) |
| 008 | 2026-06-19 | 移除后端兑换码接口、模型与配置；启动时尝试删除旧 redemptions 表。 | [详情](details/009-remove-redemption-backend.md) |
| 009 | 2026-07-16 | Toast 关闭按钮置于右上角，状态颜色使用固定语义配色，不随主题预设变化。 | `web/src/styles/index.css`、`web/src/components/ui/sonner.tsx`、`web/src/styles/theme.css` |
| 010 | 2026-06-19 | 移除 Anthropic 和 Simple Large-font 主题颜色预设 | [详情](details/011-remove-theme-presets.md) |
| 011 | 2026-06-19 | 侧边栏默认 floating，选项按浮动、侧边栏、内嵌排列。 | `web/src/context/layout-provider.tsx`、`web/src/components/config-drawer.tsx` |
| 012 | 2026-06-19 | 侧边栏背景在明暗模式和各预设中使用透明色。 | `web/src/styles/theme.css`、`web/src/styles/theme-presets.css` |
| 013 | 2026-06-23 | 碧空设为默认，移除海风，Lake View 使用薄荷绿；预设隐藏文字标签，侧栏选中及悬停色保持一致。 | [详情](details/014-theme-preset-customization.md) |
| 014 | 2026-06-20 | 侧边栏及配置中的“聊天”统一显示为“快捷方式”，同步多语言。 | [详情](details/015-sidebar-chat-to-shortcuts.md) |
| 015 | 2026-06-20 | 弹层与卡片采用明暗模式底色，不混主题色；对话框页脚与内容背景一致。 | [详情](details/016-dialog-theme-color.md) |
| 019 | 2026-06-20 | 移除邀请码、邀请关系及奖励，清理注册、OAuth、钱包及计费设置；旧列不再读写。 | [详情](details/020-remove-invitation.md) |
| 020 | 2026-09-17 | 移除概览上手步骤、请求示例、推荐操作及折叠状态。 | [详情](details/020-remove-overview-setup-guide.md) |
| 021 | 2026-11-09 | 个人订阅以圆环展示剩余额度，高级额度独立分区；按宽度自适应，区分模型清单加载失败与空配置。 | [详情](details/021-profile-subscription-card.md) |
| 022 | 2026-08-24 | 渠道默认列表和每页 50 条；模型映射顶部添加，新项插入首行。 | [详情](details/022-channel-interface.md) |
| 023 | 2026-11-16 | 公司注册规则独立保存公司、显示名和套餐；飞书/钉钉身份分开使用，保留旧数据升级要求。 | [详情](details/024-ldap-login.md) |
| 024 | 2026-11-16 | OIDC 开启时优先企业统一登录，保留其他已启用方式；登录页采用分栏极光与光球背景，支持动态效果降级。 | [详情](details/025-ldap-default-login.md) |
| 026 | 2026-11-16 | 部门查询与通知读取所属公司飞书凭据；非工作时间通知校验公司、平台和身份，不使用全局应用兜底。 | [详情](details/026-feishu-credentials.md) |
| 027 | 2026-06-23 | 登录与个人信息下发 avatar_url，前端优先用户照片，无图回退。 | [详情](details/028-avatar-url.md) |
| 029 | 2026-11-16 | 保留 OIDC、微信及自定义提供商；OIDC 支持可选静默登录、MFA 和 Casdoor 双向退出，仅首次注册映射资料及套餐。 | [详情](details/029-remove-github-discord-telegram-linuxdo-oauth.md) |
| 032 | 2026-09-05 | 首页与错误页共享飞书联系卡片，通过 FEISHU_SUPPORT_OPEN_ID 配置，未配置隐藏。 | [详情](details/032-feishu-support-contact.md) |
| 034 | 2026-06-23 | 顶部用户菜单显示用户名及角色图标，悬停打开，不重复展示分组。 | [详情](details/034-profile-dropdown-enhance.md) |
| 035 | 2026-09-18 | 概览不展示 FAQ 面板或其飞书文档入口。 | [详情](details/035-faq-panel-redesign.md) |
| 036 | 2026-06-24 | 公告弹窗宽度扩大至 36rem。 | `web/src/components/notification-popover.tsx` |
| 037 | 2026-10-14 | 按公司更新当前生效的同套餐订阅，保留已用且不新增；支持分类额度调整、高级模型限额及幂等预扣、结算与退款。 | [详情](details/037-subscribe-all-users.md) |
| 038 | 2026-06-24 | 系统设置侧栏各分组默认展开，支持 NavCollapsible.defaultOpen。 | `web/src/components/layout/types.ts`、`web/src/components/layout/components/nav-group.tsx`、`web/src/components/layout/config/system-settings.config.ts` |
| 039 | 2026-11-16 | 用户统计、成本中心与分组联动，支持跨页批量操作及删除验证；共享列头筛选与悬停提示。 | [详情](details/039-user-management-table.md) |
| 040 | 2026-07-17 | 日期范围提供 13 项预设，周范围固定周一至周日。 | [详情](details/040-date-picker-presets.md) |
| 041 | 2026-11-09 | 员工资料使用五个独立字段，旧 JSON 列保留但不再读写；OIDC 仅首次注册填充，对外裁剪内部字段。 | [详情](details/041-feishu-field-refactor.md) |
| 042 | 2026-11-09 | 共享用户资料卡按独立字段展示任职信息；手机号、生日、民族、探亲地仅超级管理员可见。 | [详情](details/042-user-profile-hover-card.md) |
| 043 | 2026-11-13 | 多公司数据总览默认本周，按授权范围提供部门统计、人员、排行和趋势；成本中心归属防重复，超级管理员可跨公司汇总。 | [详情](details/043-data-overview.md) |
| 044 | 2026-08-19 | 新增 BP（role=2），数据总览按显式部门配置授权。 | [详情](details/044-add-bp-roles.md) |
| 045 | 2026-07-07 | 管理员、已配部门的 BP 及动态判定的部门负责人可进入数据总览，服务端校验实际范围。 | [详情](details/045-data-overview-access.md) |
| 046 | 2026-11-15 | 概览用量默认当天，展示趋势与常用模型前三项；订阅总额/高级额度分区，钱包展示余额健康和近 24 小时消耗。 | [详情](details/046-overview-subscription-summary.md) |
| 047 | 2026-08-19 | 个人报表周期与超额提醒；HMAC 内部报表接口按 BP 显式部门及负责人关系返回统计，不自动扩大管理员权限。 | [详情](details/047-notify-settings.md) |
| 048 | 2026-08-17 | 按当前授权范围导出 Excel 统计、图表及可选子部门/人员页，费用换算人民币，按需补充未注册成员。 | [详情](details/048-data-overview-export.md) |
| 049 | 2026-11-15 | 定价支持站点货币、跨设备偏好与完整保存精度，规则默认展开；标准档位名称本地化，自定义名称保留。 | [详情](details/049-model-pricing-local-currency.md) |
| 050 | 2026-07-01 | 渠道表格移除「已使用 / 剩余」列及卡片视图中的余额展示，清理相关翻译 | [详情](details/050-remove-channel-balance-column.md) |
| 051 | 2026-11-15 | 个人资料采用可拖动翻转的照片挂绳及静态降级；日志 IP 默认记录，仅超级管理员可切换。 | [详情](details/051-profile-settings.md) |
| 052 | 2026-07-01 | 额度消耗按 50%/80% 阈值使用绿、橙、红；子部门金额格式化兼容缺省值。 | [详情](details/052-progress-bar-color-unify.md) |
| 053 | 2026-10-15 | 新增或未定价模型默认开启补全及缓存读取价格，表达式草稿包含零值缓存读取，已有配置保留。 | `web/src/features/system-settings/models/model-pricing-core.ts`、`web/src/features/system-settings/models/model-pricing-sheet.tsx` |
| 054 | 2026-07-01 | 模型广场及定价编辑器默认每页 100 条。 | `web/src/features/pricing/constants.ts`、`web/src/features/system-settings/models/model-ratio-visual-editor.tsx` |
| 055 | 2026-10-19 | 分组供应商倍率按统一优先级计费，定价响应加密；超级管理员维护有序推荐，广场按可见范围展示并自动横滑。 | [详情](details/055-pricing-square.md) |
| 056 | 2026-11-16 | 使用日志完善筛选、Token 语义统计和超级管理员导出；整合请求留存、分类通知预览、异常时段及 SMTP 审计。 | [详情](details/056-usage-logs-user-column.md) |
| 057 | 2026-10-06 | 看板与 Flow 共用日期/粒度筛选，默认当天；管理员用户消耗分析及四类 Token 聚合统一。 | [详情](details/057-dashboard-filters.md) |
| 058 | 2026-11-15 | 在线生图按型号配置生成/参考图编辑，支持流式与适用 GIF/SVG；并发单图、即时结果、排队保存，审计与历史共用开关。 | [详情](details/058-online-image-generation.md) |
| 059 | 2026-07-04 | 排行榜 Token 数字仅超级管理员可见，热门模型悬浮列表显示连续排名。 | [详情](details/059-rankings-token-visibility.md) |
| 060 | 2026-09-10 | 密钥默认用户分组，编辑展开高级设置；快速导入使用当前 Origin，Codex 保留 /v1。 | [详情](details/060-api-keys-name-truncate.md) |
| 061 | 2026-11-16 | 普通注册、后台建号和 OIDC 首次注册按公司规则自动分配套餐，失败不阻断建号，后续登录不重复分配。 | [详情](details/061-registration-auto-subscribe.md) |
| 062 | 2026-08-27 | 普通管理员按授权进入渠道界面，模型/订阅/系统入口仅超级管理员；角色变更刷新认证版本并清理权限。 | [详情](details/062-admin-entry-permissions.md) |
| 063 | 2026-07-06 | 本地访问限流默认关闭：全局 API/Web、关键接口和搜索限流默认禁用 | `common/init.go` |
| 064 | 2026-09-14 | 周报按历史计费快照汇总 Token、费用和 Top 5 模型；缓存写入计入输入及命中率分母。 | [详情](details/064-weekly-stats-script.md) |
| 065 | 2026-08-04 | 演示模式遮罩身份、价格、渠道及模型敏感信息，停止资料和请求内容加载，保存时保留其他设置。 | [详情](details/065-user-demo-mode.md) |
| 067 | 2026-09-30 | 用户、密钥和各日志分页独立；模型/供应商/部署/渠道改用内存分页，刷新恢复默认。 | [详情](details/067-pagination-isolation.md) |
| 068 | 2026-08-10 | 图片审计从消费日志补充实际渠道，身份和渠道复用日志展示，耗时独立列。 | [详情](details/068-image-audit-channel-column.md) |
| 069 | 2026-08-21 | BP 可见范围由 overview_dept_ids 显式配置，最多 100 部门，父节点含子树且支持跨公司；旧 bp_level 不自动转换。 | [详情](details/069-bp-level-overview.md) |
| 072 | 2026-10-20 | 渠道自动启停飞书通知及错误阈值告警，支持窗口、冷却与统计降级，提供错误日志和渠道跳转。 | [详情](details/072-feishu-channel-status-notify.md) |
| 073 | 2026-09-03 | 渠道分组字段长度由 64 扩展至 1024 个字符，支持为单个渠道配置更多分组 | `model/channel.go` |
| 074 | 2026-11-13 | 插件市场标题为 Official Plugins，来源仅显示名称，悬停查看 URL。 | [详情](details/074-task-plugin-official-title.md) |
| 075 | 2026-11-16 | EXTERNAL_MODE 控制对外模式并裁剪内部资料和非超级管理员分流分组；统计全时段，支持多销售及客户/结算标签。 | [详情](details/075-external-mode.md) |
| 076 | 2026-09-10 | 前端规范取消强制新增和运行测试的要求。 | `web/AGENTS.md` |
| 077 | 2026-09-22 | 移除前端版本更新入口、发布查询、比较和状态管理。 | [详情](details/077-remove-system-update.md) |
| 078 | 2026-11-13 | 渠道创建/编辑统一居中弹框，高级自定义渠道使用独立图标，移除推荐注册链接。 | [详情](details/078-channel-mutate-dialog.md) |
| 079 | 2026-10-12 | 企业通知正文/图片存 S3，投递最多 10 人并发；公司多选独立发送，删除失败补偿，飞书支持 JSON 2.0 与 Test 标识。 | [详情](details/079-notification-storage-concurrency.md) |
| 080 | 2026-09-19 | 模型管理的新增、补充资料、编辑与定价操作统一改为居中弹框 | [详情](details/080-model-mutate-dialog.md) |
| 081 | 2026-09-22 | 移除上游签到界面、接口、随机奖励和配置，停止迁移签到表，保留旧表。 | [详情](details/081-remove-checkin.md) |
| 082 | 2026-10-28 | 精简渠道内置模型：多渠道清空，OpenAI/Claude/Codex/DeepSeek 保留当前少量项；清空 AWS ID 映射及模型跨区域支持表。 | [详情](details/082-channel-model-lists.md) |
| 083 | 2026-11-06 | 报价同步支持 --group，默认 Basic；忽略大小写、去除首尾空白，拒绝空值或非唯一匹配。 | `scripts/sync_price_sheet.py` |
