# 数据看板筛选与权限优化

**日期**: 2026-07-25 ~ 09-02（最后更新 09-02）

## 2026-09-02 用户消耗排行悬浮卡片补充 Token 量

- `web/src/features/dashboard/lib/charts.ts` — 用户消耗排行柱状图悬浮提示新增 Token 量展示：按用户聚合四类 Token 合计（非缓存输入、非缓存输出、缓存读取、缓存写入），以字面量「Token」为键名并按亿/万/原始数字自适应格式化；mark（蓝色条）与 dimension（灰色空白带）两种悬浮提示配置保持一致，updateContent 仅重排配额行并跳过 Token 行

## 2026-08-25 用户消耗默认选中

- `web/src/features/dashboard/constants.ts` — 将“用户消耗”调整为模型调用分析的第一个 Tab，并设为管理员默认选项；普通用户仍按权限自动回退到调用趋势

## 涉及文件

- `web/default/src/features/dashboard/index.tsx` — 模型分析与 Flow 共用顶部筛选栏，支持时间范围、时间粒度和超级管理员用户名称筛选；默认筛选时间范围改为当天；筛选区与模块 Tab 位置互换并保持同一行显示，微调时间选择器宽度，移除模型偏好设置按钮并新增重置按钮；统计卡片加载骨架屏顺序同步调整，补充均价卡片占位；移除独立消耗分布与用户统计图表卡片，改由模型调用分析 Tab 统一承载；向模型图表下发管理员权限以控制用户消耗功能。
- `web/default/src/features/dashboard/components/models/model-charts.tsx` — 模型调用分析新增消耗分布、用户消耗排行、用户消耗趋势 Tab；用户消耗类图表按顶部时间筛选器请求数据并复用统一加载态；用户消耗排行与趋势合并为「用户消耗」左右布局，排行左侧标签展示头像和 display_name 并右对齐；用户消耗 Tab 仅向管理员和超级管理员展示，普通用户不触发管理员接口请求，默认配置命中受限 Tab 时自动回退到调用趋势。
- `web/default/src/features/dashboard/lib/charts.ts` — 模型调用分析用户消耗图表使用 display_name 作为趋势系列名称，用户排行隐藏原生轴标签以配合自定义头像标签，并调整左侧轴宽度让图表更靠左。
- `web/default/src/features/dashboard/constants.ts` — 模型调用分析图表选项合并用户消耗排行与趋势，新增「用户消耗」Tab 文案键。
- `web/default/src/features/dashboard/types.ts` — QuotaDataItem 补充 display_name 和 avatar_url 字段，支撑用户消耗图表头像与显示名展示。
- `web/default/src/features/dashboard/components/models/log-stat-cards.tsx` — 均价卡片使用与总费用一致的格式化方式展示为金额/MT，并将统计卡片大屏布局扩展为 6 列。
- `web/default/src/features/dashboard/lib/filters.ts` — 数据看板默认时间范围从滚动 1 天改为当天 00:00:00 到 23:59:59。
- `model/log.go` — 消费日志向 quota_data 写入非缓存输入、非缓存输出、缓存读取和缓存写入 Token 分类数据。
- `model/usedata.go` — 模型调用分析用户名筛选支持通过用户表匹配 username 与 display_name 后回查 quota_data；用户消耗分组查询关联 users 表返回 display_name 与 avatar_url；quota_data 新增四类 Token 字段，并在内存缓存、数据库累加与各维度聚合查询中完整传递。
- `model/usedata_flow.go` — Flow 数据查询复用用户名/display_name 筛选逻辑，保持与模型分析筛选行为一致；聚合结果新增四类 Token 统计。
- `service/quota.go` — Realtime 与音频消费结算按上游 usage 拆分非缓存输入、非缓存输出、缓存读取和缓存写入 Token，并写入数据看板日志。
- `service/text_quota.go` — 文本消费结算兼容 Claude 与 OpenAI usage 语义，计算非缓存输入 Token 并将四类 Token 统计写入数据看板日志。
- `controller/usedata.go` — 移除普通用户模型分析与 Flow 数据接口的 1 个月时间跨度限制，允许按所选时间范围查询。
- `web/default/src/i18n/locales/en.json` — 新增用户名称、用户消耗等文案并清理数据看板筛选相关英文翻译。
- `web/default/src/i18n/locales/zh.json` — 新增用户名称、用户消耗等文案并清理数据看板筛选相关中文翻译。
- `web/default/src/i18n/locales/fr.json` — 新增用户名称、用户消耗等文案并清理数据看板筛选相关法文翻译。
- `web/default/src/i18n/locales/ja.json` — 新增用户名称、用户消耗等文案并清理数据看板筛选相关日文翻译。
- `web/default/src/i18n/locales/ru.json` — 新增用户名称、用户消耗等文案并清理数据看板筛选相关俄文翻译。
- `web/default/src/i18n/locales/vi.json` — 新增用户名称、用户消耗等文案并清理数据看板筛选相关越南文翻译。

## 四类 Token 总量口径统一

- `web/src/features/dashboard/lib/stats.ts` — 汇总统计卡片的总 Token 改为非缓存输入、非缓存输出、缓存读取与缓存写入四类字段相加
- `web/src/features/dashboard/lib/charts.ts` — 模型调用分析图表统一使用四类 Token 合计值
- `web/src/features/dashboard/lib/flow.ts` — Flow 节点 Token 指标统一使用四类 Token 合计值
- `web/src/features/dashboard/types.ts` — 数据看板与 Flow 数据类型补充四类 Token 字段
- `web/src/features/dashboard/lib/flow.test.ts` — Flow 测试数据补充四类 Token 明细，保护新统计口径
