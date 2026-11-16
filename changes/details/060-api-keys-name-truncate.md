# API 密钥界面

**日期**: 2026-09-10

- 名称列截断显示；创建默认用户所属分组，缺失回退 default，分组倍率仅超级管理员可见。
- 高级设置新建默认收起、编辑默认展开，切换目标重置状态。
- 表格增加快速导入列，CC Switch 从行菜单移入；官网及 API 端点使用当前页面 Origin，Codex 端点保留 /v1，不受缓存 server_address 覆盖。

入口：`web/src/features/keys/components/api-keys-columns.tsx`、`web/src/features/keys/components/api-keys-mutate-drawer.tsx`、`web/src/features/keys/components/api-keys-cells.tsx`、`web/src/features/keys/lib/cc-switch-import.ts`。
