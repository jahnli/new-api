# 个人资料页与日志 IP 记录设置调整

**日期**: 2026-11-03

## 涉及文件

- `web/src/features/profile/components/profile-header.tsx` — 个人资料头部改为左侧挂绳头像、右侧身份信息与账户统计，移除重复的小头像；用户名与邮箱配图标，用户编号显示为 `#ID` 并保留复制功能；移动端头像在上、资料在下，加载期间头像区域保留透明空间；保留邮箱旁不显示分组与 API 请求数万前加空格。
- `web/src/features/profile/components/profile-lanyard.tsx` — 接入按需加载的挂绳头像，正反两面均铺满当前用户照片，绳带使用亮蓝色；头像与首帧准备好后显示，移除操作提示和吊牌骨架占位；减少动态效果或三维渲染不可用时显示静态卡片，头像缺失或加载失败时使用备用卡面。
- `web/src/features/profile/lib/lanyard-texture.ts` — 在浏览器内生成头像缺失时的备用卡面，展示姓名缩写、姓名、用户名、角色和用户编号。
- `web/src/components/Lanyard.tsx` — 引入并适配 React Bits 三维挂绳组件，支持拖动摆动、点击翻转、离屏暂停与资源释放；增加首帧就绪和渲染不可用回调，提高小画布渲染精度，并关闭哑光卡面的颗粒凹凸效果。
- `web/package.json`、`web/bun.lock` — 增加 `three` 运行依赖及 `@types/three` 类型依赖并同步锁文件。
- `web/default/src/features/profile/components/tabs/notification-tab.tsx` — 记录使用和错误日志 IP 地址选项默认开启，仅在超级管理员账号下显示开关。
- `controller/user.go` — 保存个人设置时仅允许超级管理员修改 `record_ip_log`，非超级管理员保留原设置。
- `dto/user_settings.go` — 调整 `record_ip_log` 设置序列化，明确该选项默认开启且仅超级管理员可关闭。
- `model/user.go` — 用户设置读取与新用户初始化时默认开启 `record_ip_log`。
- `model/user_cache.go` — 用户设置缓存读取时默认开启 `record_ip_log`。

## 加载行为说明

头像加载完成后才挂载按需加载的三维组件；首帧就绪前保持透明。资源并行加载与可视区域内轻摆入场尚未实现，不作为本次已完成的性能优化记录。
