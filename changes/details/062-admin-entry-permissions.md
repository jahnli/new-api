# 管理入口权限细化

**日期**: 2026-08-27

## 涉及文件

- `web/default/src/hooks/use-sidebar-data.ts` — 渠道、模型、订阅管理、系统信息和系统设置入口增加超级管理员限制，普通管理员不再看到对应左侧菜单。
- `web/default/src/routes/_authenticated/channels/index.tsx` — 渠道路由权限收紧为仅超级管理员，非超级管理员跳转 403。
- `web/default/src/routes/_authenticated/subscriptions/index.tsx` — 订阅管理路由权限收紧为仅超级管理员，非超级管理员跳转 403。
- `web/default/src/routes/_authenticated/models/index.tsx` — 模型管理默认入口权限收紧为仅超级管理员。
- `web/default/src/routes/_authenticated/models/$section.tsx` — 模型管理分区路由权限收紧为仅超级管理员。
- `service/authz/resources_channel.go` — 新增 `channel.interface_view` 渠道界面查看权限且不加入管理员默认授权，Root 仍按超级用户规则自动拥有。
- `service/authz/authz_test.go` — 覆盖 Root 默认允许、管理员默认拒绝、用户级授权与撤销、完整能力矩阵等渠道界面权限行为。
- `controller/user.go` — 编辑用户时按最终角色保存或清理管理员权限，支持普通用户升级管理员时同次授予渠道界面权限，防止降级后旧权限残留。
- `model/user.go` — 角色变化纳入认证版本更新条件，使升降级后旧登录会话失效并重新获取最新权限。
- `model/user_update_test.go` — 验证角色变化递增认证版本并持久化新角色。
- `web/src/lib/admin-permissions.ts` — 注册前端 `interface_view` 动作常量，并统一 Root 的权限放行判断。
- `web/src/components/layout/types.ts` — 侧栏导航项增加可复用的 `requiredPermission` 资源与动作声明。
- `web/src/hooks/use-sidebar-data.ts` — 渠道入口由仅 Root 可见改为 Admin 角色且有渠道界面查看权限时可见。
- `web/src/hooks/use-sidebar-view.ts` — 在角色和侧栏模块过滤基础上增加管理员权限矩阵过滤。
- `web/src/routes/_authenticated/channels/index.tsx` — 渠道路由改为 Admin 角色与 `channel.interface_view` 双重校验，未授权访问跳转 403。
- `web/src/lib/__tests__/channel-interface-access.test.ts` — 验证管理员默认关闭、显式授权、Root 放行和权限目录归一化默认值。
- `web/src/i18n/static-keys.ts` — 登记后端动态返回的渠道界面权限名称和说明，避免翻译同步时遗漏。
- `web/src/i18n/locales/en.json` — 增加渠道界面查看权限的英文名称与说明。
- `web/src/i18n/locales/zh.json` — 增加“渠道界面查看”和“访问渠道管理界面”的简体中文文案。
- `web/src/i18n/locales/zh-TW.json` — 增加渠道界面查看权限的繁体中文文案。
- `web/src/i18n/locales/fr.json` — 增加渠道界面查看权限的法语文案。
- `web/src/i18n/locales/ja.json` — 增加渠道界面查看权限的日语文案。
- `web/src/i18n/locales/ru.json` — 增加渠道界面查看权限的俄语文案。
- `web/src/i18n/locales/vi.json` — 增加渠道界面查看权限的越南语文案。
