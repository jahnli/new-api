# 显式公司与部门可见范围配置

**日期**: 2026-11-26

- `overview_dept_ids` 保存显式部门节点数组，最多 100 项且不允许空值；选中父部门包含其完整子树，支持跨公司配置。
- 对内 BP 的入口、部门树裁剪、公司及部门接口鉴权按该集合计算；对外普通用户及销售也使用显式授权，未配置时无数据总览访问资格，报表通知不叠加负责人关系。
- 对外节点仅接受 `company:<正整数公司编号>` 或 `dept:<正整数公司编号>:<部门标识>`；整公司授权允许选择公司节点并访问其完整部门树，部门授权仅包含所选子树。无组织平台的公司要求显式整公司授权，不能用部门节点替代。
- 用户编辑复用完整部门树接口 `/api/department/full-tree`，支持搜索、多选、移除和清空，使用精确节点避免重名部门歧义。
- 公司节点能否选择由后端 `disabled` 决定，前端列视图与搜索结果共用判断；禁选节点可展开查看。懒加载占位节点应用相同权限，不能通过未加载状态绕过。
- 应用不再使用 `bp_level` 推导可见层级；已有数据库列保留，不自动转成显式部门配置。

## 实现入口

- `model/user.go`、`controller/user.go` — 数组保存及校验。
- `service/feishu_department.go`、`service/data_overview_company.go`、`service/report_notify.go` — 范围与权限。
- `controller/department.go`、`router/api-router.go` — 完整部门树接口。
- `web/src/features/users/components/dept-multi-select.tsx`、`web/src/features/data-overview/lib/department-selection.ts` — 部门选择。
- `web/src/features/users/components/user-extension-fields.tsx` — 对外普通用户及销售均展示可见范围配置，对内仍仅 BP 展示。
- `web/src/features/users/api.ts`、`web/src/features/users/types.ts` — 完整部门树接口说明与表单字段语义扩展为数据总览可见范围。
