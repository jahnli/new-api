# 图片审计实际渠道

**日期**: 2026-08-10

生成记录从消费日志回写实际渠道 ID，批量补充名称，复用使用日志的编号、名称、悬停与演示遮罩，不以请求预选渠道代替真实渠道。

表格按时间、用户、耗时、图片、请求内容、渠道、模型、模式、参数、费用排列，耗时独立显示；身份和渠道沿用日志的弱化文字及常规字重，演示模式禁用渠道复制。

入口：`model/image_studio.go`、`controller/image_studio_storage.go`、`relay/image_studio_hook.go`、`web/src/features/security-audit/components/image-audit-columns.tsx`、`web/src/features/image-studio/hooks/use-image-studio.ts`。
