# 数据看板筛选与统计

**日期**: 2026-10-06

- 模型分析与 Flow 共用日期、粒度、查询/重置，默认当天；超级管理员可按 username/display_name 筛选，日期显示完整起止时间，空间不足换行。
- 消耗分布与用户排行/趋势整合到模型分析。管理员默认“用户消耗”，排行显示头像/显示名及 Token 悬浮指标；普通用户回退调用趋势，不请求管理员接口，个人查询不再限制一个月跨度。
- quota_data 写入、缓存及聚合贯穿非缓存输入、非缓存输出、缓存读取和缓存写入，文本、音频、Realtime 兼容对应 usage 语义；看板总量、模型图表、Flow 和用户悬浮指标统一取四类之和。均价与总费用复用货币格式。

入口：`web/src/features/dashboard/`、`model/usedata.go`、`model/usedata_flow.go`、`model/log.go`、`controller/usedata.go`、`service/quota.go`、`service/text_quota.go`。
