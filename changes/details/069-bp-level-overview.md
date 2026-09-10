# 数据总览 BP 可见部门配置演进

**日期**: 2026-08-17 ~ 08-21（最后更新 08-21）

### 2026-08-21 恢复公司节点按角色不可选（修正前一条变更）

- `web/src/features/data-overview/lib/department-selection.ts` — `isDepartmentNodeDisabled` 回到以 `node.disabled` 为准，不再前端硬编码拦截所有目录平台公司节点。后端按角色设置 `disabled`（`userRole < common.RoleRootUser`），因此管理员可选飞书/钉钉公司根，BP/部门领导不可选；`none` 平台公司后端不设 `disabled`，所有角色均可选
- `web/src/features/data-overview/components/department-tree-select.tsx` — 级联列样式恢复灰显：`isDisabled` 始终应用 `text-muted-foreground opacity-50`，仅可展开公司节点保留 hover/active 高亮以支持展开查看子部门；搜索结果沿用同一 `isDepartmentNodeDisabled` 判断，公司节点灰显且不可选
- `web/src/features/users/components/dept-multi-select.tsx` — 列视图与搜索结果的选择判断由 `node.disabled` 改为 `isDepartmentNodeDisabled`，公司节点统一不可勾选；复用数据总览同一选择 helper 保持两个组件语义一致
- `service/data_overview_company.go` — 修复懒加载占位公司节点未设置 `Disabled`：部门领导看到的非首家目录平台公司在 `Loading=true` 分支同样执行 `companyNode.Disabled = userRole < common.RoleRootUser`，避免前端依赖 `disabled` 字段时占位公司被误判为可选

### 2026-08-21 允许选中公司节点（已回滚）

- `web/src/features/users/components/dept-multi-select.tsx` — 用户管理部门多选器移除公司节点不可选限制：列视图 `isSelectable` 判断移除 `node.node_type !== 'company'` 条件，搜索结果 `isSelectable` 判断同步移除该条件
- `web/src/features/data-overview/components/department-tree-select.tsx` — 数据总览部门选择器移除公司节点不可选限制：`handleSelect` 移除 `node.node_type === 'company'` 提前返回，搜索结果移除 `isCompanyNode` 变量及其在 disabled 样式中的使用


### 2026-08-19 显式多部门配置与跨公司权限

- `model/user.go` — 新增 `overview_dept_ids` JSON 数组字段，保留数据库中的 `bp_level` 列但移除其业务字段和运行时依赖；更新用户时显式序列化 JSON，兼容 PostgreSQL 文本列
- `controller/user.go` — 创建/更新用户时校验可见部门数组最多 100 项且不含空值；安全用户 DTO 下发 `overview_dept_ids`
- `service/feishu_department.go` — BP 部门树改为按显式节点值裁剪，选中部门及其完整子树可见；新增管理员完整部门树服务
- `service/data_overview_company.go` — BP 按配置部门所属公司加载树并允许跨公司请求，统一在公司鉴权和部门鉴权处校验配置范围
- `service/report_notify.go` — 报表通知范围改用显式部门配置，并支持跨公司 BP 范围
- `controller/department.go`、`router/api-router.go` — 新增管理员专用完整部门树接口 `/api/department/full-tree`
- `web/src/features/users/components/users-mutate-drawer.tsx` — 用户编辑从抽屉改为 50vw 宽、85vh 高弹窗，BP 配置改为完整部门树多选
- `web/src/features/users/components/dept-multi-select.tsx` — 新增部门多选级联器，支持搜索、多个选择、移除和清空
- `web/src/features/data-overview/components/department-tree-select.tsx` — 公司节点不可选但可展开，修复跨公司 BP 公司节点灰显问题
- `web/src/i18n/locales/*.json` — 补齐相关 7 语言文案

### 2026-08-19 重名部门 BP 裁剪匹配修复

- `service/feishu_department.go` — `trimTreeForBP` 由按目标段名称全局搜索（`findNodeByLabel` 取 DFS 首个命中）改为按 `department_name` 完整路径逐级匹配：新增 `findNodeByPath` 沿各级父子关系消歧，同级重名部门（如多个事业部下的第一开发部）不再串到其他分支；路径不匹配时依次去掉前导段重试（兼容树中不含组织根节点的平台），仍失败则回退为按目标段名称查找保持旧行为
- `service/report_notify.go` — 删除重复的 `findReportNotifyNodeByPath` 实现，报表范围改用统一的 `findNodeByPath`
- `service/feishu_department_test.go` — 新增重名部门树测试：完整路径命中本人分支、缺根节点时后缀路径命中、路径缺失时名称兜底

> 下面“涉及文件”中的级别配置内容属于 2026-08-17 的历史实现；2026-08-19 已由上方的 `overview_dept_ids` 显式部门配置替代，数据库中的 `bp_level` 列仅保留用于历史数据兼容。

## 历史实现涉及文件

- `common/constants.go` — 新增 `BpLevelUnset=0` 常量与 `IsValidBpLevel` 校验（非负即可，不设上限）
- `model/user.go` — `User` 结构体新增 `bp_level` 字段（int，默认 0），GORM AutoMigrate 自动加列不改动既有数据；`EditWithTx` 的 updates map 写入 `bp_level`
- `controller/user.go` — `CreateUser` 白名单支持 `bp_level`；`UpdateUser` 校验 `IsValidBpLevel`（非负整数）；创建/更新时按 `department_name` 层级深度钳制 `bp_level`（超过最深级自动收敛为最深级）；`buildSelfUserData` 下发 `bp_level` 供前端入口判断
- `middleware/auth.go` — `DataOverviewAccessCheck` 改为 `canAccessDataOverview`：管理员/超级管理员放行、BP 角色要求 `bp_level > 0`、其余用户要求部门负责人；BP 且 `bp_level=0` 时连入口也拒绝（403）
- `middleware/data_overview_access_test.go` — 新增入口判定表驱动测试：管理员/超级管理员放行、BP 需配置级别、BP 未配置即使兼负责人也拒绝、普通用户仅负责人放行
- `service/feishu_department.go` — 删除 `trimTreeForBP` 中按角色固定级别（中心BP→第1级、AI BP→第2级）的 switch，改为纯 `bp_level` 驱动：0 无可见部门、1~N 取第 N 级、超过本人部门层级时收敛到最深级；`trimTreeForUser` 增加 `bpLevel` 参数；新增 `NormalizeBpLevelForDepartment` 钳制函数，写入（创建/更新用户）与读取（树裁剪、报表推送）共用同一口径
- `service/data_overview_company.go` — 部门树、子树懒加载与 `ensureDepartmentAccessible` 权限校验 3 处裁剪调用传入 `user.BpLevel`，所有数据总览接口随之生效
- `service/report_notify.go` — BP 日报推送范围由按角色取段改为按 `bp_level` 取段（越界收敛），`bp_level<=0` 且非部门负责人时无推送范围
- `service/feishu_department_test.go` — 新增 `trimTreeForBP` 表驱动测试：0/负数不可见、各级裁剪、越界收敛、空部门名与未命中节点，以及不修改输入树
- `service/report_notify_test.go` — 范围测试 fixtures 改为显式设置 `BpLevel`，新增未配置无范围与越界收敛用例
- `web/src/lib/roles.ts` — 新增 `canAccessDataOverview` 入口判定函数（管理员放行、BP 需 `bp_level>0`、其余需部门负责人）
- `web/src/lib/__tests__/data-overview-access.test.ts` — 覆盖入口判定的 5 组用例
- `web/src/stores/auth-store.ts` — `AuthUser` 增加 `bp_level`
- `web/src/routes/_authenticated/data-overview/index.tsx` — 路由守卫改用 `canAccessDataOverview`，BP 且未配置时跳转 403
- `web/src/hooks/use-sidebar-data.ts` — 侧边栏「数据总览」菜单改用同一判定，BP 且未配置时不显示入口
- `web/src/features/users/types.ts` — `userSchema` 与 `UserFormData` 增加 `bp_level`
- `web/src/features/users/lib/user-form.ts` — 表单 schema 增加 `bp_level`（非负整数，不设上限），默认值 0，创建/更新 payload 与回显转换均携带该字段；新增 `clampBpLevelToDepartment` 输入钳制函数（超过本人部门层级深度时按最深级保存）
- `web/src/features/users/lib/__tests__/user-form-bp-level.test.ts` — 覆盖 schema 边界（非负整数、负数/小数拒绝）、默认值、payload、回显转换与越界钳制
- `web/src/features/users/components/users-mutate-drawer.tsx` — 目标角色为 AI BP/中心 BP 时展示「数据总览可见级别」下拉框，根据成员 `department_name` 动态列出 `0 级：不可见任何部门`及各级对应部门名称；角色与级别选择框限制在抽屉可用宽度内并截断超长选中值；管理员权限文案允许收缩换行，避免切换角色后撑宽抽屉
- `web/src/components/drawer-layout.ts` — 抽屉表单与分区增加最小宽度和横向溢出保护，动态角色区域不再扩大表单滚动宽度
- `web/src/components/__tests__/drawer-layout.test.ts` — 新增抽屉表单横向溢出保护和分区收缩行为测试
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补齐级别下拉框、不可见部门选项和部门层级的 7 语言文案；简体中文级别显示统一为 `x 级`
