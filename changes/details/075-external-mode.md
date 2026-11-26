# 对外模式与客户属性

**日期**: 2026-11-26

## 模式与数据边界

- 仅启动环境变量 EXTERNAL_MODE 控制：true 对外，false、空或未设置对内，非法值阻止启动，修改需重启；`/api/status` 返回生效状态。旧 ExternalModeEnabled 数据库配置保留但不生效，旧写入请求被拒绝，后台无切换开关。
- 对外隐藏任职概况，后端清空内部部门、岗位、入职等资料，不只隐藏列；非超级管理员的 Flow 不显示分组或切换入口，`/api/data/flow` 与 `/api/data/flow/self` 省略 use_group。超级管理员保留分组功能，登录信息中的用户分组不变。
- 用户列表、搜索、排序、常用模型及无订阅额度回退使用全部时间；对内使用当月，有效订阅仍用其自身额度。兼容接口沿用 monthly_* 字段名，前端按模式隔离查询缓存，不显示另一模式的占位数据或错误的当月说明。

## 销售与商业属性

- 对外模式下 BP（`role=2`）统一显示为“销售”，覆盖用户列表、角色筛选、创建与编辑、资料悬浮卡、顶部用户菜单、移动端抽屉、个人资料及挂绳卡片、使用日志角色筛选；部门可见范围说明随角色名称切换，支持七种语言。对内仍显示 BP，角色值、权限和销售候选条件不变。
- 仅对外模式可修改销售绑定，支持多个销售、搜索、逐项移除和清空；销售候选须满足 users 表中 oidc_id 非空且 role 不为 100，不再限于 BP。未修改则保留原值，读取和请求兼容旧单销售。
- 候选列表、保存校验及资料加载统一采用上述条件；后端校验正整数和用户存在，去重并在事务内保存和记录前后编号；资料批量加载且按绑定顺序展示。已删除或不再满足销售条件的账号不展示资料，编辑保留失效编号供移除。
- 用户列表展示全部有效销售，子部门统计仍取代表用户的全部销售；共用头像、手机号、资料卡和演示遮罩，不表示汇总部门所有员工的销售。
- 客户类型为 unset/trial/paid（未设置/试用/付费）；结算方式为 unset/prepaid/postpaid。非付费客户归一为未设置，付费客户未指定时使用预付。两字段有索引，服务端规范化和校验，变更记录审计；结算方式是运营标签，不改变实际计费。
- 对外用户列表可在工具栏和列头分别单选客户类型与结算方式。选项写入路由，由搜索接口按已选条件筛选列表及分页总数，两个条件可组合使用；这些编辑字段仅对外显示，关闭时拒绝修改、保留已有值。分组、销售及商业列位于使用量之后、时间之前，时间列 200px；对内列序与宽度保持原规则。

## 数据总览与报表授权

- 对外普通用户及销售通过 `overview_dept_ids` 显式配置公司或部门范围，用户扩展字段均提供该配置；对内仍仅 BP 展示该项。
- 整公司授权开放公司根节点及完整部门树，部门授权仅开放所选子树，可跨公司配置；无组织平台的公司必须显式选择公司节点。
- 对外报表通知按显式公司或部门生成范围，不叠加所属公司或部门负责人关系；公司级授权生成公司范围报表。
- 侧栏按对外模式及有效授权显示数据总览入口；进入页面时重新获取授权树，统计请求在读取人员范围缓存前重新校验权限。具体规则见 [入口授权](045-data-overview-access.md) 与 [可见范围配置](069-bp-level-overview.md)。

## 主要入口

- `setting/operation_setting/operation_setting.go`、`model/option.go`、`controller/misc.go`：环境初始化与状态。
- `controller/user.go`、`model/user.go`、`model/user_sales.go`：响应裁剪、统计范围、销售及商业校验。
- `i18n/locales/en.yaml`、`i18n/locales/zh-CN.yaml`、`i18n/locales/zh-TW.yaml`：销售绑定错误提示同步说明 OIDC 绑定及非超级管理员条件。
- `controller/usedata.go`、`model/usedata_flow.go`：Flow 分组裁剪。
- `web/src/hooks/use-external-mode.ts`、`web/src/features/users/`、`web/src/features/dashboard/components/flow/`：模式、列表和编辑。
- `web/src/lib/roles.ts`、`web/src/features/users/constants.ts`：按模式生成 BP 角色名称和筛选选项。
- `web/src/hooks/use-user-display.ts`：顶部菜单和移动端抽屉订阅模式变化并更新角色名称。
- `web/src/features/users/components/shared-user-columns.tsx`、`web/src/features/users/components/users-table.tsx`：共享角色列及筛选随模式展示“销售”或 BP。`web/src/features/users/api.ts` 将客户类型和结算方式随用户搜索请求发送。
- `web/src/features/users/components/user-extension-fields.tsx`、`web/src/features/users/components/user-profile-hover-card.tsx`：角色选择、部门说明及资料卡提示使用模式对应名称。
- `controller/department.go`、`middleware/auth.go`、`service/data_overview_company.go`、`service/feishu_department.go`：公司与部门节点、显式范围裁剪、入口鉴权及缓存读取前权限校验。
- `service/report_notify.go`：对外报表通知使用显式公司或部门授权。
- `web/src/features/users/types.ts`、`web/src/hooks/use-sidebar-data.ts`、`web/src/routes/_authenticated/data-overview/index.tsx`：可见范围字段说明、侧栏入口与进入页面时刷新授权。
- `web/src/features/profile/components/profile-header.tsx`、`web/src/features/profile/components/profile-lanyard.tsx`：个人资料徽标和挂绳卡片使用模式对应名称。
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx`：使用日志角色筛选同步名称。
- `web/src/i18n/locales/en.json`、`web/src/i18n/locales/zh.json`、`web/src/i18n/locales/zh-TW.json`、`web/src/i18n/locales/fr.json`、`web/src/i18n/locales/ja.json`、`web/src/i18n/locales/ru.json`、`web/src/i18n/locales/vi.json`：新增带角色名称占位符的部门范围说明，复用现有“销售”翻译。

原记录未完成销售/商业字段的三库新建与升级矩阵。2026-11-17 销售条件调整已通过 `go build ./...` 与 `git diff --check`，按仓库要求未运行测试；本机未发现 MySQL、PostgreSQL 或 Docker 工具，三库运行验证仍未完成。
