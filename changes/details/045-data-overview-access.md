# 数据总览入口与部门负责人判定

**日期**: 2026-07-07

- 管理员可进入数据总览；BP 需至少配置一个可见部门；其他用户仅在其为部门负责人时可进入。服务端、路由守卫和侧栏入口使用一致条件。
- 负责人从当前平台身份与已存部门领导关系动态计算，不依赖持久化的 `is_dept_leader` 标记；部门授权按精确 ID 定位，避免同名部门串路径。
- BP 树裁剪与跨公司范围使用显式部门集合，具体规则见 [可见部门配置](069-bp-level-overview.md)。

## 实现入口

- `model/user.go` — `ComputeIsDeptLeader`、`GetLeaderDepartmentIDs`。
- `middleware/auth.go`、`router/api-router.go` — 服务端入口检查。
- `service/feishu_department.go`、`service/data_overview_company.go` — 平台身份与树裁剪。
- `web/src/lib/roles.ts`、`web/src/routes/_authenticated/data-overview/index.tsx` — 前端入口检查。
