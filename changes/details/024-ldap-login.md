# 公司注册规则与平台身份

**日期**: 2026-11-16

- 公司注册规则保存在 `company_registration.configs`，仅含公司原名、显示名称和自动订阅套餐；显示名称留空使用原名，匹配时先原名、后显示名。
- 保存显示名称变化时同步已有用户的公司名；普通注册、后台建号与 OIDC 首次注册使用独立规则选择套餐。OIDC 资料来源及仅首次同步的约束见 [OAuth 与 OIDC](029-remove-github-discord-telegram-linuxdo-oauth.md)。
- 用户的飞书身份 `open_id` 与钉钉身份 `dingding_id` 分开存储；缓存、负责人判断、部门查询、通知受众和报表按公司平台选用身份，避免跨平台混用。
- 独立公司平台凭据继续用于部门查询和通知，不属于注册规则。资料展示使用已存用户字段，不在登录时调用目录资料同步。

## 升级约束

- 当前启动流程不转换旧 LDAP 公司规则、清理旧配置或公司登录方式；恢复未完成转换的旧数据库时须单独处理，不能依赖启动自动迁移。
- `scripts/migrate_dingding_id.py` 默认预览，`--apply` 后将历史非 `ou_` 身份从 `open_id` 搬至 `dingding_id`，包含软删除用户；目标冲突回滚数据变更，MySQL 已执行的建列操作不随数据回滚。迁移前停止旧版写入，完成后再启动新版本。
- 历史仅记录 PostgreSQL 18.6 身份搬迁核验，SQLite／MySQL 与完整升级矩阵未验证；此次仅整理文档，未重新执行迁移。

## 实现入口

- `setting/system_setting/company_registration.go`、`controller/option.go` — 规则归一化、匹配及显示名称变更。
- `controller/user.go`、`service/oidc_profile.go` — 注册资料与套餐分配。
- `model/user.go`、`model/user_cache.go`、`model/user_auth_cache.go` — 平台身份与缓存。
- `service/employee_department.go`、`service/feishu_client.go`、`service/dingtalk_client.go` — 公司平台部门能力。
