# 飞书凭据惰性读取，并移除全局 FEISHU_EMAIL_SUFFIX 兜底

**日期**: 2026-08-12

## 背景

飞书凭据最初以全局环境变量提供（单公司部署）。多公司支持后，凭据与邮箱后缀已可在「系统设置 → 认证 → LDAP 公司同步配置」中按公司配置，全局环境变量退化为兜底值。

保留全局兜底带来两个问题：

1. 同一份配置散落在环境变量与 per-company 配置两处，排查困难。
2. `syncPlatform` 为 `none` 的公司会落入飞书分支：注册时被套上全局邮箱后缀，且在全局凭据存在时真的发起飞书 API 调用，查不到 open_id 后持续刷错误日志。

飞书按邮箱反查 open_id，缺少后缀无法拼出企业邮箱，因此后缀与凭据同属必填项，不适合分层兜底。钉钉从 LDAP `extensionAttribute12` 直接取 userid，本就只走 per-company 配置。

## 涉及文件

- `setting/system_setting/feishu.go` — 飞书凭据改为惰性读取（`sync.OnceValue`），避免包导入时 `.env` 未加载导致同步失败；移除 `feishuEmailSuffix`、`FeishuEmailSuffix()` 及仅服务于全局兜底的 `FeishuEnabled()`；保留 `FeishuAppID`/`FeishuAppSecret`（违规通知卡片发送仍使用）与 `FeishuSupportOpenID`
- `service/feishu_sync.go` — `resolveFeishuSyncConfig` 去掉全局兜底分支，凭据与邮箱后缀只来自 LDAP 公司同步配置；公司名为空、无同步配置、平台非飞书、或 AppID/AppSecret/EmailSuffix 任一为空时返回未配置，不触发同步
- `controller/ldap.go` — 注册邮箱解析由 `if/else` 改为按 `syncPlatform` 三分支显式处理：钉钉留空待同步回填、飞书用 per-company 后缀拼接（无后缀回退 LDAP 邮箱属性）、无同步直接用 LDAP 邮箱属性；注册后同步与 `LDAPBind` 的异步同步同样收敛为仅在平台明确为钉钉或飞书时触发，`none` 不再误入飞书链路
- `.env.example` — 移除 `FEISHU_EMAIL_SUFFIX`，补充 `FEISHU_SUPPORT_OPEN_ID`
- `docker-compose.yml` — 移除 `FEISHU_EMAIL_SUFFIX` 环境变量透传

## 升级注意

原先依赖 `FEISHU_EMAIL_SUFFIX` 的部署，需在 LDAP 公司同步配置中为每个飞书公司填写「飞书邮箱后缀」。未填写时该公司不再触发飞书同步，注册邮箱回退为 LDAP 邮箱属性。

## 自 CHANGELOG 说明列迁入

Feishu 凭据改为惰性读取（sync.OnceValue），避免包导入时 .env 未加载导致同步失败；移除全局 FEISHU_EMAIL_SUFFIX 环境变量与 FeishuEnabled 兜底，飞书凭据及邮箱后缀统一只从 LDAP 公司同步配置读取，后缀缺失即视为未配置、不触发同步；LDAP 注册邮箱与登录/绑定后的同步改为按 syncPlatform 显式三分支，平台为 none 的公司不再误入飞书链路
