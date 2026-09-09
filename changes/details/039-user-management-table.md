# 用户管理表格统计增强

**日期**: 2026-06-30 ~ 09-10（最后更新 09-10）

## 涉及文件

- `controller/user.go` — 用户列表和搜索接口返回订阅额度、月度总消耗、Token、请求次数和常用模型统计。
- `common/page_info.go` — 分页参数新增 sort_by/sort_order 解析和白名单 ORDER BY 生成，支持计算列排序识别，并将月度每百万 Token 均价列纳入计算列排序白名单。
- `controller/user.go` — 用户列表和搜索接口支持按订阅额度、月度/累计用量、Token、请求次数和每百万 Token 均价等计算列进行服务端排序。
- `model/log.go` — 新增按用户和模型从 `logs` 表聚合月度用量的查询，支撑常用模型统计。
- `model/subscription.go` — 新增按用户批量查询有效订阅额度汇总，用于用户管理表格展示订阅额度进度。
- `model/user.go` — 用户查询支持安全排序字段白名单和排序方向参数。
- `web/default/src/features/users/api.ts` — 用户列表 API 透传排序字段和方向；移除用户删除 API 封装。
- `web/default/src/features/users/components/users-table.tsx` — 用户管理表格启用手动服务端排序，排序变化时重置到第一页，并将均价列映射到后端月度均价排序字段。
- `web/default/src/features/users/types.ts` — 用户列表查询参数补充 sort_by/sort_order。
- `web/default/src/features/users/components/users-columns.tsx` — 用户管理表格新增月度总消耗、Token、请求次数、常用模型列，并将请求数提示改为使用 `logs` 聚合结果。
- `web/default/src/features/users/components/shared-user-columns.tsx` — 请求次数格式化统一（与数据总览保持一致）；抽取 `useSharedUserColumns` hook 统一用户管理与数据总览部门用户表格列定义；用户名列头像点击支持通过 open_id 跳转飞书且悬停仍显示资料卡片；调整用户列表 ID、用户名、总费用、Token、请求次数、部门、最后登录等列宽；部门列超出省略并悬停显示完整路径；调整列顺序为部门、职级、最后登录、常用模型；总费用右侧新增每百万 Token 均价列，显示 `/MT` 单位并接入排序表头；额度和均价列头新增贴近列名的说明图标，悬停表头可查看当前自然月额度统计说明和每百万 Token 均价说明
- `web/default/src/components/long-text.tsx` — 移动端长文本弹出层使用非按钮元素作为触发器时显式关闭 nativeButton，消除 Base UI 可访问性警告
- `web/default/src/features/data-overview/components/department-users-table.tsx` — 改用 `useSharedUserColumns` hook，移除独立的列定义
- `web/default/src/features/users/components/users-table.tsx` — 默认排序由 quota 降序改为 created_at 降序；getRowClassName 改为 early-return 写法
- `web/default/src/features/users/components/data-table-row-actions.tsx` — 操作列新增「统计」按钮（BarChart3 图标），点击打开 UserStatsDialog 查看用户使用分析；移除三点菜单中的删除项。
- `web/default/src/features/users/index.tsx` — 不再挂载用户删除确认弹窗。
- `web/default/src/features/users/components/users-delete-dialog.tsx` — 删除用户删除确认弹窗组件。
- `web/default/src/features/users/types.ts` — 用户类型补充订阅额度与月度统计字段；用户弹窗类型与管理动作类型移除 delete。
- `web/default/src/features/users/lib/user-actions.ts` — 删除用户删除成功提示动作映射。
- `web/default/src/i18n/locales/en.json` — 补充用户管理新增统计列英文文案。
- `web/default/src/i18n/locales/fr.json` — 补充用户管理新增统计列法文文案。
- `web/default/src/i18n/locales/ja.json` — 补充用户管理新增统计列日文文案。
- `web/default/src/i18n/locales/ru.json` — 补充用户管理新增统计列俄文文案。
- `web/default/src/i18n/locales/vi.json` — 补充用户管理新增统计列越南文文案。
- `web/default/src/i18n/locales/zh.json` — 补充用户管理新增统计列中文文案。

## 2026-07-20 公司筛选

- `model/user.go` — 新增 `GetUserCompanies` 查询去重且非空的用户公司列表（按公司升序）；`SearchUsers` 新增 `company` 参数，非空时按 `company` 精确过滤。
- `controller/user.go` — 新增 `GetUserCompanies` 接口；`SearchUsers` 读取 `company` 查询参数并透传给 model 层。
- `router/api-router.go` — 管理端用户路由新增 `GET /api/user/companies`。
- `web/default/src/features/users/api.ts` — `searchUsers` 透传 `company` 查询参数；新增 `getUserCompanies` 获取去重公司列表。
- `web/default/src/features/users/types.ts` — `SearchUsersParams` 新增 `company` 字段。
- `web/default/src/routes/_authenticated/users/index.tsx` — URL 搜索 schema 新增 `company` 数组参数。
- `web/default/src/features/users/components/users-columns.tsx` — 新增 `company` 列（默认隐藏、不可排序），用于承载「公司」筛选。
- `web/default/src/features/users/components/users-table.tsx` — 在「角色」筛选旁新增「公司」单选筛选（Building2 图标），公司选项来自 `getUserCompanies`，公司列默认隐藏并参与筛选与搜索请求。
- `web/default/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充「Company」（公司）翻译。

## 2026-07-22 额度列展示优化

- `web/src/features/users/components/shared-user-columns.tsx` — 缩短额度数字与进度条展示区域，已用额度固定保留两位小数，将额度说明图标移至标题外并与均价列保持一致，修复说明悬停不显示，并将列名由「已用额度/总额度」精简为「已用/总额」及进一步收窄默认列宽与内容宽度。
- `web/src/components/data-table/core/column-header.tsx` — 通用列头支持将说明图标放在列名后、排序图标前，同时保留原有默认布局。
- `web/src/lib/currency.ts` — 货币与额度格式化支持配置最少保留的小数位数。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 同步更新精简后的额度列名翻译。

## 2026-08-05 无订阅用户额度展示

- `controller/user.go` — 用户管理列表显式返回有效订阅状态；有有效订阅时沿用订阅已用/总额，无有效订阅时改为显示当前自然月消耗，以及自然月消耗加钱包剩余额度，并在订阅查询失败时避免误判为无订阅。
- `controller/user_manage_test.go` — 覆盖有订阅用户沿用订阅额度、无订阅用户按自然月消耗加钱包余额计算总额，并排除月外消耗的回归路径。
- `web/src/features/users/types.ts` — 用户列表响应类型补充有效订阅状态。
- `web/src/features/users/components/shared-user-columns.tsx` — 共享额度列根据显式订阅状态展示无订阅用户的有效 `0 / 0`，并避免总额为零时产生无效进度百分比；额度说明沿用原有文案。

## 2026-08-07 用户状态人数统计

- `model/user.go` — 用户列表与搜索查询新增启用、禁用状态汇总；统计遵循当前搜索和筛选条件，并排除已删除用户及其他状态。
- `model/user_pagination_test.go` — 覆盖全量与搜索分页统计，并验证已删除用户及其他状态不会计入在职或禁用人数。
- `controller/user.go` — 用户列表和搜索接口在原分页数据中附加 `enabled_count`、`disabled_count` 字段。
- `web/src/features/users/types.ts` — 用户分页响应类型补充启用、禁用人数。
- `web/src/features/users/components/users-table.tsx` — 读取接口状态汇总并传入分页区域，搜索或筛选变化时同步刷新。
- `web/src/features/users/components/user-status-summary.tsx` — 新增用户页专属状态汇总组件，以“在职”和“禁用”展示人数。
- `web/src/components/data-table/core/pagination.tsx`、`web/src/components/data-table/layout/data-table-page.tsx` — 通用分页支持在总计和页数选择之间插入页面专属汇总内容。
- `web/src/features/users/components/__tests__/status-summary.test.tsx`、`web/src/components/data-table/core/__tests__/pagination-summary.test.tsx` — 覆盖中文人数展示及汇总内容所在位置。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充“在职”和“禁用”人数标签翻译。

## 2026-08-20 用户成本中心配置

- `model/user.go` — User 新增 `cost_center` TEXT 字段，默认保存空数组；管理员编辑用户时通过显式更新白名单持久化成本中心。
- `controller/user.go` — 管理员创建和更新用户时归一化成本中心 JSON，限制最多一个部门并校验 `department_id`、部门名称和 `company_id`，拒绝公司根节点等无效值。
- `controller/user_manage_test.go` — 覆盖成本中心空值归一化、有效部门规范化、多部门和公司节点拒绝行为。
- `model/user_update_test.go` — 覆盖用户成本中心写入和清除的数据库持久化行为。
- `web/src/features/users/components/users-mutate-drawer.tsx` — 用户创建/编辑弹窗新增成本中心单选，复用管理员完整部门树并支持加载、回填和清除；BP 可见部门继续沿用原多选配置。
- `web/src/features/users/lib/user-form.ts`、`web/src/features/users/lib/index.ts` — 定义成本中心表单值，完成树节点与单元素部门 JSON 数组之间的序列化和回填转换。
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
- `service/feishu_department.go`、`service/data_overview_company_test.go` — 部门受众构建与回归测试同步支持成本中心归属。

## 2026-09-09 用户分组倍率展示

- `controller/group.go` — 管理员分组接口支持通过可选查询参数返回分组与基础倍率映射，同时保持默认分组名称数组响应兼容。
- `controller/group_test.go` — 覆盖管理员分组接口按需返回基础倍率的响应契约。
- `web/src/features/users/api.ts` — 新增获取全部分组及基础倍率的管理员 API 封装。
- `web/src/features/users/components/users-mutate-drawer.tsx` — 用户编辑弹窗的当前分组和下拉选项显示对应基础倍率。
- `web/src/features/users/components/__tests__/group-ratio-display.test.tsx` — 覆盖当前分组及其他可选分组倍率的可见性。

## 2026-09-10 任职概况与时间列

- `web/src/components/activity-time-cell.tsx` — 活动时间单元格支持按调用方传入语义图标替代可见文字标签并配置两项时间的展示顺序，同时保留悬停标题与屏幕阅读器文案；未传图标和顺序的调用继续使用原文字标签与创建时间优先顺序。
- `web/src/features/users/components/shared-user-columns.tsx` — 新增“任职概况”共享列，以两行摘要布局展示部门、岗位职级和入职日期：首行用加粗文字突出部门，次行以普通文本展示职级并用日历图标展示入职日期，不使用部门图标和标签外框；内容区域设置明确的固定与最大宽度，部门、职级和日期超出可用空间时显示省略号，第二行将职级固定为 88px，使各行日期保持对齐并移除多余分隔符；时间列使用新增用户和登录图标区分创建时间与最后登录，并调整为最后登录在上、创建时间在下；状态列移至常用模型之前，同时保留其他共享表格原有行为。
- `web/src/features/users/components/users-columns.tsx` — 用户管理表格启用任职概况合并列，替代原部门、岗位职级和入职日期三列。
- `web/src/features/users/components/__tests__/activity-time-display.test.tsx` — 覆盖用户时间列的语义图标、隐藏辅助文案、最后登录优先的完整时间值，以及时间和状态均位于常用模型前的列顺序；API 密钥时间列仍使用原文字标签与默认顺序。
- `web/src/features/users/components/__tests__/employment-overview.test.tsx` — 覆盖无图标部门主信息、固定宽度职级、无分隔符日期布局、日期图标、隐藏字段标签和收窄列宽的摘要展示，以及启用合并后独立列被替换的列结构。
- `web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充“任职概况”七语言文案。
