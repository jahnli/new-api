# 新增「事业部 AI BP」「中心 AI BP」两个用户角色

**日期**: 2026-07-08

## 涉及文件

- `common/constants.go` — 新增 RoleBUBP=2、RoleCenterBP=3 常量，更新 IsValidateRole 校验
- `model/user.go` — Edit 函数更新字段增加 role，编辑时可修改角色
- `web/default/src/features/users/constants.ts` — USER_ROLE/USER_ROLES/getUserRoleOptions 新增两个角色及图标，角色文案改为「事业部 AI BP」「中心 AI BP」
- `web/default/src/features/users/components/users-mutate-drawer.tsx` — 角色选择器创建和编辑模式均展示，含四个可选角色
- `web/default/src/features/users/lib/user-form.ts` — 编辑用户时向后端发送 role 字段
- `web/default/src/features/users/types.ts` — 角色注释更新
- `web/default/src/i18n/locales/en.json` — 英语翻译
- `web/default/src/i18n/locales/zh.json` — 中文翻译
- `web/default/src/i18n/locales/fr.json` — 法语翻译
- `web/default/src/i18n/locales/ja.json` — 日语翻译
- `web/default/src/i18n/locales/ru.json` — 俄语翻译
- `web/default/src/i18n/locales/vi.json` — 越南语翻译
