# 用户管理表格统计增强

**日期**: 2026-06-30 ~ 09-15（最后更新 09-15）

## 涉及文件

- `controller/user.go` — 用户列表与搜索接口返回订阅额度、月度总消耗、Token、请求次数、常用模型统计。
- `common/page_info.go` — 分页参数新增 sort_by/sort_order 解析与白名单 ORDER BY 生成，支持计算列排序识别，月度每百万 Token 均价列纳入该白名单。
- `controller/user.go` — 用户列表与搜索接口支持按订阅额度、月度/累计用量、Token、请求次数、每百万 Token 均价等计算列服务端排序。
- `model/log.go` — 新增按用户与模型从 `logs` 表聚合月度用量的查询，支撑常用模型统计。
- `model/subscription.go` — 新增按用户批量查询有效订阅额度汇总，供表格展示订阅额度进度。
- `model/user.go` — 用户查询支持安全排序字段白名单与排序方向参数。
- `web/default/src/features/users/api.ts` — 用户列表 API 透传排序字段和方向；移除用户删除 API 封装。
- `web/default/src/features/users/components/users-table.tsx` — 启用手动服务端排序，排序变化时重置到第一页，均价列映射到后端月度均价排序字段。
- `web/default/src/features/users/types.ts` — 用户列表查询参数补充 sort_by/sort_order。
- `web/default/src/features/users/components/users-columns.tsx` — 新增月度总消耗、Token、请求次数、常用模型列，请求数提示改用 `logs` 聚合结果。
- `web/default/src/features/users/components/shared-user-columns.tsx` — 请求次数格式化统一（与数据总览一致）；抽取 `useSharedUserColumns` hook 统一用户管理与数据总览部门用户表格列定义；用户名列头像点击可经 open_id 跳转飞书，悬停仍显示资料卡片；用户显示名与常用模型徽章改为常规字重；调整 ID、用户名、总费用、Token、请求次数、部门、最后登录等列宽；部门列超出省略，悬停显示完整路径；列顺序调整为部门、职级、最后登录、常用模型；总费用右侧新增每百万 Token 均价列，显示 `/MT` 单位并接入排序表头；额度和均价列头新增贴近列名的说明图标，悬停可查看当前自然月额度统计与每百万 Token 均价说明
- `web/default/src/components/long-text.tsx` — 移动端长文本弹出层以非按钮元素作触发器时显式关闭 nativeButton，消除 Base UI 可访问性警告
- `web/default/src/features/data-overview/components/department-users-table.tsx` — 改用 `useSharedUserColumns` hook，移除独立列定义
- `web/default/src/features/users/components/users-table.tsx` — 默认排序由 quota 降序改为 created_at 降序；getRowClassName 改为 early-return 写法
- `web/default/src/features/users/components/data-table-row-actions.tsx` — 操作列新增「统计」按钮（BarChart3 图标），打开 UserStatsDialog 查看使用分析；移除三点菜单的删除项。
- `web/default/src/features/users/index.tsx` — 不再挂载用户删除确认弹窗。
- `web/default/src/features/users/components/users-delete-dialog.tsx` — 删除用户删除确认弹窗组件。
- `web/default/src/features/users/types.ts` — 用户类型补充订阅额度与月度统计字段；用户弹窗类型与管理动作类型移除 delete。
- `web/default/src/features/users/lib/user-actions.ts` — 删除用户删除成功提示动作映射。
- `web/default/src/i18n/locales/en.json` — 补充统计列英文文案。
- `web/default/src/i18n/locales/fr.json` — 补充统计列法文文案。
- `web/default/src/i18n/locales/ja.json` — 补充统计列日文文案。
- `web/default/src/i18n/locales/ru.json` — 补充统计列俄文文案。
- `web/default/src/i18n/locales/vi.json` — 补充统计列越南文文案。
- `web/default/src/i18n/locales/zh.json` — 补充统计列中文文案。

## 2026-07-20 公司筛选

- `model/user.go` — 新增 `GetUserCompanies` 查询去重非空的用户公司列表（按公司升序）；`SearchUsers` 新增 `company` 参数，非空时按 `company` 精确过滤。
- `controller/user.go` — 新增 `GetUserCompanies` 接口；`SearchUsers` 读取 `company` 参数并透传 model 层。
- `router/api-router.go` — 管理端用户路由新增 `GET /api/user/companies`。
- `web/default/src/features/users/api.ts` — `searchUsers` 透传 `company` 参数；新增 `getUserCompanies` 获取去重公司列表。
- `web/default/src/features/users/types.ts` — `SearchUsersParams` 新增 `company` 字段。
- `web/default/src/routes/_authenticated/users/index.tsx` — URL 搜索 schema 新增 `company` 数组参数。
- `web/default/src/features/users/components/users-columns.tsx` — 新增 `company` 列（默认隐藏、不可排序），承载「公司」筛选。
- `web/default/src/features/users/components/users-table.tsx` — 「角色」筛选旁新增「公司」单选筛选（Building2 图标），选项来自 `getUserCompanies`；公司列默认隐藏并参与筛选与搜索请求。
- `web/default/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充「Company」（公司）翻译。

## 2026-07-22 额度列展示优化

- `web/src/features/users/components/shared-user-columns.tsx` — 缩短额度数字与进度条区域，已用额度固定两位小数，额度说明图标移至标题外并与均价列一致，修复说明悬停不显示，列名由「已用额度/总额度」精简为「已用/总额」，进一步收窄默认列宽与内容宽度。
- `web/src/components/data-table/core/column-header.tsx` — 通用列头支持说明图标置于列名后、排序图标前，保留原有默认布局。
- `web/src/lib/currency.ts` — 货币与额度格式化支持配置最少保留的小数位数。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 同步更新精简后的额度列名翻译。

## 2026-08-05 无订阅用户额度展示

- `controller/user.go` — 用户管理列表显式返回有效订阅状态；有订阅时沿用订阅已用/总额，无订阅时显示当前自然月消耗以及自然月消耗加钱包剩余额度，订阅查询失败时避免误判为无订阅。
- `controller/user_manage_test.go` — 覆盖有订阅用户沿用订阅额度、无订阅用户按自然月消耗加钱包余额计算总额、排除月外消耗的测试路径。
- `web/src/features/users/types.ts` — 用户列表响应类型补充有效订阅状态。
- `web/src/features/users/components/shared-user-columns.tsx` — 共享额度列按显式订阅状态展示无订阅用户的有效 `0 / 0`，避免总额为零时产生无效进度百分比；额度说明沿用原有文案。

## 2026-08-07 用户状态人数统计

- `model/user.go` — 用户列表与搜索查询新增启用、禁用状态汇总；统计遵循当前搜索和筛选条件，排除已删除用户及其他状态。
- `model/user_pagination_test.go` — 覆盖全量与搜索分页统计，验证已删除用户及其他状态不计入在职或禁用人数。
- `controller/user.go` — 用户列表和搜索接口在原分页数据中附加 `enabled_count`、`disabled_count` 字段。
- `web/src/features/users/types.ts` — 用户分页响应类型补充启用、禁用人数。
- `web/src/features/users/components/users-table.tsx` — 读取接口状态汇总并传入分页区域，搜索或筛选变化时同步刷新。
- `web/src/features/users/components/user-status-summary.tsx` — 新增用户页专属状态汇总组件，以“在职”和“禁用”展示人数。
- `web/src/components/data-table/core/pagination.tsx`、`web/src/components/data-table/layout/data-table-page.tsx` — 通用分页支持在总计和页数选择之间插入页面专属汇总内容。
- `web/src/features/users/components/__tests__/status-summary.test.tsx`、`web/src/components/data-table/core/__tests__/pagination-summary.test.tsx` — 覆盖中文人数展示及汇总内容所在位置。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充“在职”和“禁用”人数标签翻译。

## 2026-08-20 用户成本中心配置

- `model/user.go` — User 新增 `cost_center` TEXT 字段，默认空数组；管理员编辑用户时经显式更新白名单持久化成本中心。
- `controller/user.go` — 管理员创建和更新用户时归一化成本中心 JSON，限一个部门并校验 `department_id`、部门名称和 `company_id`，拒绝公司根节点等无效值。
- `controller/user_manage_test.go` — 覆盖成本中心空值归一化、有效部门规范化、多部门和公司节点拒绝行为。
- `model/user_update_test.go` — 覆盖用户成本中心写入和清除的数据库持久化行为。
- `web/src/features/users/components/users-mutate-drawer.tsx` — 用户创建/编辑弹窗新增成本中心单选，复用管理员完整部门树并支持加载、回填和清除；BP 可见部门仍沿用原多选配置。
- `web/src/features/users/lib/user-form.ts`、`web/src/features/users/lib/index.ts` — 定义成本中心表单值，完成树节点与单元素部门 JSON 数组间的序列化与回填转换。
- `web/src/features/users/types.ts` — 用户响应、编辑请求和共享用户行类型补充 `cost_center` 字段。
- `web/src/features/users/lib/__tests__/user-form-bp-level.test.ts` — 覆盖成本中心默认空值、创建/更新提交、清除及服务端值回填。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补齐成本中心标签、选择提示、说明和清除操作的七语言文案。

### 2026-08-20 成本中心完整路径与 department_name 回填

- `web/src/features/users/lib/user-form.ts` — 新增 `getCostCenterDepartmentPath`，按部门树计算不含公司根节点的完整部门路径（如 `数智产品中心 / AI应用技术部 / AI工程效率科`），作为成本中心 `name` 提交与回填展示。
- `web/src/features/users/components/users-mutate-drawer.tsx` — 选择成本中心时保存完整部门路径而非末级节点名称。
- `controller/user.go` — 管理员创建/更新用户时，若 `department_name` 为空则以所选成本中心的完整路径回填，已有值不覆盖；创建白名单补充 `cost_center` 与 `department_name`。
- `model/user.go` — `EditWithTx` 更新白名单支持 `department_name`，用于回填成本中心路径。
- `model/user_update_test.go`、`controller/user_manage_test.go`、`web/src/features/users/lib/__tests__/user-form-bp-level.test.ts` — 覆盖部门路径排除公司名、`department_name` 回填与成本中心归一化返回值。

### 2026-08-20 数据总览按成本中心归属

- `model/user.go` — 新增 `GetCostCenter` 解析 `cost_center` 的部门与公司归属。
- `service/data_overview_company.go` — 新增 `queryCostCenterUsers` 按成本中心归属本地用户（不受公司名与 open_id 限制，内存过滤兼容三种数据库）；`matchOverviewDepartmentMembers` 改用公司对象并接入成本中心归属用户。
- `service/feishu_department.go`、`service/data_overview_company_test.go` — 部门受众构建与相关测试同步支持成本中心归属。

## 2026-09-09 用户分组倍率展示

- `controller/group.go` — 管理员分组接口支持经可选查询参数返回分组与基础倍率映射，同时保持默认分组名称数组响应兼容。
- `controller/group_test.go` — 覆盖管理员分组接口按需返回基础倍率的响应契约。
- `web/src/features/users/api.ts` — 新增获取全部分组及基础倍率的管理员 API 封装。
- `web/src/features/users/components/users-mutate-drawer.tsx` — 用户编辑弹窗的当前分组和下拉选项显示对应基础倍率。
- `web/src/features/users/components/__tests__/group-ratio-display.test.tsx` — 覆盖当前分组及其他可选分组倍率的可见性。

## 2026-09-10～09-11 任职概况与时间列

- `web/src/components/activity-time-cell.tsx` — 活动时间单元格支持调用方传入语义图标替代可见文字标签、配置两项时间展示顺序，保留悬停标题与屏幕阅读器文案；未传图标和顺序的调用沿用原文字标签与创建时间优先顺序。
- `web/src/features/users/components/shared-user-columns.tsx` — 新增“任职概况”共享列，以两行摘要展示部门、岗位职级和入职日期：首行部门、用户显示名及常用模型徽章统一常规字重；次行职级与带日历图标的入职日期改为徽章展示，两者均空时整行隐藏，单项为空时不显示对应徽章，职级保留固定 88px 槽位以对齐各行日期；内容区设明确的固定与最大宽度，部门、职级和日期超出可用空间时显示省略号；时间列用新增用户和登录图标区分创建时间与最后登录，最后登录在上、创建时间在下；状态列移至常用模型之前，其他共享表格原有行为不变。
- `web/src/features/users/components/users-columns.tsx` — 用户管理表格启用任职概况合并列，替代原部门、岗位职级和入职日期三列。
- `web/src/features/users/components/__tests__/activity-time-display.test.tsx` — 覆盖用户时间列的语义图标、隐藏辅助文案、最后登录优先的完整时间值，以及时间和状态均位于常用模型前的列顺序；API 密钥时间列仍使用原文字标签与默认顺序。
- `web/src/features/users/components/__tests__/employment-overview.test.tsx` — 覆盖无图标部门主信息、固定宽度职级、无分隔符日期布局、日期图标、隐藏字段标签和收窄列宽的摘要展示，以及启用合并后独立列被替换的列结构。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充“任职概况”七语言文案。

## 2026-09-11 单价列单位展示

- `web/src/features/users/components/shared-user-columns.tsx` — 用户管理与部门人员列表的单价列统一按每亿 Token 展示：标题改为“单价 / 亿 Token”，内容改为“金额 / 亿”，并加宽列以容纳完整标题。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补齐单价列标题和亿级单位的七语言文案。

## 2026-09-12 消耗列合并与排序字段切换

- `web/src/features/users/components/shared-user-columns.tsx` — 用户管理与部门人员列表的共享列把原 Token、费用、请求次数、单价四列合并为“消耗”列：首行显示 Token 消耗量与金额，次行以 `text-muted-foreground/70` 弱化色、13px 字号显示请求次数（复用已有 `times` 文案补「次」量词，避免与 Token 的「亿」混淆）与每亿 Token 单价（复用已有「费用」文案）；四项数据均保留悬停完整明细（含精确 Token 数与请求次数，新增 `formatUserRequestsDetail`）与屏幕阅读器标签，列宽由四列合计 460px 收窄为 200px；移除 `userTokensColumn`、`userCostColumn`、`userAveragePriceColumn`、`userRequestsColumn`，新增 `userConsumptionColumn`。
- `web/src/components/data-table/core/column-header.tsx` — 共享列头支持列 `meta.sortFields`：下拉菜单新增“排序字段”单选组，升/降序作用于当前选中字段并同步显示其排序方向图标；未声明 `sortFields` 的列行为不变。
- `web/src/components/data-table/core/data-table-header.tsx` — 把表头上下文中的 table 实例透传给列头，使字符串表头（`header: t('...')`）也能读写排序状态。
- `web/src/components/data-table/core/types.ts` — 新增 `DataTableSortField` 类型，描述合并列对外暴露的可排序字段。
- `web/src/tanstack-table.d.ts` — 列 meta 新增 `sortFields` 声明，供合并列声明多个服务端排序字段。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补齐“消耗”“排序字段”和消耗列说明的七语言文案；说明随合并范围扩为四项指标（Token、费用、请求次数、单价）。
- `web/src/features/users/components/shared-user-columns.tsx` — 共享「已用/总额」列默认列宽由 150px 加宽到 180px，使已用值与总额值各两位小数（如 `¥1,234.56`）并排时不挤压；额度列内容右侧增加 12px 内边距，避免右对齐的总额值紧贴「消耗」列。
- `web/src/components/activity-time-cell.tsx`、`web/src/features/users/components/shared-user-columns.tsx` — 时间列（最后登录 / 创建时间）文字由 12px 放大到 14px，与图标尺寸及表格正文一致：`ActivityTimeCell` 新增可选 `textClassName` 覆盖字号，用户管理与部门人员列表传入 `!text-[14px]`；共享表格 CSS 通过后代选择器把 `data-table-text="secondary"` 固定为 `text-xs`，覆盖必须带 `!` 前缀，API 密钥时间列未传该属性、行为不变；同列「新增用户」「登录」图标由 14px 放大到 16px，正好填满原有 16px 标签容器，网格列宽不变。
- `web/src/features/users/components/shared-user-columns.tsx` — 「任职概况」列部门信息由 12px 放大到 14px（`!text-[14px]`，与空值占位及部门列一致）；「消耗」列默认列宽由 200px 加宽到 220px、`minSize` 由 180px 调整到 200px，给四项指标并排留余量。

## 2026-09-13 使用量列命名与说明提示

- `web/src/features/users/components/shared-user-columns.tsx` — 共享的合并列由「消耗」改名为「使用量」（复用已有 `Usage` 文案）；列说明提示改为两行，首行为 Token 用量与费用，次行为请求次数与每亿 Token 单价。
- `web/src/components/data-table/core/column-header.tsx` — 通用列说明提示保留译文中的换行，未包含换行的说明显示不变。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 使用量列说明改为两行七语言文案；`Usage` 中文文案由「用量」改为「使用量」；移除不再使用的「消耗」文案。

## 2026-09-13 「使用量」列头下拉菜单报错修复与加宽

- `web/src/components/data-table/core/column-header.tsx` — 修复点击「使用量」列头后整页显示 500：Base UI 的 `Menu.GroupLabel` 必须位于 `Menu.Group` 或 `Menu.RadioGroup` 内，此前「排序字段」标签与排序字段单选组是兄弟节点，菜单一展开即抛出 `MenuGroupContext is missing`，被根路由错误边界（`GeneralError`，标题为超大 `{status ?? 500}`）接管，表现为整页跳 500 而后端无任何 500 响应；现将两者一并包入 `DropdownMenuGroup`，与仓库内其他下拉菜单写法一致，用户管理与数据总览部门人员列表共用该列头，两处同步修复。
- `web/src/components/data-table/core/column-header.tsx` — 排序字段下拉菜单宽度原跟随触发按钮（`w-(--anchor-width)`），列头较窄时「单价 / 亿 Token」折成两行；现增加 `min-w-60`（240px），按七语言最长译文（英文 `Unit Price / 100M Tokens`、俄语 `Цена / 100 млн токенов`）取值，保证单行显示；未声明 `meta.sortFields` 的列头菜单宽度不变。

## 2026-09-15 状态与角色列头筛选

- `web/src/components/data-table/core/column-filter-header.tsx` — 新增共享列头筛选器 `DataTableColumnHeaderFilter`：列名后内嵌漏斗图标下拉，单选枚举值，`All` 项清除该列筛选；筛选值沿用工具栏 `DataTableFacetedFilter` 的 `string[]` 约定，但形态为紧凑列头版（无加号图标、虚线边框、已选徽章与搜索框），供没有工具栏或需要就近筛选的表格使用。
- `web/src/components/data-table/index.ts` — 导出 `DataTableColumnHeaderFilter` 及其选项类型 `DataTableColumnHeaderFilterOption`，选项支持传入图标组件或图标节点。
- `web/src/features/users/components/shared-user-columns.tsx` — 状态列与角色列表头改用共享列头筛选器，选项复用用户常量中的 `getUserStatusOptions` 与 `getUserRoleOptions`（含图标），选中筛选后表头漏斗转为主题色；状态列默认列宽由 92px 加宽到 102px，容纳新增的筛选按钮。
- `web/src/features/users/components/shared-user-columns.tsx` — 共享列顺序由「时间、状态、常用模型、角色、分组」调整为「时间、常用模型、角色、状态、分组」，取代此前「状态列移至常用模型之前」的排列；部门人员列表自动跟随该顺序，其注册状态列仍在时间列之后。

## 自 CHANGELOG 说明列迁入

用户管理增强：完善用户表格头像、资料、月度统计、服务端排序、公司筛选、状态人数与共享列；用户编辑弹窗新增可选单成本中心配置，复用完整部门树选择，以单元素部门 JSON 数组持久化，支持创建、编辑、回填、清除、后端校验与七语言文案；成本中心名称保存为不含公司名的完整部门路径，用户 department_name 为空时自动回填；数据总览支持按成本中心归属本地用户（含无 open_id 用户），不依赖平台成员匹配；用户编辑弹窗设置分组时显示各分组基础倍率；用户表格将部门、岗位职级、入职日期合并为两行摘要式「任职概况」列，职级与入职日期改用徽章，两者均空时隐藏次行，职级预留固定宽度以对齐日期；单价列统一按每亿 Token 展示，标题改为「单价 / 亿 Token」、内容改为「金额 / 亿」并加宽；Token、费用、请求次数、单价四列合并为「消耗」列，首行显示 Token 消耗量与金额，次行以弱化色 13px 显示请求次数与每亿 Token 单价（费用标签改用「费用」），并通过共享列头新增的排序字段切换保留四种服务端排序；用户显示名、部门路径与常用模型统一常规字重，时间列以图标区分最后登录与创建时间并按该顺序展示，补齐七语言文案；「消耗」列改名「使用量」，列说明提示改为两行展示 Token 用量/费用与请求次数/每亿 Token 单价，`Usage` 中文文案由「用量」改为「使用量」；修复点击「使用量」列头时排序字段下拉菜单因缺少 Base UI 分组上下文而整页跳转 500，并按最长译文加宽该菜单，避免「单价 / 亿 Token」等文案换行
