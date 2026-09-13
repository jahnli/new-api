# 用户管理表格头像悬停资料卡片

**日期**: 2026-08-05

## 涉及文件

- `web/default/src/features/users/components/user-profile-hover-card.tsx` — 新增飞书风格用户资料悬浮卡片（Banner 背景图 + 大头像 + 姓名角色 + 字段列表），解析 custom_field_values JSON 提取职级/职位描述/出生日期/民族/探亲地；按 gender 展示男女图标并附悬浮提示；新增公司名称展示（布局改为左右结构，公司名置于右上角，与用户名/角色/描述区域分离）；字段列表由逐个 JSX 改为 `visibleProfileFields` 数组驱动（先过滤空值再渲染），所有字段为空时同时隐藏分隔横线与字段容器，避免出现下方无内容的孤立横线；无 background_image 时默认 Banner 渐变统一为 `linear-gradient(135deg, rgb(0, 90, 210) 0%, rgb(160, 210, 255) 100%)`
- `web/default/src/features/users/components/users-columns.tsx` — 用户名列头像包裹 UserProfileHoverCard，悬停触发
- `web/default/src/features/users/types.ts` — User schema 新增 department_name、job_title、job_number、mobile、gender、description、background_image、custom_field_values、join_date、company；UserColumnRow 补充 company 字段供表格与卡片使用
- `web/default/src/components/ui/hover-card.tsx` — 基于 @base-ui/react PreviewCard 封装（已有组件）
- `web/default/src/i18n/locales/en.json` — 新增翻译键：Department、Job Title、Job Number、Mobile、Job Level、Job Description、Join Date、Birthday、Ethnicity、Hometown
- `web/default/src/i18n/locales/zh.json` — 对应中文翻译
- `web/default/src/i18n/locales/fr.json` — 对应法语翻译
- `web/default/src/i18n/locales/ja.json` — 对应日语翻译
- `web/default/src/i18n/locales/ru.json` — 对应俄语翻译
- `web/default/src/i18n/locales/vi.json` — 对应越南语翻译
- `web/default/src/i18n/static-keys.ts` — 注册新增的动态翻译键

## 自 CHANGELOG 说明列迁入

用户管理表格头像悬停资料卡片：飞书风格（背景图 Banner + 大头像 + 姓名角色），展示职级、部门、入职日期、邮箱、工号、职务、职位描述等字段；手机号、出生日期、民族、探亲地仅超级管理员可见；支持 custom_field_values 解析与 gender 性别图标及悬浮提示；右上角新增公司名称展示（用户类型补充 company 字段）；6 语言翻译；字段列表改为数据驱动，全部为空时一并隐藏分隔横线与字段区域；无背景图时默认 Banner 渐变统一为蓝色系 rgb(0, 90, 210) → rgb(160, 210, 255)
