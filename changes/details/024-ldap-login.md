# 新增 LDAP 登录与飞书/钉钉用户同步

**日期**: 2026-07-20

## 涉及文件

- `.env.example` — 新增 LDAP 相关环境变量示例
- `controller/ldap.go` — 新增 LDAP 登录控制器（认证、绑定、解绑）；注册、已有用户登录与绑定时将 LDAP 公司名映射为配置的显示名称写入用户公司字段，并按同一公司配置选择飞书或钉钉同步、邮箱后缀与自动订阅套餐；LDAP 返回的小写标准用户名与 `users.username` 小写值匹配，兼容历史混合大小写账号；钉钉注册同步完成前不预填邮箱，绑定时异步刷新平台资料
- `controller/ldap_test.go` — 验证 LDAP 小写标准用户名复用 `users` 表中对应的历史混合大小写账号，不创建重复用户
- `controller/misc.go` — 状态接口暴露 LDAP 启用标志
- `controller/option.go` — 系统设置保存时规范化 LDAP 公司同步配置；显示名称留空自动写入 LDAP 公司名，并拒绝缺少 LDAP 公司名的无效配置
- `controller/user.go` — 用户模型适配 LDAP 字段；注册与管理员创建用户后的自动订阅改为按用户公司选择套餐
- `go.mod`、`go.sum` — 引入 LDAP 依赖包
- `i18n/keys.go` — 新增 LDAP 相关后端 i18n key
- `i18n/locales/en.yaml`、`i18n/locales/zh-CN.yaml`、`i18n/locales/zh-TW.yaml` — LDAP 后端翻译（英/简中/繁中）
- `model/user.go` — User 模型新增 LDAP 相关字段、公司字段与查询方法；新增含软删除记录的 username 大小写不敏感查询，供 LDAP 账号关联复用
- `router/api-router.go` — 注册 LDAP 登录/绑定/解绑路由
- `service/feishu_sync.go` — 新增飞书用户同步服务；支持按公司同步配置选择飞书/钉钉应用凭据
- `service/dingtalk_sync.go` — 新增钉钉用户同步服务：缓存 access token，通过用户与部门接口回填头像、邮箱、显示名、手机号、工号、职务、负责人、入职日期与部门层级，复用部门节点缓存减少请求
- `service/ldap.go` — LDAP 认证与用户查找核心逻辑；支持从公司 OU 提取用户公司并带回注册流程；注册与登录统一将目录 `UsernameAttribute` 返回的标准用户名转小写，属性未配置或返回空值时拒绝登录，不回退用户输入值；读取 extensionAttribute12 作为钉钉 userid
- `service/ldap_test.go` — 验证 LDAP 标准用户名去除首尾空格、忽略属性名大小写并统一转小写
- `setting/system_setting/feishu.go` — 飞书同步相关系统设置
- `controller/ldap.go` — 修复多公司配置下自动订阅套餐因 DisplayName 与其他条目 Company 名称交叉而匹配错误的 bug：LDAP 首次创建用户时直接使用已解析的 `companySyncCfg.AutoSubscribePlanId`，避免 `autoSubscribeUserAfterCreate` 以 DisplayName 反查配置时触发第一个循环的 Company 匹配而误匹配
- `controller/option.go` — 新增 `migrateChangedLDAPCompanyDisplayNames`：保存 LDAP 公司同步配置时，按 Company OU 名比对新旧配置中每个条目的 DisplayName 变更，批量更新持有旧 DisplayName 的用户 company 字段为新值；失败仅记日志，不阻止配置保存
- `model/user.go` — 新增 `RenameUserCompany` 批量更新：按旧公司名精确匹配用户并将 company 字段更新为新公司名，用于 LDAP DisplayName 重命名时自动迁移已有用户
- `setting/system_setting/ldap.go` — LDAP 连接相关系统设置（服务器、BaseDN、BindDN 等）；公司同步配置新增显示名称映射与保存归一化，显示名称留空默认用 LDAP 公司名，并支持按 LDAP 原公司名或显示名称读取同步平台及自动订阅套餐；支持保存钉钉 Client ID 与 Client Secret
- `web/default/src/features/auth/api.ts` — 前端 LDAP 登录 API
- `web/default/src/features/auth/components/ldap-login-dialog.tsx` — LDAP 登录弹窗组件
- `web/default/src/features/auth/components/oauth-providers.tsx` — OAuth 登录区集成 LDAP 入口
- `web/default/src/features/auth/sign-in/components/user-auth-form.tsx` — 登录表单集成 LDAP 按钮
- `web/default/src/features/auth/types.ts` — 新增 LDAP 相关类型定义
- `web/default/src/features/system-settings/auth/index.tsx` — 系统设置认证页新增 LDAP 配置区并调整认证分区
- `web/default/src/features/system-settings/auth/oauth-section.tsx` — OAuth 设置区适配 LDAP 平台同步配置；公司配置表单新增显示名称，读取旧配置与保存空值时自动回填 LDAP 公司名，并按飞书/钉钉选择动态展示对应凭据，支持邮箱后缀与自动订阅套餐；LDAP 页签补充底部留白，避免添加配置按钮滚到底部时被页面底部遮挡而无法点击
- `web/default/src/features/system-settings/types.ts` — 系统设置类型新增 LDAP 字段与公司同步配置字段
- `web/default/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 前端 7 语言翻译同步更新，补充钉钉 Client ID/Secret 与原 AppKey/AppSecret 文案

## 自 CHANGELOG 说明列迁入

新增 LDAP 登录与飞书/钉钉同步：支持认证、绑定/解绑、按公司 OU 选择同步平台、配置凭据/邮箱后缀/自动订阅套餐及 7 语言界面；钉钉从 extensionAttribute12 读取 userid 回填资料与部门层级；公司配置支持显示名称映射，登录/注册/绑定时写入并可按原名或显示名匹配，留空则用 LDAP 公司名；LDAP 建号采用目录标准用户名，修复配置按钮遮挡与多公司套餐误匹配，保存配置时迁移已有用户公司字段
