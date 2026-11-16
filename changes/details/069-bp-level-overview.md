# BP 显式可见部门配置

**日期**: 2026-08-21

- `overview_dept_ids` 保存显式部门节点数组，最多 100 项且不允许空值；选中父部门包含其完整子树，支持跨公司配置。
- BP 入口、部门树裁剪、公司及部门接口鉴权、报表通知统一按该集合计算；未配置时无 BP 数据总览访问资格。
- 用户编辑复用完整部门树接口 `/api/department/full-tree`，支持搜索、多选、移除和清空，使用精确节点避免重名部门歧义。
- 公司节点能否选择由后端 `disabled` 决定，前端列视图与搜索结果共用判断；禁选节点可展开查看。懒加载占位节点应用相同权限，不能通过未加载状态绕过。
- 应用不再使用 `bp_level` 推导可见层级；已有数据库列保留，不自动转成显式部门配置。

## 实现入口

- `model/user.go`、`controller/user.go` — 数组保存及校验。
- `service/feishu_department.go`、`service/data_overview_company.go`、`service/report_notify.go` — 范围与权限。
- `controller/department.go`、`router/api-router.go` — 完整部门树接口。
- `web/src/features/users/components/dept-multi-select.tsx`、`web/src/features/data-overview/lib/department-selection.ts` — 部门选择。
