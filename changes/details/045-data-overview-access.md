# 数据总览入口与部门负责人判定

**日期**: 2026-11-26

- 管理员可进入数据总览；对内 BP 需至少配置一个可见部门，其他用户仅在其为部门负责人时可进入；对外普通用户及销售统一按显式公司或部门授权，不从负责人关系自动扩大范围。
- 对外侧栏按模式及有效节点格式判断入口；路由进入时重新请求已授权部门树，收到 403 跳转无权限页，避免只依赖登录时的授权快照。管理员仍直接通过前端入口检查。
- 公司与部门权限在每次统计请求读取人员范围缓存前重新检查，撤销授权后不能继续使用此前缓存的范围。
- 负责人从当前平台身份与已存部门领导关系动态计算，不依赖持久化的 `is_dept_leader` 标记；部门授权按精确 ID 定位，避免同名部门串路径。
- BP 及对外普通用户的树裁剪与跨公司范围使用显式集合，具体规则见 [可见部门配置](069-bp-level-overview.md)。

## 实现入口

- `model/user.go` — `ComputeIsDeptLeader`、`GetLeaderDepartmentIDs`。
- `middleware/auth.go`、`router/api-router.go` — 服务端入口检查。
- `service/feishu_department.go`、`service/data_overview_company.go` — 平台身份与树裁剪。
- `web/src/lib/roles.ts`、`web/src/routes/_authenticated/data-overview/index.tsx` — 前端入口检查。
- `web/src/hooks/use-sidebar-data.ts` — 按对外模式与显式授权显示侧栏入口。
