# 移除概览页常见问答面板

**日期**: 2026-09-18

## 涉及文件

- `web/src/features/dashboard/components/overview/faq-panel.tsx` — 删除常见问答面板及其飞书文档外链入口
- `web/src/features/dashboard/components/overview/overview-dashboard.tsx` — 移除常见问答面板的导入、可见性判断与渲染
- `web/src/features/dashboard/hooks/use-status-data.ts` — 删除不再使用的 FAQ 数据查询与可见性字段
- `web/src/features/dashboard/types.ts` — 删除不再使用的 FAQ 数据类型

## 历史变更

- 2026-06-24：常见问答面板曾由 Accordion 问答列表改为居中插画图标和飞书文档外链按钮；经典前端同时停止渲染该面板。
