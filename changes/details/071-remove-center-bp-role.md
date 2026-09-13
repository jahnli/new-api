# 移除中心 BP（role=3），AI BP 改名为 BP

**日期**: 2026-08-19

## 涉及文件

- `common/constants.go` — 删除 `RoleCenterBP = 3` 常量，`IsValidateRole` 移除对应判断
- `middleware/auth.go` — `canAccessDataOverview` 去掉 `RoleCenterBP` 分支，仅保留 `RoleBUBP`
- `service/feishu_department.go` — 部门树裁剪移除 `RoleCenterBP` 条件
- `middleware/data_overview_access_test.go` — 删除 Center BP 用例，AI BP 用例改名 BP
- `service/report_notify_test.go` — `TestGetReportNotifyScopesUsesBpLevelCenter` 中 `RoleCenterBP` 改为 `RoleBUBP`
- `web/src/lib/roles.ts` — 移除 `CENTER_BP: 3`，标签键 `'AI BP'` 改为 `'BP'`，`canAccessDataOverview` 去掉 CENTER_BP 分支
- `web/src/features/users/constants.ts` — 移除 `CENTER_BP` 与 `Briefcase` 导入，`labelKey`、`getUserRoleOptions` 改为 `'BP'`，删除 Center BP 选项
- `web/src/features/users/types.ts` — 注释更新，移除 role=3 描述
- `web/src/features/users/components/user-profile-hover-card.tsx` — 移除 `CENTER_BP` tooltip，`'事业部 AI BP'` 改为 `'BP'`
- `web/src/features/users/components/users-mutate-drawer.tsx` — 角色下拉删除 `value='3'` Center BP 选项，`targetIsBP` 去掉 CENTER_BP 判断，`'AI BP'` 改为 `'BP'`
- `web/src/features/usage-logs/components/common-logs-filter-bar.tsx` — 移除 `ROLE.CENTER_BP` 角色分类过滤值
- `web/src/lib/__tests__/data-overview-access.test.ts` — 移除 CENTER_BP 断言，合并为单一 BP 角色测试
- `web/src/i18n/locales/en.json` — 删除 `"Center BP"`，`"AI BP"` 键改为 `"BP"`
- `web/src/i18n/locales/zh.json` — 删除 `"Center BP": "中心 BP"`，`"AI BP"` 改为 `"BP"`
- `web/src/i18n/locales/zh-TW.json` — 同上（繁体）
- `web/src/i18n/locales/fr.json` — 删除 `"Center BP": "BP de centre"`，`"AI BP"` 改为 `"BP"`
- `web/src/i18n/locales/ja.json` — 删除 `"Center BP": "センター BP"`，`"AI BP"` 改为 `"BP"`
- `web/src/i18n/locales/ru.json` — 删除 `"Center BP": "BP центра"`，`"AI BP"` 改为 `"BP"`
- `web/src/i18n/locales/vi.json` — 删除 `"Center BP": "BP trung tâm"`，`"AI BP"` 改为 `"BP"`
