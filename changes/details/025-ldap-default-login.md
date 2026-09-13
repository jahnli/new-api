# 登录页默认使用 LDAP 登录，优化账号切换界面

**日期**: 2026-06-22 ~ 08-25（最后更新 08-25）

## 涉及文件

- `web/src/features/auth/sign-in/components/user-auth-form.tsx` — 重写登录表单：引入 `LoginView` 类型（`ldap` / `password` / `oauth`）和 `activeView` 状态；LDAP 启用时默认展示 LDAP 表单；LDAP 登录由弹窗改为内联表单；底部以分隔线 + 切换按钮在三种视图间导航；企业账号与用户名或邮箱登录入口统一文案并添加对应图标；LDAP 用户名示例移至标签后；普通账号用户名标签高度调整为 16px
- `web/src/features/auth/sign-in/lib/login-view.ts` — 集中维护企业账号、普通账号和其他登录方式对应的标题文案键
- `web/src/features/auth/sign-in/components/__tests__/view-title.test.ts` — 覆盖三种登录视图的标题映射
- `web/src/features/auth/sign-in/index.tsx` — 保持原标题位置和样式，按当前登录视图动态显示“企业账号登录”“账号登录”或“其他登录方式”
- `web/default/src/features/auth/components/oauth-providers.tsx` — 移除 `onLDAPLogin` prop 和 LDAP 按钮（LDAP 已提升为独立视图）；移除未使用的 `Building2` 图标导入
- `web/default/src/features/auth/components/ldap-login-dialog.tsx` — 删除：未被任何组件引用的独立 LDAP 登录弹窗
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 新增企业账号和普通账号登录标题翻译，并将中文切换入口精简为“用户名或邮箱登录”
- `web/default/src/features/auth/sign-in/index.tsx` — 移除“没有账号？注册”提示及注册链接，并将登录标题简化为左对齐布局
