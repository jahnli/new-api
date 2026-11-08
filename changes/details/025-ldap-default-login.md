# 登录页企业统一登录优先、账号切换与玻璃光球背景

**日期**: 2026-11-09

## 2026-11-09：企业登录入口与登录页视觉调整

- `web/src/features/auth/sign-in/components/user-auth-form.tsx` — 开启 OIDC 时默认展示企业统一登录视图，优先于对外模式的账号密码默认项；未开启 OIDC 时沿用对外模式、LDAP 和其他可用方式的回退顺序。账号密码视图标题改为“用户名和密码登录”，保留登录方式切换，并为账号、密码输入补充浏览器自动填充属性。
- `web/src/features/auth/components/oauth-providers.tsx` — OIDC 按钮统一显示“企业统一登录”及企业图标；企业登录作为主要入口时采用主题色按钮，隐藏上方重复分隔提示，其他提供商继续使用描边按钮；长文案允许换行。
- `web/src/features/auth/sign-in/index.tsx` — 登录页固定显示“欢迎回来”，下方显示当前登录方式；复用卡片组件组织透明登录区域并启用品牌背景布局。
- `web/src/features/auth/auth-layout.tsx` — 桌面端采用左侧品牌面板与右侧登录区，左侧展示品牌、玻璃光球和底部 AI WORKSPACE 标识；移除“连接模型，释放创造力”标语。光球在小范围内随机漂移，每段移动持续 2～4 秒，阴影同步偏移、缩放和改变深浅；页面隐藏或小屏时停止随机目标更新。
- `web/src/styles/login-brand-background.css` — 品牌面板使用浅蓝背景和柔和光带，玻璃光球带有流动高光、折射及柔影，定位于面板中心略偏下；系统开启“减少动态效果”时关闭光球运动和光影动画。
- `web/src/features/auth/components/login-aurora.tsx`、`web/src/features/auth/components/login-aurora.css` — 新增极光背景渲染与样式，支持指针响应、尺寸变化和静态降级；页面隐藏时暂停绘制，卸载时释放图形资源。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补充企业统一登录、用户名和密码登录及品牌标语翻译；品牌标语在最终页面中已移除。

以下为此前登录页调整的历史记录，默认视图与标题以本节为准。

## 涉及文件

- `web/src/features/auth/sign-in/components/user-auth-form.tsx` — 重写登录表单：引入 `LoginView` 类型（`ldap` / `password` / `oauth`）和 `activeView` 状态；对外模式开启且密码登录可用时默认展示账号密码表单，否则保留 LDAP 优先及其他已启用方式的回退逻辑；LDAP 登录由弹窗改为内联表单；底部以分隔线 + 切换按钮在三种视图间导航；企业账号与用户名或邮箱登录入口统一文案并添加对应图标；LDAP 用户名示例位于标签后，仅在对外模式关闭时显示；普通账号用户名标签高度调整为 16px
- `web/src/features/auth/sign-in/lib/login-view.ts` — 集中维护企业账号、普通账号和其他登录方式对应的标题文案键
- `web/src/features/auth/sign-in/components/__tests__/view-title.test.ts` — 覆盖三种登录视图的标题映射
- `web/src/features/auth/sign-in/index.tsx` — 保持原标题位置和样式，按当前登录视图动态显示“企业账号登录”“账号登录”或“其他登录方式”
- `web/default/src/features/auth/components/oauth-providers.tsx` — 移除 `onLDAPLogin` prop 和 LDAP 按钮（LDAP 已提升为独立视图）；移除未使用的 `Building2` 图标导入
- `web/default/src/features/auth/components/ldap-login-dialog.tsx` — 删除：未被任何组件引用的独立 LDAP 登录弹窗
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 新增企业账号和普通账号登录标题翻译，并将中文切换入口精简为“用户名或邮箱登录”
- `web/default/src/features/auth/sign-in/index.tsx` — 移除“没有账号？注册”提示及注册链接，并将登录标题简化为左对齐布局
