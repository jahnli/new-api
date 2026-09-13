# 新增对外模式：系统行为设置中可隐藏用户内部信息

**日期**: 2026-09-07

## 说明

在系统设置 → 系统行为中新增"对外模式"开关。开启后，用户列表不再显示部门、岗位职级（自定义字段）、入职日期列，后端同时不传这些字段的数据。

## 涉及文件

- `setting/operation_setting/operation_setting.go` — 新增 ExternalModeEnabled 全局变量
- `model/option.go` — 注册 ExternalModeEnabled 配置的持久化与初始化
- `controller/misc.go` — 通过 /api/status 暴露 external_mode_enabled 状态
- `controller/user.go` — 新增 stripExternalModeFields 函数，在 attachSubscriptionQuota 中按对外模式清空部门、岗位、入职日期等字段
- `web/src/features/auth/types.ts` — SystemStatus 类型新增 external_mode_enabled 字段
- `web/src/features/system-settings/types.ts` — OperationsSettings 类型新增 ExternalModeEnabled 字段
- `web/src/features/system-settings/general/system-behavior-section.tsx` — 对外模式开关 UI（label + 描述 + Switch）
- `web/src/features/system-settings/operations/index.tsx` — 默认值新增 ExternalModeEnabled
- `web/src/features/system-settings/operations/section-registry.tsx` — 行为配置传递 ExternalModeEnabled
- `web/src/features/users/components/shared-user-columns.tsx` — useSharedUserColumns 按对外模式条件排除部门、岗位职级、入职日期列
- `web/src/hooks/use-external-mode.ts` — 新增 useExternalMode hook，从 status 读取对外模式状态
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json` — 七语言翻译（对外模式及隐藏用户内部信息）
