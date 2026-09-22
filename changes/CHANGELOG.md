# 变更日志

仅记录二开修改，用于追踪本地定制与上游的差异。详细文件列表见 [details/](details/) 目录。

| 编号 | 日期 | 说明 | 详情 |
|------|------|------|------|
| 001 | 2026-07-05 | 默认前端固定为 default 并彻底移除 classic：清理后端主题切换、classic embed、Docker 构建阶段与前端 workspace | [详情](details/001-default-frontend-only.md) |
| 002 | 2026-07-09 | 全局品牌重命名 New API → AI Gateway，清理后端中继、文档、Electron 与前端脚本中的品牌残留 | [详情](details/002-brand-rename.md) |
| 003 | 2026-09-02 | 首页定制：移除 Footer/开源卡片/CTA 推广区等区块，替换模型标签，优化三步上手与 Hero 轨道动画，并新增统计微光动画、glass 卡片 UI 与飞书联系信息 | [详情](details/003-homepage-customization.md) |
| 004 | 2026-06-19 | 修复前端 dev server 端口冲突 | `web/default/rsbuild.config.ts` |
| 005 | 2026-06-19 | 移除开发环境 devtools 面板 | `web/default/src/routes/__root.tsx` |
| 006 | 2026-06-19 | 删除 About 页面及所有相关引用 | [详情](details/007-remove-about.md) |
| 007 | 2026-06-19 | 删除兑换码管理界面及前端引用 | [详情](details/008-remove-redemption-frontend.md) |
| 008 | 2026-06-19 | 删除后端兑换码功能及数据库表 | [详情](details/009-remove-redemption-backend.md) |
| 009 | 2026-07-16 | Toast UI 优化：关闭按钮移至右上角；状态色改为固定配色，由全局语义颜色变量统一管理（不再跟随主题预设） | `web/default/src/styles/index.css`、`web/default/src/components/ui/sonner.tsx`、`web/default/src/styles/theme.css` |
| 010 | 2026-06-19 | 移除 Anthropic 和 Simple Large-font 主题颜色预设 | [详情](details/011-remove-theme-presets.md) |
| 011 | 2026-06-19 | 侧边栏样式默认值改为 floating，选项顺序调整为浮动→侧边栏→内嵌 | `web/default/src/context/layout-provider.tsx`、`web/default/src/components/config-drawer.tsx` |
| 012 | 2026-06-19 | 侧边栏背景色改为透明（所有主题预设、明暗模式） | `web/default/src/styles/theme.css`、`web/default/src/styles/theme-presets.css` |
| 013 | 2026-06-19 | 主题预设定制：新增碧空并设为默认、移除海风、侧边栏选中色改主题色、移除预设文字标签及翻译、调整预设顺序、修复预设属性 Bug | [详情](details/014-theme-preset-customization.md) |
| 014 | 2026-06-20 | 侧边栏「聊天」菜单重命名为「快捷方式」，含 6 语言翻译 | [详情](details/015-sidebar-chat-to-shortcuts.md) |
| 015 | 2026-06-20 | 弹出层与卡片背景色不再混入主题色，浅/深模式各用纯净底色；dialog footer 去掉背景色，与内容区统一 | [详情](details/016-dialog-theme-color.md) |
| 016 | 2026-06-20 | Lake View 主题预设配色改为 #233633 / #63e2b7 薄荷绿色系 | `web/default/src/styles/theme-presets.css`、`web/default/src/lib/theme-customization.ts` |
| 017 | 2026-06-20 | Lake View 侧边栏选中文字颜色改为 #18a058 | `web/default/src/components/ui/sidebar.tsx`、`web/default/src/styles/theme-presets.css` |
| 018 | 2026-06-20 | 修复侧边栏选中项悬停时文字颜色被覆盖的问题，保持主题色 | `web/default/src/components/ui/sidebar.tsx` |
| 019 | 2026-06-20 | 移除邀请人/邀请码功能（后端模型/控制器/路由、前端组件/类型/i18n、数据库迁移、计费设置默认值残留字段修复） | [详情](details/020-remove-invitation.md) |
| 020 | 2026-09-17 | 移除概览页引导区域：不再展示「开始使用」步骤、推荐操作与请求示例，折叠态与展开记忆一并去除 | [详情](details/020-remove-overview-setup-guide.md) |
| 021 | 2026-09-20 | 个人资料页订阅卡片优化：独立展示订阅状态与额度进度，无订阅记录时完整隐藏，并提升关键信息可读性 | [详情](details/021-profile-subscription-card.md) |
| 022 | 2026-08-24 | 渠道界面优化：默认视图改为列表，视图切换按钮顺序调整为列表→卡片，桌面端默认分页调整为每页 50 条；模型映射添加按钮移至列表顶部，新映射插入首行 | [详情](details/022-channel-interface.md) |
| 023 | 2026-07-20 | 新增 LDAP 登录与飞书/钉钉同步：支持认证、绑定/解绑、按公司 OU 选择同步平台及凭据/邮箱后缀/自动订阅套餐配置，并支持公司显示名称映射 | [详情](details/024-ldap-login.md) |
| 024 | 2026-08-25 | 登录页默认使用 LDAP 登录并优化账号切换界面：LDAP 表单内联展示，标题按登录方式显示企业账号/账号登录，切换入口统一文案与图标，用户名示例移至标签后并调整标签高度 | [详情](details/025-ldap-default-login.md) |
| 025 | 2026-07-21 | 移除 User 表 name 字段，飞书同步的姓名改写入 display_name；LDAP 注册邮箱在配置飞书邮箱后缀时优先用 username + 后缀拼接，未配置后缀则回退 LDAP 邮箱属性 | `model/user.go`、`service/feishu_sync.go`、`controller/ldap.go` |
| 026 | 2026-08-12 | Feishu 凭据改为惰性读取，移除全局环境变量与兜底，凭据与邮箱后缀统一只从 LDAP 公司同步配置读取；同步改为按 syncPlatform 显式三分支 | [详情](details/026-feishu-credentials.md) |
| 027 | 2026-06-23 | 用户头像改用 avatar_url 字段：后端 API 下发 avatar_url，前端头像组件优先展示图片、无图时回退首字母 | [详情](details/028-avatar-url.md) |
| 028 | 2026-06-23 | LDAP 注册时飞书同步改为同步调用，确保首次登录响应即包含头像；SyncFeishuUser 回写 user 指针字段 | `controller/ldap.go`、`service/feishu_sync.go` |
| 029 | 2026-06-23 | 前端类型检查改为 git pre-commit hook 自动执行，移除 Cursor Hook 方案，适用于所有 git 客户端 | `.githooks/pre-commit`、`.cursor/hooks.json`、`web/default/AGENTS.md` |
| 029 | 2026-06-23 | 移除 GitHub、Discord、Telegram、LinuxDO OAuth 登录：删除 User 表 4 个 ID 字段、后端提供商实现、前端设置/登录/绑定界面及所有语言翻译 | [详情](details/029-remove-github-discord-telegram-linuxdo-oauth.md) |
| 030 | 2026-06-23 | 修复 LDAP 系统设置不回显配置，并在保存 LDAP 登录状态后刷新前端状态缓存 | `web/default/src/features/system-settings/auth/section-registry.tsx`、`web/default/src/features/system-settings/hooks/use-update-option.ts` |
| 031 | 2026-06-23 | 清理认证系统设置中已移除 OAuth 提供商的残留前端参数 | `web/default/src/features/system-settings/auth/section-registry.tsx` |
| 032 | 2026-09-05 | 飞书支持联系人入口：后端通过 FEISHU_SUPPORT_OPEN_ID 暴露 openId，首页与错误页复用联系卡片并动态构造 applink；未配置时隐藏 | [详情](details/032-feishu-support-contact.md) |
| 033 | 2026-06-23 | 登录页切换按钮与登录按钮大小统一，去掉多余的 h-11 rounded-lg | `web/default/src/features/auth/sign-in/components/user-auth-form.tsx` |
| 034 | 2026-06-23 | 用户头像下拉菜单增强：头像旁显示用户名、角色标签前加图标（👑🏅🧑‍💼）、下拉菜单改为悬停触发、移除分组显示 | [详情](details/034-profile-dropdown-enhance.md) |
| 035 | 2026-09-18 | 移除概览页常见问答面板，不再展示飞书文档跳转入口 | [详情](details/035-faq-panel-redesign.md) |
| 036 | 2026-06-24 | 系统公告弹窗宽度由 26rem 加大到 36rem | `web/default/src/components/notification-popover.tsx` |
| 037 | 2026-09-20 | 订阅管理增强：全员订阅按公司覆盖、管理员可按人民币金额增减用户总额度、额度重置仅当期生效、套餐按公司限制可见范围；订阅与套餐编辑采用居中弹框及人民币额度标签；新增高阶模型额度限制，支持全局模型与默认比例、用户比例覆盖、额度展示及预扣/结算/退款的周期隔离与幂等记账；高阶额度不足使用专用报错与独立通知，钱包也不足时同时说明两种原因 | [详情](details/037-subscribe-all-users.md) |
| 038 | 2026-06-24 | 系统设置侧边栏菜单默认展开：新增 NavCollapsible.defaultOpen 属性，系统设置下所有分组设为默认展开 | `web/default/src/components/layout/types.ts`、`web/default/src/components/layout/components/nav-group.tsx`、`web/default/src/components/layout/config/system-settings.config.ts` |
| 039 | 2026-09-22 | 用户管理增强：完善用户列表统计、筛选与共享列，支持成本中心配置、分组倍率展示及分组变更时同步固定分组 API 密钥 | [详情](details/039-user-management-table.md) |
| 040 | 2026-07-17 | 日志筛选日期范围选择器快捷预设由 5 个扩展为 13 个（含季度、半年等），新增 dayjs quarterOfYear 插件及 6 语言翻译；周范围统一按周一至周日计算，避免受 locale 周起始日影响 | [详情](details/040-date-picker-presets.md) |
| 041 | 2026-06-25 | 飞书同步改用 directory/v1/employees/mget 单接口，并重构 User 表飞书字段（employee_number→job_number，新增部门、职务、入职日期等字段） | [详情](details/041-feishu-field-refactor.md) |
| 042 | 2026-08-05 | 用户管理表格头像悬停资料卡片：飞书风格展示职级、部门、入职日期等资料字段，敏感字段仅超级管理员可见，并支持公司名称、性别图标与自定义字段解析 | [详情](details/042-user-profile-hover-card.md) |
| 043 | 2026-09-18 | 数据总览增强：完善部门统计、使用分析、排行、日志、导出与权限裁剪；部门统计及模型、模型系列调用分布与消耗排行悬浮提示新增缓存命中率；新增飞书、钉钉、无平台多公司配置与数据隔离，支持 BP 按显式部门配置跨公司查看；部门树按权限加载，部门人员列表展示统一并支持按角色筛选 | [详情](details/043-data-overview.md) |
| 044 | 2026-07-08 | 新增「事业部 AI BP」（role=2）和「中心 AI BP」（role=3）两个用户角色，用户编辑界面支持角色修改，6 语言翻译 | [详情](details/044-add-bp-roles.md) |
| 045 | 2026-07-07 | 数据总览权限开放：BP 角色与部门负责人可访问数据总览，部门树按角色层级自动裁剪，部门负责人改为动态判定 | [详情](details/045-data-overview-access.md) |
| 046 | 2026-06-30 | 概览页汇总卡片右侧面板改为订阅详情：展示当前订阅用量与总额、用量进度条（按百分比变色）、下次重置时间，无订阅时显示空状态；移除余额健康状态与续航天数；订阅计划名称以标签形式展示在标题右侧 | `web/default/src/features/dashboard/components/overview/summary-cards.tsx` |
| 047 | 2026-08-19 | 数据总览通知功能增强：支持数据报告周期推送、部门超额与请假超额提醒；新增供飞书报表通知服务调用的 HMAC 签名内部接口，按 BP 显式部门配置与部门负责人关系返回可访问公司/部门统计及接收人 open_id，支持跨公司 BP 范围且不扩张管理员权限 | [详情](details/047-notify-settings.md) |
| 048 | 2026-08-17 | 数据总览导出功能增强：支持导出当前部门统计数据与图表为 Excel，涵盖子部门详情与用户列表；补充飞书未注册员工姓名、人民币汇率换算及模型系列图表 | [详情](details/048-data-overview-export.md) |
| 049 | 2026-07-01 | 模型定价编辑器支持本地货币输入：可切换以本地货币（如 ¥）输入价格，按系统汇率自动换算，保存时转回 USD；浮点精度优化；表达式阶梯定价模式同步支持本地货币输入与显示 | [详情](details/049-model-pricing-local-currency.md) |
| 050 | 2026-07-01 | 渠道表格移除「已使用 / 剩余」列及卡片视图中的余额展示，清理相关翻译 | [详情](details/050-remove-channel-balance-column.md) |
| 051 | 2026-07-02 | 个人资料页设置调整：移除邮箱旁分组显示、用户 ID 徽章改为默认色、API 请求数万前加空格；记录使用和错误日志 IP 地址默认开启，且仅超级管理员可见并可切换 | [详情](details/051-profile-settings.md) |
| 052 | 2026-07-01 | 全站进度条分阶段变色统一：阈值统一为 50%/80%（绿→橙→红），涉及概览订阅、用户表格、数据总览；修复子部门统计 formatCNY 传入 undefined 导致崩溃 | [详情](details/052-progress-bar-color-unify.md) |
| 053 | 2026-07-23 | 新增或编辑未设置定价的模型时，补全价格和缓存读取价格默认开启，并补充定价通道初始化测试 | `web/src/features/system-settings/models/model-pricing-core.ts`、`web/src/features/system-settings/models/__tests__/pricing-initialization.test.ts` |
| 054 | 2026-07-01 | 模型广场与模型定价编辑器默认分页大小从 20 改为 100 | `web/default/src/features/pricing/constants.ts`、`web/default/src/features/system-settings/models/model-ratio-visual-editor.tsx` |
| 055 | 2026-09-14 | 模型广场与分组定价优化：新增分组 × 供应商倍率配置与统一计费优先级、定价响应加密、超级管理员「模型广场配置」入口（推荐模型支持自定义使用场景与拖拽排序）、自动循环的顶部推荐模型横滑区及模型卡片悬停边框 | [详情](details/055-pricing-square.md) |
| 056 | 2026-09-17 | 使用日志与审计日志优化：审计日志新增余额与订阅分类及额度调整标记；审计条目归属被操作用户；统一用户信息、请求内容展示与敏感信息权限，统一筛选、弹框与用户身份组件；请求内容弹框新增请求信息区块，直接展示该请求的用量、费用、耗时与路由等运行信息 | [详情](details/056-usage-logs-user-column.md) |
| 057 | 2026-09-02 | 数据看板筛选与统计优化：统一时间范围/粒度/用户名筛选与搜索重置，整合消耗分布与用户排行，quota_data 与图表统一按四类 Token 统计 | [详情](details/057-dashboard-filters.md) |
| 058 | 2026-09-17 | 新增在线生图功能：图片生成/编辑、参数预设与历史记录服务端持久化（S3 兼容对象存储、模型参数按适配器管理），并配套安全审计图片审计页与原生 API 生图自动归档 | [详情](details/058-online-image-generation.md) |
| 059 | 2026-07-04 | 排行榜 Token 可见性与热门模型 Tooltip 优化：所有 Token 数字仅超级管理员可见，热门模型悬停提示右侧显示连续排行编号，并更新 Token 排行相关 6 语言文案 | [详情](details/059-rankings-token-visibility.md) |
| 060 | 2026-09-10 | API 密钥界面优化：名称列截断、创建时默认选中用户分组、编辑时高级设置默认展开，IP 限制列新增「快速导入」下拉（含 CC Switch） | [详情](details/060-api-keys-name-truncate.md) |
| 061 | 2026-07-06 | 新增用户创建后自动订阅套餐：系统设置可选择自动绑定套餐，普通注册、LDAP 首次创建和后台新增用户后创建订阅并记录来源；设置选择框回显套餐名称 | [详情](details/061-registration-auto-subscribe.md) |
| 062 | 2026-08-27 | 管理入口权限细化：模型、订阅管理、系统信息和系统设置仍仅限超级管理员；渠道管理新增默认关闭、可按管理员分配的「渠道界面查看」权限，未授权时隐藏入口并拦截路由；用户角色变更同步刷新认证版本，并按最终角色保存或清理管理员权限 | [详情](details/062-admin-entry-permissions.md) |
| 063 | 2026-07-06 | 本地访问限流默认关闭：全局 API/Web、关键接口和搜索限流默认禁用 | `common/init.go` |
| 064 | 2026-09-14 | 新增 AI 中转站周报统计脚本：按使用日志计费快照拆分输入/输出/缓存 Token 与费用，汇总均价、缓存命中率及费用 Top 5 模型；修正缓存命中率口径，缓存写入计入输入侧与命中率分母 | [详情](details/064-weekly-stats-script.md) |
| 065 | 2026-08-04 | 用户演示模式：个人设置开启后即时生效；渠道页隐藏分组/模型，模型广场遮罩价格、动态计费表达式/分组倍率，使用日志遮罩渠道；用户管理、数据总览、使用日志和安全审计统一以 `***` 脱敏用户名，并隐藏真实头像、资料卡和飞书跳转；更新通知配置不覆盖其他用户设置 | [详情](details/065-user-demo-mode.md) |
| 067 | 2026-08-10 | 全站分页参数隔离：各界面独立保存 pageSize，Usage Logs 与 Security Audit 的不同分区使用独立页码和每页数量；渠道桌面端默认每页 50 条 | [详情](details/067-pagination-isolation.md) |
| 068 | 2026-08-10 | 图片审计新增实际使用渠道列：从请求日志回写真实渠道 ID，查询渠道名称并以使用日志样式展示彩色渠道标签；表格列顺序调整为时间、用户、耗时、图片、请求内容、渠道、模型、模式、参数、费用，耗时拆分为独立列 | [详情](details/068-image-audit-channel-column.md) |
| 069 | 2026-08-21 | 数据总览 BP 可见范围改为显式多部门配置：新增 overview_dept_ids JSON 数组完全替代 bp_level 业务代码，用户编辑支持完整部门树多选 | [详情](details/069-bp-level-overview.md) |
| 071 | 2026-08-19 | 移除中心 BP（role=3）角色：删除后端 RoleCenterBP 常量及所有相关分支，前端去掉 CENTER_BP 选项与翻译，数据库中 role=3 统一替换为 role=2；AI BP 角色改名为 BP（七语言同步更新） | [详情](details/071-remove-center-bp-role.md) |
| 072 | 2026-08-24 | 路由可靠性新增飞书群机器人通知：配置官方 Webhook 后，在渠道确认自动禁用或启用时异步发送群消息，并统一 Midjourney 无可用账号实例的自动禁用链路 | [详情](details/072-feishu-channel-status-notify.md) |
| 073 | 2026-09-03 | 渠道分组字段长度由 64 扩展至 1024 个字符，支持为单个渠道配置更多分组 | `model/channel.go` |
| 074 | 2026-09-05 | 任务插件官方市场标题去除 New API 品牌前缀，统一显示为 Official Plugins，并补齐七语言翻译 | [详情](details/074-task-plugin-official-title.md) |
| 075 | 2026-09-17 | 对外模式：隐藏用户内部信息，后端同步清空相关数据；非超级管理员不可查看或选择分流分组，分流接口省略分组字段；用户列表统计改为全部时间，关闭后恢复当月；切换模式同步刷新状态与列表数据，使任职概况列和统计范围及时更新 | [详情](details/075-external-mode.md) |
| 076 | 2026-09-10 | 前端开发规范移除测试章节及测试强制要求：新增功能、缺陷修复或 UI 行为变更不再强制同步新增或更新测试，提交前不再要求运行受影响测试 | `web/AGENTS.md` |
| 077 | 2026-09-22 | 彻底移除前端系统更新功能：顶栏与系统设置不再提供版本检查入口，并清理发布查询、状态管理及相关多语言文案 | [详情](details/077-remove-system-update.md) |
| 078 | 2026-09-19 | 渠道创建与编辑统一采用居中弹框，并优化头部状态、供应商与连接操作布局 | [详情](details/078-channel-mutate-dialog.md) |
| 079 | 2026-09-16 | 企业通知并发发送与飞书卡片格式优化：发送逻辑从串行改为 10 并发（可配置），飞书卡片正文不再强制首行加粗 | `service/company_notification.go` |
| 080 | 2026-09-19 | 模型管理的新增、补充资料、编辑与定价操作统一改为居中弹框 | [详情](details/080-model-mutate-dialog.md) |
| 081 | 2026-09-22 | 移除用户签到功能：删除每日签到与随机额度奖励、个人资料签到日历、后台签到配置及相关接口和数据模型 | [详情](details/081-remove-checkin.md) |
