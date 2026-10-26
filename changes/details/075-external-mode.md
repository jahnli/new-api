# 对外模式：隐藏内部信息、限制分流分组可见性并调整用户统计范围

**日期**: 2026-09-17

## 说明

在系统设置 → 系统行为中提供“对外模式”开关。开启后，用户列表隐藏包含部门、岗位职级（自定义字段）与入职日期的“任职概况”列，后端清空相关内部信息。保存开关后刷新前端状态缓存，使已有的列隐藏逻辑及时生效，关闭后恢复显示。

对外模式下，除超级管理员外，数据看板的分流页面不显示分组列、分组切换入口或分组筛选项；`/api/data/flow` 与 `/api/data/flow/self` 响应省略 `use_group` 字段。前端按分组可见性区分查询缓存，过滤失效的选中项，并在可见列不足时仅恢复允许显示的列，避免重新展示分组。超级管理员保留分流分组功能，登录与刷新响应中的 `data.user.group` 保持不变。

用户列表和搜索结果中的费用、Token、请求数、均价与常用模型在对外模式下按全部时间统计，关闭后恢复当月统计，相关排序使用相同范围的数据。无有效订阅时的已用额度及总额度回退值同步使用该范围的消耗；有效订阅的额度仍使用订阅自身记录。为保持接口兼容，沿用现有 `monthly_*` 字段名。前端按对外模式区分用户列表缓存，切换时不展示上一种模式的占位数据，并隐藏“固定为当月”的额度说明。

## 涉及文件

- `setting/operation_setting/operation_setting.go` — 新增 ExternalModeEnabled 全局变量
- `model/option.go` — 注册 ExternalModeEnabled 配置的持久化与初始化
- `controller/misc.go` — 通过 /api/status 暴露 external_mode_enabled 状态
- `controller/user.go` — 在 attachSubscriptionQuota 中按对外模式清空部门、岗位、入职日期等字段，并将用户统计和常用模型查询切换为全部时间；关闭后恢复当月
- `web/src/features/auth/types.ts` — SystemStatus 类型新增 external_mode_enabled 字段
- `web/src/features/system-settings/types.ts` — OperationsSettings 类型新增 ExternalModeEnabled 字段
- `web/src/features/system-settings/general/system-behavior-section.tsx` — 对外模式开关 UI（label + 描述 + Switch）
- `web/src/features/system-settings/operations/index.tsx` — 默认值新增 ExternalModeEnabled
- `web/src/features/system-settings/operations/section-registry.tsx` — 行为配置传递 ExternalModeEnabled
- `web/src/features/users/components/shared-user-columns.tsx` — 按对外模式排除任职概况列，并隐藏额度列“固定为当月”的说明
- `web/src/features/users/components/users-table.tsx` — 查询缓存键包含对外模式状态，切换时重新获取列表且不沿用另一模式的占位数据
- `web/src/hooks/use-external-mode.ts` — 新增 useExternalMode hook，从 status 读取对外模式状态
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json` — 七语言翻译（对外模式及隐藏用户内部信息）
- `controller/usedata.go` — 两个分流接口在对外模式下按请求者角色清空非超级管理员响应中的分组数据
- `model/usedata_flow.go` — 分流响应的 use_group 增加空值省略标记，清空后不再序列化该字段
- `web/src/features/dashboard/components/flow/flow-charts.tsx` — 按对外模式和角色移除分组展示与选择入口，隔离查询缓存并处理模式切换后的列和筛选状态
- `web/src/features/system-settings/hooks/use-update-option.ts` — 保存对外模式开关后失效状态查询并清理持久化状态缓存

## 2026-09-28 销售绑定与资料展示

对外模式下用户管理新增销售归属：用户可绑定一名 `role=2` 销售，列表显示销售列，编辑弹窗支持搜索、绑定、更换和解绑；服务端校验销售角色、限制对外模式下的修改并记录审计。销售资料批量返回头像、基本资料和手机号，列表复用用户头像及资料悬浮卡片。

### 涉及文件

- `model/user.go`、`model/user_sales.go` — `users` 表新增 `sales_user_id` 字段与索引，批量加载销售资料并提供销售候选查询。
- `controller/user.go`、`controller/user_sales.go`、`router/api-router.go` — 增加销售查询接口、绑定校验、解绑处理和销售变更审计。
- `web/src/features/users/api.ts`、`web/src/features/users/types.ts`、`web/src/features/users/lib/user-form.ts` — 补充销售查询、表单和资料类型。
- `web/src/features/users/components/users-columns.tsx`、`web/src/features/users/components/users-mutate-drawer.tsx` — 对外模式显示销售列，编辑弹窗支持销售选择。
- `web/src/features/users/components/shared-user-columns.tsx`、`web/src/features/users/components/user-profile-hover-card.tsx` — 复用用户头像列和资料悬浮卡片展示销售资料，包含手机号字段。
- `i18n/keys.go`、`i18n/locales/{en,zh-CN,zh-TW}.yaml`、`web/src/i18n/locales/{en,fr,ja,ru,vi,zh-TW,zh}.json` — 补充销售绑定、未分配和失效销售相关文案。

## 2026-10-26 客户类型与结算方式

对外模式下用户管理新增「客户类型」（未设置 / 试用 / 付费）与「结算方式」（预付 / 后付）两个商业属性。列表以带图标的状态标签展示客户类型与结算方式两列，列标题支持单选筛选，筛选条件写入路由搜索参数并参与分页统计请求。编辑弹窗新增「商业属性」分区，仅在对外模式开启时展示并提交；关闭对外模式时后端拒绝修改这两个字段，更新接口保留原值。

服务端为 users 表新增 `customer_type`、`settlement_mode` 字段（默认 `unset`、`prepaid`，均建立索引），搜索接口支持按两字段过滤并规范化取值，创建与更新接口校验合法值，非法参数返回统一错误，变更写入用户管理审计。结算方式仅为运营标签，不改变计费逻辑。

### 涉及文件

- `model/user.go` — users 表新增 `customer_type`、`settlement_mode` 字段与索引，新增 `NormalizeCustomerType` / `NormalizeSettlementMode` 取值规范化，搜索过滤与 `EditWithTx` 写入
- `controller/user.go` — 搜索接口支持两个字段筛选，创建与更新接口校验取值、按对外模式拦截修改、保留原值并记录审计参数
- `web/src/features/users/types.ts` — 新增客户类型、结算方式枚举，以及用户、表单与搜索参数类型字段
- `web/src/features/users/constants.ts` — 新增两种属性的标签配置（图标、语义色、样式）与下拉 / 筛选选项
- `web/src/features/users/lib/user-form.ts` — 表单 schema、默认值与数据转换接入商业属性，仅在对外模式下提交
- `web/src/features/users/components/users-columns.tsx` — 对外模式下新增客户类型、结算方式列及列标题筛选
- `web/src/features/users/components/users-mutate-drawer.tsx` — 编辑弹窗新增「商业属性」分区
- `web/src/features/users/components/users-table.tsx` — 两列筛选条件、查询参数与移动端筛选选项
- `web/src/routes/_authenticated/users/index.tsx` — 路由搜索参数新增两个字段
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 七语言文案
