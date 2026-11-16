# 首页定制

**日期**: 2026-09-02

- 移除 Footer、开源特性卡片、常用应用推荐区和 CTA 推广内容，底部复用飞书支持联系人卡片，未配置联系人时隐藏。
- Hero 右侧使用桌面端双轨道模型图标动画；三步上手提供 API 密钥链接、API Base URL 与自适应连接线动画。
- 统计区使用图标玻璃卡片和数字微光，Hero 标题保留扫光；适配暗色和减少动态效果设置。
- 全局注册与密码注册同时开启时，“开始使用”旁展示“创建账户”，链接至 `/sign-up`。

## 实现入口

- `web/src/features/home/` — Hero、步骤、统计、CTA 与轨道动画。
- `web/src/components/feishu-support-link.tsx` — 共用支持联系人入口。
- `web/src/styles/index.css` — 动画及减少动态效果样式。
