# BP 角色

**日期**: 2026-08-19

新增 BP（`role=2`），前后端使用相同角色值、标签和图标，用户创建及编辑可选择该角色。数据总览权限按显式可见部门配置判断，不按角色级别推导部门层级。

兼容约束：有效角色不包含 `role=3`，当前启动没有将遗留值自动转为 2 的逻辑；旧库升级时须核对角色数据。

## 实现入口

- `common/constants.go`、`model/user.go` — 角色校验及保存。
- `web/src/lib/roles.ts`、`web/src/features/users/constants.ts` — 角色标签及前端入口。
- 部门授权规则见 [BP 可见部门配置](069-bp-level-overview.md)。
