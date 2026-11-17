# 用户管理与共享表格交互

**日期**: 2026-11-18

## 用户统计与表格

- 用户列表及搜索返回有效订阅、统计用量、常用模型与启用／禁用人数；人数遵循筛选条件并排除已删除及其他状态。对内统计当前自然月，对外统计全部时间，详见 [对外模式](075-external-mode.md)。
- 有效订阅使用其已用／总额；无订阅按统计期消耗加钱包余额计算总额。显式订阅状态避免查询失败被误判，无效分母不绘制进度。
- 共享“使用量”列展示 Token、费用、请求次数和每亿 Token 单价，列头可切换四项服务端排序；默认按创建时间降序，排序或筛选变化重置分页，行 ID 使用用户 ID 保持跨页选择稳定。
- 用户列表对内默认每页 10 条、对外 100 条，桌面与移动端一致；每页数量优先使用 URL 参数，其次读取当前模式的本地偏好，最后使用默认值。偏好分别保存为 `page-size:users:internal` 与 `page-size:users:external`，不再读取旧 `page-size:users` 偏好。
- “任职概况”合并部门、职级和入职日期，时间列按最后登录／创建时间排列；角色、状态使用列头单选筛选，公司选项来自服务端去重列表。分组展示基础倍率，加载失败仅显示名称。
- 用户管理与部门人员列表共享列、资料卡和分析入口，保留溢出提示、空值及演示脱敏行为。

## 成本中心与分组

- 可配置一个成本中心，以单元素部门 JSON 数组保存并校验公司 ID、部门 ID 和名称，不允许公司根节点；支持回填和清除，完整路径不含公司名。
- 仅在原 `department_name` 为空时用成本中心路径补齐。数据总览按成本中心归属统计本地用户，包含无平台身份成员，原部门信息仍可展示但消费不重复计算。
- 管理员改用户分组时，在同一事务同步全部固定分组 API 密钥并失效缓存；空分组密钥继续继承，`auto` 保留自动路由。

## 用户操作

- 用户删除经确认及绑定目标的 `admin.user.delete` 身份验证后提交，成功刷新列表；超级管理员账户删除入口禁用。
- 批量启用、禁用、删除和改分组逐用户调用现有接口；敏感操作使用绑定目标及动作的一次性凭证，取消验证即停止后续项。
- 跳过当前用户、同级／更高权限、已删除或已为目标状态的账号；改分组先读最新详情，保留其他资料。处理期间防重复提交，结束汇总成功、失败、跳过和未处理项，保留失败及未处理勾选。

## 共享悬停提示

- 普通提示共用全局 100ms 延迟，表头说明和时间图标零延迟；键盘聚焦、减少动态效果和脱敏内容保持一致，不回退原生 `title`。
- `TextTooltip`、`DescriptionTooltip` 复用公共原语，溢出检测共享尺寸与字体监听；长文本桌面悬停、移动端点击展开，额外明细不受仅溢出显示限制。
- 徽章与复制提示识别外层浮层，避免嵌套冲突；可按场景关闭冗余提示而保留复制和无障碍名称。异步日志详情见 [使用日志](056-usage-logs-user-column.md)。

## 实现入口

- `controller/user.go`、`model/user.go`、`model/log.go`、`common/page_info.go` — 统计、筛选、排序、成本中心与分组事务。
- `web/src/features/users/components/shared-user-columns.tsx`、`web/src/features/users/components/users-table.tsx`、`web/src/features/users/components/users-mutate-drawer.tsx` — 共享列、按模式设置默认分页及隔离每页数量偏好、选择与编辑。
- `web/src/features/users/hooks/use-bulk-user-actions.ts`、`web/src/features/users/components/users-delete-dialog.tsx` — 批量与删除。
- `web/src/components/text-tooltip.tsx`、`web/src/components/description-tooltip.tsx`、`web/src/hooks/use-overflow.ts` — 提示及共享溢出观察。
- `web/src/components/data-table/core/column-header.tsx`、`web/src/components/data-table/core/column-filter-header.tsx` — 多排序字段与列头筛选。
