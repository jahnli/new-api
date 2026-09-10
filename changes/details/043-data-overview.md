# 数据总览页增强与公司配置管理

**日期**: 2026-06-25 ~ 09-10（最后更新 09-10）

### 2026-09-10 部门人员列表展示统一

- `web/src/features/data-overview/components/department-users-table.tsx` — 部门人员列表启用共享用户列的“任职概况”和“时间”合并模式，以两行摘要统一展示部门、岗位职级、入职日期，以及最后登录、创建时间；注册状态列继续紧跟时间列；用户 ID 采用与使用日志一致的弱化文字色，并将页面标题和日志弹窗名称统一为“部门人员列表”。
- `web/src/features/users/components/shared-user-columns.tsx` — 共享用户名列支持按使用场景传入用户 ID 样式，数据总览可单独调整而不影响用户管理等其他页面。
- `web/src/features/data-overview/components/department-overview-skeleton.tsx`、`web/src/features/data-overview/lib/export-excel.ts` — 加载骨架、Excel 工作表名称及导出标题同步使用“部门人员列表”。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补齐“部门人员列表”的七语言文案。
- `web/src/features/data-overview/components/__tests__/department-users-columns.test.tsx` — 测试覆盖合并表头替代五个独立表头，并验证两个合并单元格包含完整信息。

### 2026-09-10 部门树选择器导航与可访问性修复

- `web/src/features/data-overview/components/department-tree-select.tsx` — 禁用的公司或部门祖先节点仍可用于展开其下已授权部门，点击和右方向键均可进入下级；弹层打开时通过组件焦点 API 聚焦搜索框，补充展开状态、键盘焦点与 Enter/空格操作；仅在打开弹层时初始化路径，避免懒加载树更新重置当前导航状态

### 2026-09-07 用户统计弹窗头像+名称展示

- `web/src/features/data-overview/components/user-stats-dialog.tsx` — 用户统计弹窗新增头像+名称展示，仿照请求内容弹窗：标题栏下方用 `UserProfileHoverCard` 包裹 `Avatar`（size-9），右侧显示 `displayName` 和 `username`，鼠标悬停弹出用户资料卡片；`DepartmentUser` 数据映射为 `UserColumnRow` 供悬停卡片使用；`DialogTitle` 移除名称后缀

### 2026-09-02 Token 用量悬浮显示格式统一

- `web/src/features/data-overview/components/department-stats-cards.tsx` — 部门统计卡片 Token 详情与人均 Token Tooltip 统一为 xx.xx 亿格式，移除原始数字展示
- `web/src/features/data-overview/components/sub-department-stats.tsx` — 各部门 Token 用量柱状图 mark 与 dimension 两种悬浮提示统一：键名由 "Tokens" 改为字面量 "Token"（不走 i18n），值由原始数字改为 xx.xx 亿
- `web/src/features/data-overview/components/user-consumption-charts.tsx` — 用户消耗排行与占比图表悬浮提示：Token 键名改为字面量 "Token"、值统一为 xx.xx 亿，排行柱状图 mark 与 dimension 提示一致
- `web/src/features/data-overview/components/usage-analysis.tsx` — 使用分析板块各图表（Token 用量趋势、模型调用分布、模型消耗排行、费用趋势）Token 悬浮显示统一为 xx.xx 亿格式

### 2026-08-27 使用分析趋势图时间粒度

- `web/src/features/data-overview/components/usage-analysis.tsx` — 为额度消耗、请求次数、Token 用量和模型使用四张趋势图分别增加日、周、月粒度选择器；切换时复用后端每日数据在前端聚合，不触发额外接口请求，并同步更新横轴、Tooltip、缩放范围和图表刷新键
- `web/src/features/data-overview/lib/usage-analysis-granularity.ts` — 新增每日统计与模型每日统计的通用粒度聚合逻辑；周粒度固定以周一为起点，月粒度按自然月汇总，使用 UTC 日期运算避免本地时区偏移
- `web/src/features/data-overview/components/__tests__/usage-analysis.test.tsx` — 覆盖四张趋势图独立选择器的默认日粒度、可访问名称，以及切换请求趋势为周粒度时仅聚合当前图的交互行为
- `web/src/features/data-overview/lib/__tests__/usage-analysis-granularity.test.ts` — 覆盖日、周、月聚合、跨年边界、模型独立汇总、标签格式和空数据行为

### 2026-08-25 费用文案间距统一

- `web/src/i18n/locales/zh.json` — 将费用阈值标题统一为“费用 > 10 人数/占比”，说明改为“消费超过 10 元的人数及占比”，并为费用分布中的数值与“元”“人”等中文单位补充空格
- `web/src/features/data-overview/components/__tests__/stats-card-tooltip.test.tsx` — 新增中文费用阈值和费用分布文案间距测试

### 2026-08-17 费用分布人数柱状图

- `web/src/features/data-overview/lib/usage-analysis-chart-data.ts` — 新增费用分桶到柱状图数据的转换：按区间生成人数序列并汇总总人数，全员零消耗时返回空以隐藏图表；区间标签格式化抽为可注入的翻译回调，上界为 0 表示开区间最高档、上下界均为 0 表示零消耗档
- `web/src/features/data-overview/components/usage-analysis.tsx` — 新增费用分布人数柱状图并置于使用分析区域首位；柱顶直接标注人数（万级折算为“万”），Y 轴同口径格式化，悬停提示只显示纯数值不带单位；组件新增可选 `costBuckets` 入参，仅有费用分桶数据时也会渲染区块
- `web/src/features/data-overview/index.tsx`、`web/src/features/data-overview/components/sub-department-stats-dialog.tsx` — 使用分析区块从部门统计接口透传费用分桶数据，单用户统计弹窗不传（该维度对单人无意义）
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补齐费用分布人数统计标题与用户数标签的七语言文案

### 2026-08-07 模型系列统计与模型图表置顶

- `.env.example` — 新增 `DATA_OVERVIEW_MODEL_SERIES_KEYWORDS` 配置示例，以“系列展示名 → 关键字数组”维护模型系列归类规则
- `docker-compose.yml` — 将模型系列关键字配置注入后端服务环境变量
- `service/feishu_department.go` — 使用分析响应新增 `model_series_stats`；基于全量原始模型统计进行不区分大小写的关键字包含匹配，重叠时按最长关键字优先且同长度按系列名稳定归类，未命中模型不进入系列统计；按系列合并 Token、额度和请求次数并在 Top 10 截断前完成聚合
- `web/src/features/data-overview/types.ts` — 使用分析类型补充可选的模型系列统计字段，兼容旧接口响应
- `web/src/features/data-overview/lib/usage-analysis-chart-data.ts` — 抽取模型调用分布与消耗排行的数据转换、费用换算、排序和可选截断逻辑，供普通模型与模型系列图表复用
- `web/src/features/data-overview/components/usage-analysis.tsx` — 新增模型系列调用分布饼图和模型系列消耗排行柱状图；将模型系列调用分布、模型系列消耗排行、模型调用分布、模型消耗排行四图调整到使用分析区域顶部，并为图表标题补充语义化标题元素
- `web/src/features/data-overview/index.tsx`、`web/src/features/data-overview/components/sub-department-stats-dialog.tsx` — 使用分析加载骨架数量由 6 调整为 8，覆盖新增的两张模型系列图表
- `web/src/features/data-overview/__tests__/usage-analysis-chart-data.test.ts` — 覆盖请求分布过滤和汇总、消耗排序、人民币费用单次换算，以及系列图表不受普通模型图表数量限制的行为
- `web/src/features/data-overview/components/__tests__/usage-analysis.test.tsx` — 覆盖四张模型分布/排行图位于趋势图之前的用户可见排列顺序
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补齐模型系列调用分布与模型系列消耗排行的七语言文案

### 2026-08-05 部门切换后的未搜索提示

- `web/src/features/data-overview/index.tsx` — 选择新部门并清空查询参数后展示引导空状态，避免用户点击“搜索”前统计区域呈现空白
- `web/src/features/data-overview/components/department-search-prompt.tsx` — 新增带搜索图标和状态语义的空状态提示，分两行引导用户点击“搜索”查看所选部门统计数据
- `web/src/features/data-overview/components/__tests__/search-prompt.test.tsx` — 覆盖未搜索提示的图标、可访问状态语义和两行文案
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐未搜索提示的七语言翻译

### 2026-08-05 无订阅人员额度展示

- `service/data_overview_company.go` — 部门用户有有效订阅时沿用订阅已用/总额，无有效订阅时改为以筛选区间总消耗作为已用额度、筛选区间总消耗加钱包剩余额度作为总额，并在订阅查询失败时避免误判为无订阅
- `service/feishu_department.go` — 部门用户响应显式下发有效订阅状态
- `service/data_overview_company_test.go` — 覆盖有订阅人员沿用订阅额度、无订阅人员按筛选区间消耗加钱包余额计算总额，以及区间边界与区间外消耗排除行为
- `web/src/features/data-overview/types.ts` — 部门用户类型补充有效订阅状态，供共享额度列正确展示无订阅人员的零值

### 2026-07-30 离职人员部门统计修复

- `service/data_overview_company.go` — 平台通讯录已不再返回的禁用账号，按本地 `users.departments` 首个 `department_id` 回补到对应部门受众，继续参与部门人数、用量、排行和日志统计
- `service/feishu_department.go` — 部门用户注册状态新增 `departed`，禁用账号显示为离职并保留已注册账号的统计能力；注册状态筛选同步支持离职
- `service/data_overview_company_test.go` — 覆盖禁用账号不在平台成员列表中但本地部门匹配时仍被纳入统计的测试路径
- `web/src/features/data-overview/` — 部门用户列表和 Excel 导出展示离职状态，筛选器新增离职选项，并补充状态兼容逻辑与前端测试
- `web/src/i18n/` — 新增 Departed 的 7 语言翻译及静态翻译键

### 2026-07-30 公司平台 Token 自动刷新修复

- `service/data_overview_provider.go` — 飞书公司 Token 缓存改为遵循平台返回的真实有效期并提前 60 秒失效；钉钉移除数据总览额外的一小时 Token 缓存，复用原有基于 `expires_in` 的缓存；飞书遇到 99991663 等无效 Token、钉钉遇到 40014 无效 Token 时，清除对应缓存、重新获取 Token，并对部门目录、成员列表和成员详情请求重试一次
- `service/feishu_sync.go` — 飞书 Tenant Access Token 获取结果补充返回 `expire` 有效期，供公司数据总览按真实生命周期缓存
- `service/dingtalk_sync.go` — 新增按 Client ID 清除钉钉 Access Token 缓存的能力，供鉴权失败后的自动刷新流程使用

### 2026-07-29 飞书公司目录跳过租户查询

- `service/data_overview_provider.go` — `fetchFeishuCompanyDirectory` 不再调用 `feishuFetchTenantInfo`（`/tenant/v2/tenant/query`）；组织名直接使用 `company.Name`，仅依赖通讯录部门列表构建目录，避免租户接口 99991663 等失败导致部门树节点「公司数据不可用」；公司连接测试仍可单独校验租户信息

## 涉及文件

- `controller/department.go` — 部门树、部门统计、子部门统计、用户排行接口控制器；新增 GetUserUsageAnalysis 单用户使用分析接口；新增 GetDepartmentLogs 部门使用日志接口；新增 GetDepartmentUserLogs 用户统计弹窗精确日志接口及 user_id 校验
- `service/feishu_department.go` — 飞书部门树拉取/缓存/权限裁剪；部门统计聚合；新增 GetSubDepartmentStats 按直接子部门并发拉取成员并批量聚合用量、getDirectChildren 辅助函数；部门与子部门统计新增按系统汇率换算的人民币费用；部门均价改为在人民币金额换算后计算；子部门统计新增每百万 Token 均价并随接口返回；UsageAnalysisResponse 新增 ModelDailyStats 与 QuotaToCNY 字段，并发查询模型每日统计并下发配额到人民币换算率；新增 GetDepartmentUserRankings 返回部门内用户消耗 Top 10 排行；部门用户列表支持按数据库字段和计算用量列排序，并补充每百万 Token 均价字段与排序；新增 GetUserUsageAnalysis 单用户使用分析服务（并发查询模型/每日/模型每日统计）；新增 GetDepartmentLogs 按部门成员 user_id 拉取使用日志；新增 GetDepartmentUserLogs 按单一 user_id、时间范围和分页精确拉取日志；新增 registration_status 参数支持按注册状态过滤用户（registered/unregistered），DepartmentUserItem 新增 IsRegistered 字段；未注册用户显示名默认为"-"；默认排序改为降序
- `model/log.go` — 部门统计聚合查询改用主库 quota_data 表，按 token_used、quota、count 聚合 Token/费用/请求数，并移除模型层按固定 quota 比例计算部门均价的逻辑；新增 GetUserStatsBatch 按 user_id 分组批量聚合 Token/费用/请求数；新增 ModelDailyStatRow 与 GetModelDailyStats 按模型按天聚合 Token 统计（支持 MySQL/SQLite/PostgreSQL）；新增 GetLogsByUserIds 复用使用日志查询并支持部门成员过滤
- `model/user.go` — 新增 GetUserIDAndNamesByOpenIDs 按 open_id 批量查询用户 ID 和姓名
- `router/api-router.go` — 新增 `/api/department/tree`、`/stats`、`/sub-stats`、`/logs`、`/user-logs`、`/user-rankings`、`/user-usage-analysis` 路由
- `web/default/src/features/data-overview/api.ts` — 部门树、统计、子部门统计、用户排行 API 封装；部门用户列表 API 透传排序字段和方向、registration_status 参数；新增 getUserUsageAnalysis 单用户使用分析 API；新增 getDepartmentLogs 部门使用日志 API；新增 getDepartmentUserLogs 用户统计弹窗精确日志 API
- `web/default/src/features/data-overview/types.ts` — 部门树/统计类型；新增 SubDepartmentStat、ModelDailyStat、UserRankingItem 接口；子部门统计新增 total_amount_cny 与 avg_price_per_mt，使用分析响应新增 quota_to_cny；DepartmentUser 新增 is_registered 与 open_id 可选字段，复用共享用户列的头像飞书跳转能力
- `web/default/src/features/data-overview/index.tsx` — 数据总览页面：查询后展示统计卡片与子部门板块；各板块加载骨架屏；Token 格式化改为中文单位（亿/万）；统计卡片从 Card 网格改为分割式紧凑布局（参照数据看板 LogStatCards 风格：单行 border 容器、divide-x 分隔、图标+大写标签+等宽数字+描述行），移除外层 Card 包裹；统计卡片费用展示改用后端按汇率换算后的人民币金额；骨架屏 key 提取为静态数组避免重复渲染；queryFn 增加参数非空断言；UsageAnalysisSection 移除时间参数传入；部门选择器提取为变量简化 JSX
- `web/default/src/features/data-overview/components/department-tree-select.tsx` — 级联展开/搜索部门树选择器
- `web/default/src/features/data-overview/components/department-users-table.tsx` — 部门用户表格，内嵌用户消耗排行图表；启用手动服务端排序，排序变化时重置到第一页；总费用右侧新增每百万 Token 均价列并映射到后端均价排序字段；「已用额度/总额度」列头新增说明图标，提示额度数据固定为当前自然月且不受筛选时间影响；新增「统计」按钮列，点击打开用户统计弹窗；标题右侧新增「日志」按钮，打开当前部门所有员工在数据总览选中时间内的使用日志；新增注册状态列（含下拉筛选器：全部/已注册/未注册），服务端按 registration_status 参数过滤；未注册用户禁用统计按钮
- `web/default/src/features/data-overview/components/user-consumption-charts.tsx` — 用户消耗排行 Top 10（水平柱状图）和用户消耗占比 Top 10（环形饼图），并排展示
- `web/default/src/features/data-overview/components/sub-department-stats.tsx` — 子部门统计组件：柱状图改为纵向、坐标轴格式化大数值；表头「用户数」改为「已注册/总人数」居中对齐；费用列、排序和图表改用后端返回的人民币金额；总费用右侧新增均价列展示每百万 Token 均价；均价列头新增贴近列名的说明图标，悬停表头可查看每百万 Token 均价说明；表格新增「统计」和「日志」按钮列（pinned right），可分别打开子部门统计弹窗和子部门员工使用日志弹窗
- `web/default/src/features/data-overview/components/sub-department-stats-dialog.tsx` — 新增子部门统计弹窗：展示指定子部门的统计卡片（DepartmentStatsCards）与使用分析（UsageAnalysisSection），独立查询 stats 和 usage-analysis 接口；弹框高度统一为视口 85%
- `web/default/src/features/data-overview/components/department-stats-cards.tsx` — 从 index.tsx 提取为独立组件，展示部门统计指标卡片（Token/费用/均价/请求数/注册数/未注册数/响应时间/错误率），支持 Tooltip 展示 Token 详情
- `web/default/src/features/data-overview/components/usage-analysis.tsx` — 使用分析组件：模型排行/费用占比（tab 切换条形图/饼图）改为纵向柱状图；新增模型使用趋势折线图（ModelUsageTrend，按 Top N 模型展示每日 Token 量）；每日用量趋势新增「费用」指标切换；新增均价趋势折线图（AvgPriceTrendChart，计算每日平均单价并补全无数据日期）；费用和均价计算改用后端返回的 quota_to_cny 换算率；请求趋势图高度调整；重构为纯展示组件（移除 startTimestamp/endTimestamp 参数），移除均价趋势和 Token 分布图表，模型调用排行改为饼图分布，费用排行标题改为「模型消耗排行」，费用趋势标题改为「额度消耗趋势」
- `web/default/src/features/data-overview/components/user-stats-dialog.tsx` — 新增用户统计弹窗：展示单用户独立时间筛选、使用分析图表与近期调用日志；日志查询改为传递不可变 user_id；弹窗宽度调整为 1360px、高度统一为视口 85%，并保留视口宽度自适应；顶部时间筛选器移出滚动容器并保持固定，仅日志与使用分析区域随内容滚动
- `web/default/src/features/data-overview/components/user-logs-section.tsx` — 新增用户日志列表组件，复用 usage-logs 公共列定义；抽取通用 LogsSection 并新增 DepartmentLogsSection 复用同一使用日志表格；用户日志改调独立接口并按 user_id 精确查询，避免用户名包含匹配串入其他用户日志；补充 RequestMessagesProvider 以加载并显示近期调用日志中的请求内容；请求内容加载同步遵循超级管理员可见性限制；数据总览中的日志表格按超级管理员权限决定是否启用管理员用户详情拉取，避免 AI BP/中心 BP hover 用户头像时触发管理员接口导致无权限提示；部门日志表格改为自动撑满弹框剩余区域，中间列表滚动并固定底部分页
- `web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx` — useCommonLogsColumns 增加 canFetchUserDetails 选项，拆分“显示用户列”和“拉取管理员用户详情”能力；默认保持管理员日志页原行为，数据总览可禁用详情拉取并仅展示日志自带的基础用户信息
- `web/default/src/features/data-overview/components/department-logs-dialog.tsx` — 新增部门使用日志弹窗，复用 DepartmentLogsSection 展示当前部门或子部门员工在数据总览选中时间内的使用日志，不额外提供时间选择器；弹框高度统一为视口 85%
- `web/default/src/hooks/use-sidebar-config.ts` — 侧边栏配置新增 data_overview 模块及 URL 映射
- `web/default/src/hooks/use-sidebar-data.ts` — 「数据总览」菜单从管理员分区移至控制台分区，添加 requiredRole ADMIN
- `web/default/src/features/data-overview/components/department-users-table.tsx` — 请求次数格式化统一
- `web/default/src/features/data-overview/components/sub-department-stats.tsx` — 请求次数格式化统一
- `web/default/src/features/data-overview/components/user-consumption-charts.tsx` — Token 详情支持 tooltip 展示
- `web/default/src/features/data-overview/lib/export-excel.ts` — 注册状态判断改用 is_registered 字段，状态文本国际化；getWorksheet 非空断言提取为 getRequiredWorksheet 辅助函数
- `web/default/src/i18n/static-keys.ts` — 新增 Registration Status、Registered、Unregistered 静态键
- `web/default/src/i18n/locales/*.json` — 新增 Model Usage Trend、Avg Price Trend、Registered/Total、Total Requests、User Consumption Ranking Top 10、User Consumption Share Top 10、额度统计周期说明、User Statistics、Recent Usage Logs、No Logs Found、Statistics、Usage Logs、Department User List、Model Call Distribution、Model Consumption Ranking、Quota Consumption Trend、Registration Status、Registered、Unregistered 等翻译（6 语言）；补齐每百万 Token 均价相关翻译
- `service/feishu_department.go` — 新增 departmentMemberCacheTTL（30 分钟），部门成员列表和详情缓存 TTL 独立于部门树（5 分钟）；GetDepartmentUsers/GetDepartmentUserRankings 统一走 getAllMemberDetailsUnderDepts 单次查询，移除冗余的 getAllMembersUnderDepts 调用；DepartmentUsersResponse 新增 total_users、registered_users、unregistered_users，接口返回部门总人数、已注册人数与未注册人数
- `web/default/src/features/data-overview/components/department-users-table.tsx` — 操作列 pinned right；默认按 quota 降序排序；额度列头 headerDescription 改为 undefined（tooltip 逻辑移至通用 column-header）；标题右侧新增总人数、已注册、未注册彩色统计标签
- `web/default/src/features/data-overview/types.ts` — DepartmentUsersResponse 类型补充 total_users、registered_users、unregistered_users 字段
- `web/default/src/components/data-table/core/column-header.tsx` — DataTableColumnHeader 新增 DescriptionTooltip，通过 column.columnDef.meta.description 渲染列头说明图标
- `web/default/src/features/users/components/shared-user-columns.tsx` — userQuotaColumn 与共享均价列改为贴近列名的内联说明图标，悬停表头可查看当前自然月额度统计说明和每百万 Token 均价说明；共享列新增均价列，显示 `/MT` 单位并保留排序入口
- `.env.example` — 新增 `DATA_OVERVIEW_ACTIVE_USER_THRESHOLD_FORMULA`，支持用 `days` 按统计区间天数配置活跃用户请求阈值公式，并保留旧固定阈值配置作为兼容兜底
- `model/log.go` — 部门统计新增使用人数、使用占比、人均 Token 和阈值字段；按筛选时间内用户请求次数严格大于动态阈值聚合使用人数
- `service/feishu_department.go` — 解析和校验活跃用户阈值公式，按统计区间天数计算阈值；公式缺失或无效时回退固定阈值，并向部门与子部门统计结果下发阈值和公式说明
- `service/feishu_department_stats_test.go` — 覆盖动态公式阈值边界、固定阈值兜底、时间与用户范围过滤，以及空部门统计行为
- `web/default/src/features/data-overview/components/activity-formula-tooltip.tsx` — 新增活跃用户公式说明 Tooltip，展示实际生效的动态阈值计算方式
- `web/default/src/features/data-overview/components/department-stats-cards.tsx` — 统计卡片新增使用人数/占比与人均 Token，并展示活跃用户公式说明
- `web/default/src/features/data-overview/components/sub-department-stats.tsx` — 子部门表格新增使用人数/占比与人均 Token 列，支持按使用人数排序并展示活跃用户公式说明
- `web/default/src/features/data-overview/index.tsx` — 数据总览主统计区域补充使用人数指标卡片及对应骨架布局
- `web/default/src/features/data-overview/types.ts` — 部门与子部门统计类型补充使用人数、占比、人均 Token 和阈值字段
- `web/default/src/i18n/locales/*.json` — 补齐使用人数、使用占比、人均 Token、请求阈值说明等各语言文案
- `model/log_user_filter_test.go` — 覆盖按 user_id 精确过滤、排除相似用户名用户及起止时间边界包含行为
- `.env.example` — 新增 `DATA_OVERVIEW_MODEL_MAPPING` 数组映射格式说明，以展示模型名关联多个原始模型别名
- `docker-compose.yml` — 将 `DATA_OVERVIEW_MODEL_MAPPING` 注入服务环境变量
- `model/log.go` — 模型统计支持获取完整聚合结果，并按合并后的 Top N 模型集合查询每日趋势数据
- `service/feishu_department.go` — 解析“展示模型名 → 原始模型名数组”映射，统一合并模型 Token、额度、调用次数和每日趋势，并在合并后执行 Top 10 排名
- `service/feishu_department.go` — 注册人数、注册状态、部门/子部门统计、使用分析及部门日志统一按筛选结束时间判断；`users.created_at` 晚于筛选结束时间的员工在该时间范围内视为未注册

### 2026-07-22 公司配置与多公司数据总览

- `model/company.go` — 新增唯一的 `companies` 表模型，以公司名称精确关联 `users.company`，并用 JSON 配置登录方式、飞书/钉钉凭据；支持排序、启停、平台与配置校验，不修改现有用户表结构
- `model/main.go` — 将 `Company` 加入普通迁移与快速迁移，仅创建公司表
- `controller/company.go` — 新增公司列表、详情、创建、更新、启停和连接测试接口；Secret 仅返回配置状态，更新时空 Secret 保留原值，公司改名不迁移现有用户
- `service/company.go` — 新增无平台、飞书和钉钉公司连接测试，并校验平台根组织名称是否与公司名称完全一致
- `router/api-router.go` — 注册仅 Root 可访问的公司管理接口，并保留数据总览部门接口的既有权限入口
- `service/data_overview_provider.go` — 抽象飞书/钉钉统一组织目录与成员 Provider，按公司隔离 Token、目录和成员缓存并使用 singleflight 合并并发请求；飞书 `open_id` 与钉钉 `userid` 统一映射到本地 `users.open_id`；钉钉 `department.listsub` 部门树遍历接入按应用和接口隔离的 30 QPS 限速及 90018 有限退避重试，避免大型组织首次加载触发服务端流控；飞书统计成员读取改用轻量 open_id 列表，成员详情使用独立缓存并仅供未注册用户姓名按需补全；飞书公司目录构建跳过 `/tenant/v2/tenant/query`，组织名使用公司配置名称，避免租户接口失败阻断部门树
- `service/data_overview_company.go` — 新增多公司部门树、公司别名显示、根组织精确匹配、无平台公司聚合及按公司/部门裁剪权限；平台用户同时按成员 ID 与 `users.company` 精确匹配，公司表为空时继续使用旧全局飞书模式；公司目录按固定并发上限并行加载且保持原顺序；company audience 增加 30 秒缓存并以 singleflight 合并并发解析，子部门统计直接按主归属部门复用父级成员分桶，用户列表仅为当前分页拉取未注册成员姓名，overview 内子部门统计、用户列表和排行共享一次用户聚合查询，减少平台接口与数据库重复请求
- `service/feishu_department.go` — 部门树和各统计、排行、日志、导出服务接入公司模式 audience；请求携带公司 ID 与当前用户身份，并在服务端重新校验公司和部门访问范围
- `controller/department.go` — 数据总览统计接口校验 `company_id`，注入请求用户 ID 和角色，并将公司或部门越权统一返回 403
- `service/dingtalk_sync.go` — 钉钉 `department.listsub` 与 `user.list` 按 Client ID 和 API 路径分别平滑限制为单进程 30 QPS；识别 `errcode=88/subcode=90018` 后按 1 秒、2 秒有限退避重试，重试耗尽及底层请求错误不再泄露凭据 URL
- `web/src/features/companies/api.ts` — 新增公司分页读取、创建、更新、启停和连接测试 API，前端只接收 Secret 的 configured 标记
- `web/src/features/companies/types.ts` — 新增公司、平台、状态、登录方式和连接测试类型
- `web/src/features/companies/lib/company-form.ts` — 新增公司表单 Zod 校验、平台与登录方式选项、凭据字段选择、Secret 掩码和无删除操作的行操作规则
- `web/src/features/companies/components/company-credentials-fields.tsx` — 按平台显示飞书或钉钉凭据输入，已配置 Secret 使用掩码占位且不会回显明文
- `web/src/features/companies/components/company-login-methods-field.tsx` — 新增公司登录方式元数据选择；不改变现有 LDAP、密码或平台登录流程
- `web/src/features/companies/components/companies-table.tsx` — 新增公司表格、搜索、平台与状态标签、连接测试、编辑和启停操作，不提供物理删除
- `web/src/features/companies/components/company-mutate-sheet.tsx` — 新增公司创建/编辑表单并改用居中 Dialog 展示；保留固定操作区和滚动内容区，删除冗余的“编辑时留空保留 Secret”提示
- `web/src/features/companies/index.tsx` — 新增公司管理页面，整合查询、创建、编辑、连接测试和启停确认，并在变更后刷新公司及部门树缓存
- `web/src/routes/_authenticated/companies/index.tsx` — 新增公司管理路由并在前端限制为超级管理员访问
- `web/src/routeTree.gen.ts` — 注册生成的公司管理路由
- `web/src/features/system-settings/maintenance/config.ts` — 在系统设置维护模块中登记公司管理模块
- `web/src/features/system-settings/maintenance/sidebar-modules-section.tsx` — 支持在侧边栏模块配置中管理公司入口
- `web/src/hooks/use-sidebar-config.ts` — 增加公司管理模块与 URL 映射
- `web/src/hooks/use-sidebar-data.ts` — 向系统管理分区添加仅超级管理员可见的公司管理菜单
- `web/src/features/data-overview/types.ts` — 部门节点和查询参数补充公司、平台、节点类型、禁用状态及错误信息
- `web/src/features/data-overview/api.ts` — 统计、子部门、使用分析、排行、日志和用户列表请求统一透传 `company_id`
- `web/src/features/data-overview/lib/department-selection.ts` — 集中处理公司感知的节点选择、请求参数构造、禁用状态和组织加载错误文案
- `web/src/features/data-overview/index.tsx` — 数据总览根据所选公司节点生成查询参数，支持无平台公司一级节点，并隔离不同公司的 Query 缓存
- `web/src/features/data-overview/components/department-tree-select.tsx` — 部门选择器支持公司一级节点、平台信息、禁用公司及组织名称不匹配错误提示
- `web/src/features/data-overview/components/department-users-table.tsx` — 部门用户、排行和日志查询携带当前公司 ID
- `web/src/features/data-overview/components/sub-department-stats.tsx` — 子部门统计与弹窗操作携带公司 ID
- `web/src/features/data-overview/components/sub-department-stats-dialog.tsx` — 子部门统计弹窗按公司隔离统计和使用分析查询
- `web/src/features/data-overview/components/department-logs-dialog.tsx` — 部门日志弹窗透传公司 ID
- `web/src/features/data-overview/components/user-stats-dialog.tsx` — 用户统计弹窗透传公司 ID 并按公司校验目标用户
- `web/src/features/data-overview/components/user-logs-section.tsx` — 用户与部门日志请求携带公司 ID
- `web/src/features/data-overview/components/export-dialog.tsx` — 数据总览导出按公司范围加载统计与用户数据
- `web/src/components/data-table/hooks/use-data-table.ts` — 为未显式传入的列筛选和全局筛选初始化受控状态，修复公司管理表格工具栏读取 `columnFilters.length` 时崩溃
- `web/src/components/data-table/hooks/__tests__/state.test.tsx` — 覆盖仅启用全局搜索时列筛选状态仍初始化为空数组的测试场景
- `web/src/features/companies/__tests__/company-behavior.test.ts` — 覆盖平台凭据字段、Secret 掩码、配置状态和无删除操作等公司管理契约
- `web/src/features/companies/__tests__/editor-dialog.test.tsx` — 覆盖公司创建和编辑均使用 Dialog，且不显示已删除的冗余 Secret 提示
- `web/src/features/data-overview/__tests__/company-selection.test.ts` — 覆盖公司参数透传、旧模式兼容、无平台公司选择和错误公司跳过逻辑
- `web/src/i18n/static-keys.ts` — 登记公司管理、平台、登录方式和组织错误提示等静态翻译键
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐公司管理和多公司数据总览七语言文案，并移除废弃的 Secret 留空提示键

### 2026-07-24 部门树选择器懒加载

- `service/feishu_department.go` — `DeptTreeNode` 新增 `Loading bool` 字段（`omitempty`），标记子部门尚未拉取
- `service/data_overview_company.go` — `getCompanyDepartmentTree` 改为仅预加载第一个公司的部门树，其余公司节点置 `Loading=true`；新增 `GetCompanySubtreeNode` 与 `CompanySubtreeResponse`，按需拉取单个公司的完整子树（含访问校验和权限裁剪）
- `controller/department.go` — 新增 `GetCompanyDepartmentSubtree`，读取 `company_id` 查询参数并调用 `GetCompanySubtreeNode`
- `router/api-router.go` — 注册 `GET /api/department/company-subtree` 路由
- `web/src/features/data-overview/types.ts` — `DeptTreeNode` 新增 `loading?: boolean`；新增 `CompanySubtreeResponse` 接口
- `web/src/features/data-overview/api.ts` — 新增 `getCompanySubtree(companyId)` API 封装
- `web/src/features/data-overview/components/department-tree-select.tsx` — 新增 `onLoadNodeChildren` 和 `loadingNodeValues` props；悬停 `loading` 公司节点时触发懒加载；列计算改为从最新 `treeData` 按值查找节点，加载中显示独立 `LoadingColumn` 列与行内旋转图标
- `web/src/features/data-overview/index.tsx` — 新增 `lazyCompanySubtrees` 和 `loadingCompanyValues` 状态；`handleLoadCompanyChildren` 防重复拉取，成功后将子树合并进 `displayTreeData`（`useMemo` 按 node value 替换）

### 2026-07-24 首屏性能优化：移除旧模式 + 后端聚合 + 前端并行渐进加载

- `service/feishu_department.go` — 彻底移除旧飞书单租户模式：`GetDepartmentTree`、`GetDepartmentStats`、`GetSubDepartmentStats`、`GetUsageAnalysis`、`GetDepartmentUsers`、`GetDepartmentUserRankings`、`GetDepartmentLogs` 中的 `if companyMode` 分支全部移除，直接调用公司模式实现；删除旧飞书路径下的 `getAllMembersUnderDepts`、`findRegisteredUserIdsByOpenIDs`、`collectOpenDeptIDsUnder` 等辅助函数（共减少约 736 行）
- `model/company.go` — 删除 `CountCompanies()` 函数（已无调用方）
- `service/data_overview_company.go` — 删除 `CompanyDataOverviewEnabled()` 及其内部 `CountCompanies()` 调用，`resolveCompanyOverviewAudience` 改为直接以 `companyID <= 0` 快速拒绝；新增 `DepartmentOverviewRequest`、`DepartmentOverviewResponse` 类型；新增 `GetDepartmentOverview`：一次调用 `resolveCompanyOverviewAudience` 解析 audience 后，通过 `errgroup` 并行执行 `buildCompanyDepartmentStats`、`buildCompanySubDepartmentStats`、`buildCompanyUsageAnalysis`、`buildCompanyDepartmentUsers`、`buildCompanyDepartmentUserRankings` 五个计算，聚合为单一响应返回；`getCompanyDepartmentTree` 新增空公司列表快速返回路径；`createDepartmentQueryParams` 改为对缺失 `company_id` 抛出明确错误
- `controller/department.go` — 新增 `GetDepartmentOverview` controller；`validateDepartmentCompanyID` 移除对 `CompanyDataOverviewEnabled()` 的调用，直接以 `companyID <= 0` 拒绝；`validateDepartmentUserCompanyID` 移除 root 用户豁免分支，统一走 `validateDepartmentCompanyID`
- `router/api-router.go` — 注册 `POST /api/department/overview` 路由
- `service/data_overview_company_test.go` — 覆盖 `GetDepartmentOverview` 的无公司快速返回、缺失 `company_id` 拒绝和 audience 解析失败行为；补充子部门主归属分桶、audience 缓存复用及未注册用户姓名仅按当前分页加载的测试
- `web/src/features/data-overview/index.tsx` — 首屏改为并行发起 stats、sub-stats、usage-analysis、users、user-rankings 五个独立请求，各板块就绪后立即渲染；`getOverviewLoadingState` 控制搜索按钮与分板块骨架，避免单接口最慢任务拖慢整页
- `web/src/features/data-overview/lib/overview-loading.ts` — 新增，根据各查询 fetching/data 状态计算搜索中状态与 stats/sub-stats/usage/users/rankings 骨架展示
- `web/src/features/data-overview/components/department-users-table.tsx` — `initialUsers`/`initialRankings` 改为可选，并新增 `initialUsersLoading`/`initialRankingsLoading`，首屏加载中展示表格骨架与排行旋转指示
- `web/src/features/data-overview/components/sub-department-stats.tsx` — `activityFormula` 改为可选，统计卡片未返回前均价/活跃公式说明可安全降级
- `web/src/features/data-overview/api.ts` — 前端移除对 `getDepartmentOverview` 的调用（后端 overview 聚合接口仍保留）
- `web/src/features/data-overview/types.ts` — 移除仅供前端聚合消费的 `DepartmentOverviewResponse` 类型
- `web/src/features/data-overview/lib/department-users-query.ts` — 集中定义用户列表查询的初始分页大小、排序字段和排序方向常量
- `web/src/features/data-overview/__tests__/overview-loading.test.ts` — 覆盖分板块骨架与搜索中状态的渐进加载契约
- `web/src/features/data-overview/__tests__/department-users-query.test.ts` — 覆盖用户列表查询初始常量与参数构造，并改为断言独立 users 结果作为首屏表格数据
- `web/src/features/data-overview/__tests__/company-selection.test.ts` — 补充缺失 `company_id` 节点的禁用和抛出行为测试
- `web/src/features/data-overview/lib/department-selection.ts` — `isDepartmentNodeDisabled` 新增对缺失 `company_id` 的节点禁用；`createDepartmentQueryParams` 改为对 `company_id` 缺失抛出异常而非默认 0

### 2026-07-24 overview 共享用户用量统计

- `service/data_overview_company.go` — 新增 `overviewUserStats` 与 `loadOverviewUserStats`，在 `GetDepartmentOverview` 内先并行预加载一次注册用户 `GetUserStatsBatch`；`buildCompanySubDepartmentStats`、`buildCompanyDepartmentUsers`、`buildCompanyDepartmentUserRankings` 改为接收共享统计并复用，独立接口路径仍可传 `nil` 自行加载；消除 overview 聚合内对同一用户集合的重复日志扫表
- `service/data_overview_company_test.go` — 覆盖共享用户统计只查询一次、子部门/用户列表/排行复用同一批结果，以及独立路径仍可自行加载的行为

### 2026-07-25 四类 Token 统计口径与明细

- `model/log.go` — 用户、模型、每日趋势和部门统计的总 Token 统一改为非缓存输入、非缓存输出、缓存读取与缓存写入四类字段相加；部门统计响应同时下发四类 Token 明细
- `service/data_overview_company_test.go` — overview 共享统计测试数据补充四类 Token，确保聚合结果不再依赖旧 `token_used` 字段
- `web/src/features/data-overview/types.ts` — 部门统计类型补充四类 Token 明细字段
- `web/src/features/data-overview/components/department-stats-cards.tsx` — 总 Token 卡片 Tooltip 展示四类 Token 数值与口径说明
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json` — 补齐四类 Token 名称与说明文案

### 2026-07-25 人员主归属部门匹配

- `model/user.go` — 新增主归属部门解析，固定读取 `users.departments` JSON 数组中首个对象的 `department_id`
- `service/data_overview_company.go` — 数据总览的平台成员匹配增加主归属部门校验，仅当 `open_id`、公司及首个 `department_id` 均匹配当前部门或其下级范围时才计入注册用户和部门统计，避免多部门人员重复归属
- `service/data_overview_company_test.go` — 覆盖只认首个部门 ID、忽略后续部门命中、保留真实未注册成员及按统计结束时间判断注册状态的测试场景

### 2026-07-28 管理员跨公司查看用户统计

- `controller/department.go` — 用户统计相关接口允许管理员在未传 `company_id` 时继续请求；BP、部门负责人及普通用户仍返回公司 ID 必填错误
- `service/data_overview_company.go` — 单用户统计授权允许管理员省略公司范围并查看全局用户，其他角色继续通过公司组织树校验目标用户可见性

### 2026-08-17 费用分桶统计卡片

- `model/log.go` — `DepartmentStat` 新增 `cost_buckets`、`high_cost_users`、`high_cost_user_rate`、`high_cost_threshold_cny` 字段，并新增 `CostBucket` 结构体（上界为开区间，0 表示无上界）
- `service/data_overview_company.go` — 新增 `highCostThresholdCNY`（10 元）与 `costBucketUpperBoundsCNY` 分桶边界；`buildCompanyDepartmentStats` 增加可选 `userStats` 参数，overview 聚合路径复用已加载的单用户统计计算分桶，独立统计接口仍自行加载
- `service/report_notify.go` — 报表通知的部门统计构造同步适配新的分桶字段
- `web/src/features/data-overview/types.ts` — 补充 `CostBucket` 类型与部门统计的费用分桶字段
- `web/src/features/data-overview/components/department-stats-cards.tsx` — 未注册/已注册两卡合并为单卡；新增「费用 >10 元人数/占比」卡片，Tooltip 悬停展示各费用区间人数分布，占比复用活跃率配色阈值
- `web/src/features/data-overview/components/__tests__/stats-card-tooltip.test.tsx` — 测试夹具补充费用分桶字段
- `web/src/i18n/locales/*.json` — 七语言补充费用分桶相关文案（`Cost Distribution`、`Spent ¥0`、`Spent ¥{{min}}~¥{{max}}`、`Spent over ¥{{min}}`、`Users spending more than ¥10` 等）

### 2026-09-07 数据总览日志渠道列权限调整

- `web/src/features/data-overview/components/user-logs-section.tsx` — 数据总览的部门日志和部门用户日志渠道列对超级管理员可见，普通管理员隐藏；日志详情中的渠道、重试链和分组倍率仅向超级管理员开放。
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx` — 公共日志列增加渠道详情与分组倍率的独立可见性选项，并将权限传递给详情弹窗和详情摘要。
- `web/src/features/usage-logs/components/dialogs/details-dialog.tsx` — 详情弹窗按独立权限隐藏渠道、重试链和分组倍率，避免普通管理员在数据总览日志中看到敏感信息。
