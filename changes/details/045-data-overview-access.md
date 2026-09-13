# 数据总览权限开放：BP 角色和部门负责人可访问，部门树按角色层级裁剪；部门负责人动态计算并按部门 ID 定位

**日期**: 2026-07-07

## 涉及文件

- `model/user.go` — User 结构体移除 `IsDeptLeader` 字段；新增 `ComputeIsDeptLeader()`，从 `departments` JSON 匹配 `open_id` 与 `leader_id` 动态判定；新增 `GetLeaderDepartmentIDs()` 返回负责人对应的精确 `department_id`
- `service/feishu_sync.go` — 飞书同步不再写入 `is_dept_leader` 字段，移除相关计算逻辑
- `service/feishu_department.go` — `trimTreeForUser` 重构为支持 BP 角色与部门负责人的部门树裁剪；新增 `trimTreeForBP`（CenterBP 看第一层级、BUBP 看第二层级）、`trimTreeForDeptLeader`（看末级部门）、`splitDepartmentName`、`findNodeByLabel` 辅助函数；`GetDepartmentTree` 改用 `ComputeIsDeptLeader()`；部门负责人裁剪改用 `departments` 中的 `department_id`，并以飞书部门树 `LeaderUserID` 兜底，避免同名末级部门匹配到错误路径
- `middleware/auth.go` — 新增 `BPAuth()` 中间件；`DataOverviewAccessCheck()` 改用 `ComputeIsDeptLeader()` 动态判定
- `router/api-router.go` — 部门路由权限由 `AdminAuth()` 改为 `UserAuth() + DataOverviewAccessCheck()`
- `controller/user.go` — GetSelf 接口 `is_dept_leader` 字段改为 `ComputeIsDeptLeader()` 动态返回
- `web/default/src/stores/auth-store.ts` — AuthUser 接口新增 `is_dept_leader` 属性
- `web/default/src/lib/roles.ts` — 新增 `BU_BP`（2）和 `CENTER_BP`（3）角色常量、标签及图标
- `web/default/src/hooks/use-sidebar-data.ts` — 数据总览侧边栏菜单改为 BP 角色或部门负责人可见（不再限管理员）
- `web/default/src/routes/_authenticated/data-overview/index.tsx` — 路由守卫更新：BP 角色或部门负责人可访问
- `web/default/src/features/data-overview/index.tsx` — 简化 displayTreeData，移除前端租户节点包裹逻辑

## 自 CHANGELOG 说明列迁入

数据总览权限开放：BP 角色与部门负责人可访问数据总览，部门树按角色层级自动裁剪；部门负责人改为动态判定（open_id 匹配 departments 中 leader_id），不再依赖 is_dept_leader 字段，并以 departments 中精确 department_id 定位，避免同名末级部门串路径
