# 图片审计实际使用渠道列与表格列调整

**日期**: 2026-08-10

## 涉及文件

- `model/image_studio.go`
- `controller/image_studio_storage.go`
- `relay/image_studio_hook.go`
- `web/src/features/security-audit/components/image-audit-columns.tsx`
- `web/src/features/image-studio/api.ts`
- `web/src/features/image-studio/hooks/use-image-studio.ts`
- `web/src/features/image-studio/lib/storage.ts`

## 自 CHANGELOG 说明列迁入

图片审计新增实际使用渠道列：从请求日志回写真实渠道 ID，查询渠道名称并以使用日志样式展示彩色渠道标签；表格列顺序调整为时间、用户、耗时、图片、请求内容、渠道、模型、模式、参数、费用，耗时拆分为独立列
