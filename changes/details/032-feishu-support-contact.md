# 飞书支持联系人入口

**日期**: 2026-09-05

## 涉及文件

- `setting/system_setting/feishu.go` — 读取并注册 FEISHU_SUPPORT_OPEN_ID 环境变量
- `controller/misc.go` — 系统状态响应中暴露飞书支持联系人 openId
- `web/src/components/feishu-support-link.tsx` — 提供首页与错误页共用的飞书联系卡片，动态构造 applink
- `web/src/features/home/components/sections/cta.tsx` — 首页底部改用共享飞书联系卡片，未配置联系人时隐藏
- `web/src/features/errors/general-error.tsx` — 错误页以共享飞书联系卡片替换 GitHub Issues 反馈入口
- `web/src/features/errors/__tests__/general-error.test.tsx` — 覆盖错误页飞书联系入口及 GitHub 反馈入口移除行为
