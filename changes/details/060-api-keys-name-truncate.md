# API 密钥界面

**日期**: 2026-11-20

- 名称列截断显示。新建密钥默认使用用户所属分组，缺失时回退到 `default`。仅超级管理员可见分组倍率。
- 高级设置在新建时默认收起，编辑时默认展开。切换目标会重置展开状态。
- 密钥列表的快速导入菜单支持 CC Switch 和 Magpie。CC Switch 使用当前页面的 Origin 生成官网地址和 API 端点，Codex 端点保留 `/v1`。
- 导入 Magpie 时，用户选择目标应用（默认 Codex，也支持 Claude 和 Gemini）、填写配置名称，并从当前密钥有权访问的模型中选择一个。切换应用会清空模型选择，模型列表加载失败时可重试。
- 打开 Magpie 时，配置包含所选模型、当前密钥和应用对应的端点。网关地址优先取 `server_address`，留空时使用当前页面的 Origin。Codex 使用 `/v1`，Claude 使用网关根路径，Gemini 使用 `/v1beta`。

## 实现入口

- `web/src/features/keys/components/api-keys-columns.tsx`、`web/src/features/keys/components/api-keys-mutate-drawer.tsx` 负责列表列定义和密钥编辑表单。
- `web/src/features/keys/components/api-keys-cells.tsx`、`web/src/features/keys/components/api-keys-dialogs.tsx` 负责快速导入菜单和弹窗切换。
- `web/src/features/keys/components/dialogs/magpie-dialog.tsx` 负责选择应用、填写名称和加载可用模型。
- `web/src/features/keys/lib/cc-switch-import.ts`、`web/src/features/keys/lib/magpie-import.ts` 分别构建两种客户端的导入链接。
