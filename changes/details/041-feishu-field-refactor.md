# 员工资料字段独立存储

**日期**: 2026-11-09

- 用户资料以 `display_name`、头像、工号、职务、部门、负责人、入职日期等独立字段存储；职级、职位描述、出生日期、探亲地、民族分别使用 `job_level`、`job_description`、`birthday`、`hometown`、`ethnicity`。
- 现有数据库的 `custom_field_values` 旧列保留，应用不再映射或读写，不在启动时自动回填；旧 JSON 数据需要单独迁移至对应列。
- 当前新增用户的员工资料来自 OIDC 首次注册映射；后续登录不更新资料。
- 对外模式清空内部资料响应，展示规则见 [用户资料卡片](042-user-profile-hover-card.md)。

## 实现入口

- `model/user.go` — 资料字段与持久化。
- `service/oidc_profile.go` — 已验证 OIDC 属性到用户资料的映射。
- `controller/user.go` — 对外模式响应裁剪。
