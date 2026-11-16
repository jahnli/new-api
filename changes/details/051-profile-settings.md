# 个人资料与日志 IP 设置

**日期**: 2026-11-15

- 个人资料左侧为按需加载的三维照片挂绳，支持拖动摆动、点击翻转、离屏暂停和资源释放；右侧整合身份与账户统计，编号显示 #ID 并可复制，邮箱旁不重复展示分组。
- 头像与首帧就绪后展示，此前保留透明空间；移动端上下排列。减少动态效果或渲染不可用时使用静态卡片，无头像/加载失败时生成含姓名缩写、用户名、角色和编号的清晰备用卡面。
- 备用纹理与三维卡面匹配，保留必要身份文字，移除顶部品牌与操作提示；请求数使用统一数字单位间距。
- record_ip_log 默认开启，仅超级管理员可更改；服务端对其他角色保留原设置，新用户及缓存读取同样应用默认值。

入口：`web/src/features/profile/components/profile-header.tsx`、`web/src/features/profile/components/profile-lanyard.tsx`、`web/src/features/profile/lib/lanyard-texture.ts`、`web/src/components/Lanyard.tsx`、`web/src/features/profile/components/tabs/notification-tab.tsx`、`controller/user.go`、`relaykit/dto/user_settings.go`、`model/user.go`、`model/user_cache.go`。
