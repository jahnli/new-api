# 彻底移除前端系统更新功能

**日期**: 2026-09-22

## 涉及文件

- `web/src/components/layout/components/app-header.tsx` — 移除登录后顶栏中的版本号与更新检查入口
- `web/src/components/layout/components/public-header.tsx` — 移除公开页头中的版本号与更新检查入口
- `web/src/features/system-settings/maintenance/update-checker-section.tsx` — 删除系统设置中的版本、运行时间与更新检查区块
- `web/src/features/system-update/api.ts` — 删除版本查询与系统更新请求封装
- `web/src/features/system-update/releases.ts` — 删除发布版本解析与版本比较逻辑
- `web/src/features/system-update/store.ts` — 删除系统更新状态与本地持久化管理
- `web/src/features/system-update/system-update-action.tsx` — 删除更新检查操作入口
- `web/src/features/system-update/system-update-dialog.tsx` — 删除系统更新弹框
- `web/src/features/system-update/use-system-update.ts` — 删除更新检查与网络状态处理 Hook
- `web/src/features/system-update/__tests__/releases.test.ts` — 删除发布版本解析相关测试
- `web/src/features/system-update/__tests__/update-checking.test.tsx` — 删除系统更新交互相关测试
- `web/src/i18n/locales/en.json` — 清理英文系统更新文案
- `web/src/i18n/locales/fr.json` — 清理法文系统更新文案
- `web/src/i18n/locales/ja.json` — 清理日文系统更新文案
- `web/src/i18n/locales/ru.json` — 清理俄文系统更新文案
- `web/src/i18n/locales/vi.json` — 清理越南文系统更新文案
- `web/src/i18n/locales/zh-TW.json` — 清理繁体中文系统更新文案
- `web/src/i18n/locales/zh.json` — 清理简体中文系统更新文案

## 变更说明

先前仅移除了顶栏和公开页头中的系统版本及更新检查按钮，系统设置仍保留更新检查区块，前端也继续包含发布版本查询、版本比较、更新状态管理与提示弹框。本次继续删除这些剩余实现及相关多语言文案，使前端不再提供系统更新检查功能。
