# 数据总览 Excel 导出

**日期**: 2026-08-17

- 导出当前授权范围和时间的数据、统计及图表，可选子部门详情和人员列表；跨公司总览按对应公司导出，详情逐部门加载，避免并发过多。
- 金额按系统汇率换算人民币，包含四类 Token、均价、活跃人数/占比、人均 Token、费用超过 10 元人数/占比和费用分桶；模型及系列图表复用页面转换逻辑，经 VChart 离屏渲染嵌入 Excel，顺序、人数单位和数据源与页面同步。
- 按需从平台补充未注册员工姓名，行内仅填写适用资料，标为未注册或离职；额度与消费口径沿用人员列表，不把未注册成员视作已有账户。
- 页面不再统计的平均响应时间和错误率不导出。最新统计口径及权限见 [#043](043-data-overview.md)。

入口：`web/src/features/data-overview/components/export-dialog.tsx`、`web/src/features/data-overview/lib/export-excel.ts`、`web/src/features/data-overview/lib/chart-to-image.ts`、`service/data_overview_company.go`。
