# API 密钥界面优化

**日期**: 2026-09-10

## 涉及文件

- `web/default/src/features/keys/components/api-keys-columns.tsx` — 名称列使用 TruncatedCell；分组倍率仅超级管理员可见；IP 限制列新增「快速导入」下拉（含 CC Switch）。
- `web/default/src/features/keys/components/api-keys-mutate-drawer.tsx` — 创建密钥默认选择用户所属分组，空值回退 default；创建/编辑时倍率仅超级管理员可见。
- `web/default/src/features/keys/components/api-keys-cells.tsx` — 新增 QuickImportCell；修复 ApiKeyCell 嵌套三元表达式 lint 错误。
- `web/default/src/features/keys/components/data-table-row-actions.tsx` — 将 CC Switch 移出三点菜单。
- `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json` — 新增「快速导入」翻译。
- `web/src/features/keys/components/dialogs/cc-switch-dialog.tsx` — CC Switch 导入改用独立链接构造，不读取系统服务地址。
- `web/src/features/keys/lib/cc-switch-import.ts` — 官网和 API 端点使用当前页面 Origin，Codex 保留 `/v1`。
- `web/src/features/keys/components/dialogs/__tests__/cc-switch-import-url.test.ts` — 验证缓存 `server_address` 不覆盖当前 Origin 及 Codex 端点规则。
- `web/src/features/keys/components/api-keys-mutate-drawer.tsx` — 打开编辑抽屉时默认展开高级设置，新建 API 密钥时仍默认收起，并在切换目标时重置展开状态。
