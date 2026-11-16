# 企业统一登录优先与登录页布局

**日期**: 2026-11-16

- OIDC 开启时默认展示“企业统一登录”，否则按已启用的登录方式回退；保留账号密码切换，输入框支持浏览器自动填充。
- 页面使用“欢迎回来”标题和当前登录方式副标题；企业登录作为主要入口时使用主题色按钮，其他方式保留描边样式。
- 桌面端左右分栏，品牌区使用浅蓝极光与玻璃光球；小屏、页面隐藏和减少动态效果场景暂停或降级动画，卸载释放图形资源。

## 实现入口

- `web/src/features/auth/sign-in/`、`web/src/features/auth/components/oauth-providers.tsx` — 视图选择及登录入口。
- `web/src/features/auth/auth-layout.tsx`、`web/src/styles/login-brand-background.css` — 品牌区与光球。
- `web/src/features/auth/components/login-aurora.tsx` — 极光背景与静态降级。
