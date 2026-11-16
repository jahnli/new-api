# 模型广场、分组定价与推荐

**日期**: 2026-10-19

## 分组价格

- 管理员可查看全部可见分组及倍率，普通用户模型详情仅显示所属分组，隐藏倍率及自动分组链；API 速率限制区域使用同一分组范围，无分组时隐藏。
- 卡片、详情基础价格和分档价格表使用有效分组倍率；管理员明确筛选分组时跟随筛选，否则回退用户所属分组，覆盖 Token、按次及表达式价格。
- `GroupVendorRatio` 支持分组 × 供应商配置，可视化编辑以供应商名称展示、ID 保存。最终倍率优先级为用户特殊倍率 → 分组供应商倍率 → 分组基础倍率；主中继、Realtime 预扣、任务重算与广场展示共用解析规则，日志记录命中的供应商和倍率。

## 定价响应加密

`/api/pricing` 将完整响应以 AES-256-GCM 加密为 Base64 文本，使用随机 nonce 与附加认证数据，禁止缓存；`MODEL_SQUARE_AES_KEY` 至少 32 字节，缺失或加密失败不降级明文。前端通过 Web Crypto 解密并校验结构，倍率同步同时兼容加密和旧明文响应。

前端构建期与后端运行时必须使用一致密钥，本地构建及 Docker 构建参数、运行环境均需配置；密钥会随前端构建产物使用。

## 推荐配置与展示

- 超级管理员在 `/system-settings/model-square` 管理推荐，旧 `/model-square-settings` 跳转兼容。配置默认关闭、列表为空，以 `ModelSquareConfig` 存入既有 options；独立接口验证真实模型关联，限制请求为 256 KiB，通用 option 接口不可绕过校验。
- 每模型只允许一条推荐，启停、场景与条目顺序可编辑。场景支持预置和自定义有序文本，最多 10 项、每项 1–40 字符，拒绝空项和精确重复；条目与场景支持拖拽及键盘排序，无场景的推荐仍生效。
- 读取兼容旧 `scenario` 单值和历史枚举，下一次保存写入数组；历史 reason 可解析但不再作为编辑/展示项。配置本节点保存后立即更新，其他节点按配置同步周期更新；浏览器保存后刷新定价缓存。已下架模型可在后台维护，公开推荐仅包含用户可见且启用的模型。
- 网格与表格显示推荐标记、适用场景；顶部横滑区按配置顺序集中展示推荐，标题显示数量，卡片不重复角标，无推荐时不占位。横滑区复用模型卡片、详情交互和性能指标查询缓存。
- 横滑区自动循环漂移，卡片视口悬停、聚焦或拖拽时暂停，交互结束恢复；箭头点击先暂停再翻页，模型不足一屏不自动滚动。减少动态效果时仅保留手动操作，推荐装饰同样遵循该偏好。
- 卡片隐藏空描述，保留真实分时说明；价格网格保留空列且不自动下推。局部浅/深配色、推荐微光和场景标记独立于全局主题，演示模式遮罩价格。

## 主要入口

- `setting/ratio_setting/group_ratio.go`、`relay/helper/price.go`、`model/pricing.go`：供应商倍率与计费解析。
- `common/aes_gcm.go`、`controller/pricing.go`、`controller/ratio_sync.go`、`web/src/features/pricing/lib/pricing-encryption.ts`：加密和同步。
- `setting/model_square.go`、`model/model_square.go`、`controller/model_square.go`：推荐校验、持久化与可见性。
- `web/src/features/model-square-settings/`、`web/src/features/pricing/`、`web/src/styles/model-card.css`：管理、展示与横滑交互。

原记录仅有 SQLite 3.50.4 的部分持久化验证，MySQL/PostgreSQL 矩阵及部署联调未完成；本次不据此声明三库或页面运行验证通过。
