# 移除用户签到功能

**日期**: 2026-09-22

## 涉及文件

- `controller/checkin.go` — 删除签到状态查询与执行签到接口处理器
- `controller/misc.go` — 从公开状态响应中移除签到启用状态
- `model/checkin.go` — 删除签到记录模型、统计查询、每日去重与随机额度奖励逻辑
- `model/main.go` — 停止自动迁移签到记录表
- `router/api-router.go` — 删除用户签到状态查询与执行签到路由
- `setting/operation_setting/checkin_setting.go` — 删除签到开关及奖励额度范围配置
- `i18n/keys.go` — 删除后端签到相关国际化键
- `i18n/locales/en.yaml` — 清理后端英文签到文案
- `i18n/locales/zh-CN.yaml` — 清理后端简体中文签到文案
- `i18n/locales/zh-TW.yaml` — 清理后端繁体中文签到文案
- `web/src/features/profile/api.ts` — 删除签到状态查询与签到请求方法
- `web/src/features/profile/components/checkin-calendar-card.tsx` — 删除个人资料页签到日历卡片
- `web/src/features/profile/index.tsx` — 从个人资料页移除签到卡片入口
- `web/src/features/profile/types.ts` — 删除签到状态、统计与记录类型
- `web/src/features/system-settings/billing/index.tsx` — 移除签到配置导出
- `web/src/features/system-settings/billing/section-registry.tsx` — 从计费设置中移除签到配置区块
- `web/src/features/system-settings/general/checkin-settings-section.tsx` — 删除签到开关与奖励范围设置界面
- `web/src/features/system-settings/operations/index.tsx` — 移除签到设置区块导出
- `web/src/features/system-settings/operations/section-registry.tsx` — 清理运维设置中的签到配置映射
- `web/src/features/system-settings/types.ts` — 删除签到设置字段类型
- `web/src/i18n/locales/en.json` — 清理前端英文签到文案
- `web/src/i18n/locales/fr.json` — 清理前端法文签到文案
- `web/src/i18n/locales/ja.json` — 清理前端日文签到文案
- `web/src/i18n/locales/ru.json` — 清理前端俄文签到文案
- `web/src/i18n/locales/vi.json` — 清理前端越南文签到文案
- `web/src/i18n/locales/zh-TW.json` — 清理前端繁体中文签到文案
- `web/src/i18n/locales/zh.json` — 清理前端简体中文签到文案

## 变更说明

用户个人资料页不再展示签到日历，也不再提供每日签到领取随机额度的操作。后端同步删除签到接口、路由、配置、记录模型、统计与奖励逻辑，并停止为新数据库迁移签到表；系统设置中的签到开关和奖励范围配置以及相关多语言文案一并移除。
