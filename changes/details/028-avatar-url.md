# 用户头像使用 avatar_url

**日期**: 2026-06-23

登录及个人信息响应返回 avatar_url，前端身份类型透传。顶部菜单、移动端抽屉及个人资料优先使用用户照片，无图时回退首字母或对应卡面；个人资料挂绳表现见 [#051](051-profile-settings.md)。

入口：`controller/user.go`、`web/src/stores/auth-store.ts`、`web/src/components/profile-dropdown.tsx`、`web/src/components/layout/components/mobile-drawer.tsx`。
