# 对外模式：隐藏内部信息、限制分流分组可见性并调整用户统计范围

**日期**: 2026-09-17

## 说明

在系统设置 → 系统行为中提供“对外模式”开关。开启后，用户列表隐藏包含部门、岗位职级（自定义字段）与入职日期的“任职概况”列，后端清空相关内部信息。保存开关后刷新前端状态缓存，使已有的列隐藏逻辑及时生效，关闭后恢复显示。

对外模式下，除超级管理员外，数据看板的分流页面不显示分组列、分组切换入口或分组筛选项；`/api/data/flow` 与 `/api/data/flow/self` 响应省略 `use_group` 字段。前端按分组可见性区分查询缓存，过滤失效的选中项，并在可见列不足时仅恢复允许显示的列，避免重新展示分组。超级管理员保留分流分组功能，登录与刷新响应中的 `data.user.group` 保持不变。

用户列表和搜索结果中的费用、Token、请求数、均价与常用模型在对外模式下按全部时间统计，关闭后恢复当月统计，相关排序使用相同范围的数据。无有效订阅时的已用额度及总额度回退值同步使用该范围的消耗；有效订阅的额度仍使用订阅自身记录。为保持接口兼容，沿用现有 `monthly_*` 字段名。前端按对外模式区分用户列表缓存，切换时不展示上一种模式的占位数据，并隐藏“固定为当月”的额度说明。

## 涉及文件

- `setting/operation_setting/operation_setting.go` — 新增 ExternalModeEnabled 全局变量
- `model/option.go` — 注册 ExternalModeEnabled 配置的持久化与初始化
- `controller/misc.go` — 通过 /api/status 暴露 external_mode_enabled 状态
- `controller/user.go` — 在 attachSubscriptionQuota 中按对外模式清空部门、岗位、入职日期等字段，并将用户统计和常用模型查询切换为全部时间；关闭后恢复当月
- `web/src/features/auth/types.ts` — SystemStatus 类型新增 external_mode_enabled 字段
- `web/src/features/system-settings/types.ts` — OperationsSettings 类型新增 ExternalModeEnabled 字段
- `web/src/features/system-settings/general/system-behavior-section.tsx` — 对外模式开关 UI（label + 描述 + Switch）
- `web/src/features/system-settings/operations/index.tsx` — 默认值新增 ExternalModeEnabled
- `web/src/features/system-settings/operations/section-registry.tsx` — 行为配置传递 ExternalModeEnabled
- `web/src/features/users/components/shared-user-columns.tsx` — 按对外模式排除任职概况列，并隐藏额度列“固定为当月”的说明
- `web/src/features/users/components/users-table.tsx` — 查询缓存键包含对外模式状态，切换时重新获取列表且不沿用另一模式的占位数据
- `web/src/hooks/use-external-mode.ts` — 新增 useExternalMode hook，从 status 读取对外模式状态
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json` — 七语言翻译（对外模式及隐藏用户内部信息）
- `controller/usedata.go` — 两个分流接口在对外模式下按请求者角色清空非超级管理员响应中的分组数据
- `model/usedata_flow.go` — 分流响应的 use_group 增加空值省略标记，清空后不再序列化该字段
- `web/src/features/dashboard/components/flow/flow-charts.tsx` — 按对外模式和角色移除分组展示与选择入口，隔离查询缓存并处理模式切换后的列和筛选状态
- `web/src/features/system-settings/hooks/use-update-option.ts` — 保存对外模式开关后失效状态查询并清理持久化状态缓存
