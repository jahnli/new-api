# 移除前端更新检查

**日期**: 2026-09-22

登录和公开页头、系统设置不提供版本及更新检查入口，删除前端发布查询、版本比较、状态持久化、提示弹框和专属翻译。范围为前端更新功能。

入口：`web/src/components/layout/components/app-header.tsx`、`web/src/components/layout/components/public-header.tsx`、`web/src/features/system-settings/maintenance/`；原 web/src/features/system-update/ 已删除。
