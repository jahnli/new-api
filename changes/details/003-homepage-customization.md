# 首页定制

**日期**: 2026-09-02

## 涉及文件

- `web/default/src/features/home/index.tsx` — 移除主页底部 Footer 组件引用与 CTA 组件的 isAuthenticated 传递
- `web/default/src/layout/components/footer.tsx` — 移除 Footer 组件
- `web/default/src/features/home/components/sections/hero.tsx` — 移除「常用应用支持」整块区域（标题、描述、Cherry Studio / CC Switch / 更多应用卡片链接）及未使用的 `CherryStudio` import、`MoreIcon` 组件；底部内边距缩短约一半；右侧列由 HeroTerminalDemo 换为 OrbitAnimation 轨道动画（仅桌面端 `lg:` 显示）并移除前者 import；移除「查看定价」按钮
- `web/default/src/features/home/components/orbit-animation.tsx` — 新增轨道动画组件：内圈 3 图标（DeepSeek、Zhipu、Minimax）顺时针、外圈 5 图标（Claude、OpenAI、Gemini、Grok、Midjourney）逆时针旋转，图标随环旋转，两环偏移定位（非同心）
- `web/default/src/styles/index.css` — 新增轨道动画 CSS：@keyframes orbit/orbit-reverse，.orbit-ring/.orbit-ring-inner/.orbit-ring-outer、.orbit-dot，含暗色模式与 reduced-motion 支持
- `web/default/src/features/home/components/sections/features.tsx` — 移除「开源项目（Open Source）」附加特性卡片，清理 `HeartHandshake` import，网格布局 `md:grid-cols-4` 改为 `md:grid-cols-3`；「极速」卡片模型标签 Qwen / Llama 换为 GLM / Kimi
- `web/default/src/features/home/constants.ts` — 从 `DEFAULT_FEATURES` 数组移除 `Open Source` 条目
- `web/default/src/features/home/components/sections/how-it-works.tsx` — 第一步「配置」中 API Keys 改为主题色可点击链接（跳转 `/keys`），第二步「连接」新增 API Base URL 提示，描述区 max-width 放宽到 280px；布局改为 5 列（3 卡片 + 2 连接线容器）集成 `StepConnectionLine` 组件
- `web/default/src/features/home/components/step-connection-line.tsx` — 新增步骤连接线动画组件：SVG 贝塞尔曲线路径，主题色渐变流动虚线 + 三级脉冲粒子，辉光滤镜，循环播放，ResizeObserver 自适应尺寸
- `web/default/src/features/home/components/sections/cta.tsx` — 底部新增飞书联系信息区块（Feishu 图标链接、AI 工程效率科・李佳衡、遇到问题？飞书聊一聊）；后移除 CTA 推广区（「准备好简化/你的 AI 集成了吗？」标题、「部署你自己的网关…」描述、「开始使用/查看定价」按钮），仅留飞书联系卡片
- `web/default/src/i18n/locales/en.json` — 添加 "MODELS" 翻译键（备用）；移除 Footer 组件 14 个翻译 key；移除 `Ready to simplify`、`your AI integration?`、`Deploy your own gateway...`、`View Pricing` 共 4 个翻译键
- `web/default/src/i18n/locales/zh.json` — 新增 Trans 组件 key 与飞书联系信息中文翻译；`API Base URL` 中文翻译改为保留英文术语；添加 "MODELS": "模型" 翻译（备用）；移除 Footer 组件 14 个翻译 key 和 `Ready to simplify` 等 4 个翻译键
- `web/default/src/i18n/locales/ru.json` — 移除 Footer 组件 14 个翻译 key 与 `Ready to simplify` 等 4 个翻译键
- `web/default/src/i18n/locales/fr.json` — 同上
- `web/default/src/i18n/locales/ja.json` — 同上
- `web/default/src/i18n/locales/vi.json` — 同上
- `web/default/src/features/home/components/sections/stats.tsx` — 统计数字外层 span 添加 `stat-shimmer` class 触发白色微光扫光动画；引入 lucide 图标（Layers/DollarSign/Code/Gauge），每个 stat 改为 glass-3 毛玻璃卡片 + 彩色图标 + 左对齐布局，数字字号放大到 text-3xl/4xl，网格间距 gap-8 收紧到 gap-4
- `web/default/src/styles/index.css` — 新增 `.stat-shimmer` CSS：`::after` 伪元素白色渐变光带，`translateX` 关键帧从左到右扫过，2.5s 循环、首次延迟 2s，含 reduced-motion 支持
- `web/default/src/components/layout/components/public-header.tsx` — 公开页面 Header 未滚动时 max-width 由 max-w-7xl（1280px）加宽到 max-w-[90rem]（1440px）
- `web/default/src/features/home/components/sections/hero.tsx` — Hero 区域 max-width 由 max-w-6xl（1152px）加宽到 max-w-7xl（1280px）
- `web/default/src/features/home/components/sections/stats.tsx` — Stats 区域 max-width 由 max-w-6xl 加宽到 max-w-7xl
- `web/default/src/features/home/components/sections/features.tsx` — Features 区域 max-width 由 max-w-6xl 加宽到 max-w-7xl
- `web/default/src/features/home/components/sections/how-it-works.tsx` — HowItWorks 区域 max-width 由 max-w-6xl 加宽到 max-w-7xl
- `web/default/src/features/home/components/orbit-animation.tsx` — 双轨道动画整体左移（内环 left 45%→26%，外环 55%→36%）
- `web/default/src/features/home/components/sections/hero.tsx` — Hero 渐变标题「海量 AI 模型」添加 `hero-gradient-shimmer` class 实现白色微光扫光动画
- `web/default/src/styles/index.css` — 新增 `.hero-gradient-shimmer` 样式：`::after` 伪元素白色渐变光带，3.5s 循环，1.5s 延迟，暗色模式降低光带透明度，含 reduced-motion 支持
- `web/src/features/home/components/sections/hero.tsx` — 全局注册与密码注册开关同时开启时，在首页 Hero 的「开始使用」旁新增同尺寸同样式「创建账户」按钮并跳转 `/sign-up`；关闭任一开关时仅保留原入口
- `web/src/features/home/components/sections/__tests__/registration-action.test.tsx` — 覆盖两个按钮并存且样式一致、注册链接目标以及两个注册开关的隐藏条件

## 自 CHANGELOG 说明列迁入

首页定制：移除 Footer/区块/开源卡片/CTA 推广区与 HeroViewPricing 按钮；替换模型标签；优化三步上手与连接线动画；Hero 右侧轨道动画替换 Terminal Demo；底部加飞书联系信息；新增统计微光动画与 glass 卡片 UI；加宽 Header 与内容区，轨道动画左移，Hero 渐变标题加微光扫光；清理 Footer/CTA/Hero 相关翻译；密码注册开启时在开始使用旁新增同样式创建账户按钮并跳转注册页
