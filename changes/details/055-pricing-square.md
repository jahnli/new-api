# 模型广场优化

**日期**: 2026-09-05

## 涉及文件

- `web/default/src/features/pricing/components/model-card.tsx` — 「动态计费」标签颜色从橙色改为主题色。
- `web/default/src/components/status-badge.tsx` — 新增 primary variant 支持主题色状态标签。
- `controller/pricing.go` — 超级管理员可查看全部分组。
- `web/src/features/pricing/index.tsx` — 根据当前用户角色判断是否展示分组倍率，并将用户所属分组和当前筛选分组传入模型卡片与模型详情。
- `web/default/src/features/pricing/components/pricing-toolbar.tsx` — 向筛选侧边栏透传分组倍率可见性。
- `web/default/src/features/pricing/components/pricing-sidebar.tsx` — 分组筛选项按权限显示或隐藏倍率后缀。
- `web/src/features/pricing/components/model-details.tsx` — 模型详情按权限过滤分组：管理员可查看全部分组与倍率，普通用户仅能查看所属分组，并隐藏倍率与自动分组链；将同一可见分组范围传入 API 速率限制区域；独立详情页使用模型实际有效分组倍率。
- `web/src/features/pricing/components/model-details-price.tsx` — 模型详情基础价格按当前筛选分组或用户实际所属分组计算，覆盖 Token、按次及动态表达式计费，并保留供应商分组倍率。
- `web/src/features/pricing/components/__tests__/base-price-group.test.tsx` — 覆盖筛选分组优先、全部分组时回退用户所属分组，以及动态计费应用实际分组倍率的测试场景。
- `web/src/features/pricing/components/model-details-api.tsx` — API 速率限制表按权限过滤后的可见分组渲染，无可见分组时隐藏该区域。
- `web/src/features/pricing/lib/mock-stats.ts` — 速率限制数据生成支持显式指定可见分组，并区分未指定分组与空可见分组。
- `web/src/features/pricing/components/__tests__/rate-limit-visibility.test.ts` — 覆盖普通用户仅查看所属分组、管理员查看全部分组以及无可见分组时隐藏速率限制的测试场景。
- `web/src/features/pricing/components/model-card-grid.tsx` — 将当前用户所在分组传递给模型卡片。
- `web/src/features/pricing/components/model-card.tsx` — 模型卡片计费标签旁优先显示当前用户所在分组。
- `web/src/features/pricing/lib/model-helpers.ts` — 新增模型卡片分组显示解析逻辑，兼容未登录或用户分组为空时的回退展示。
- `web/src/features/pricing/lib/__tests__/model-display-group.test.ts` — 覆盖当前用户分组优先、空分组回退及模型无分组场景。

## 分组 × 供应商定价

- `plan.md` — 记录分组 × 供应商定价的需求、优先级、计费链路、前后端改造方案与验证计划。
- `controller/option.go` — 为 `GroupVendorRatio` option 增加配置合法性校验。
- `controller/pricing.go` — 模型广场接口下发按可用分组过滤的供应商倍率及当前用户特殊倍率分组标记。
- `model/option.go` — 注册并持久化 `GroupVendorRatio` option。
- `model/pricing.go` — 在模型定价缓存中维护模型到启用供应商 ID 的映射，供计费路径快速解析。
- `relay/helper/price.go` — 主计费链路统一按“用户特殊倍率 > 分组供应商倍率 > 分组基础倍率”解析最终分组倍率。
- `service/quota.go` — Realtime WebSocket 预扣费同步使用统一的供应商倍率解析逻辑。
- `service/task_billing.go` — 任务按 Token 重算同步使用统一的供应商倍率解析逻辑。
- `service/log_info_generate.go` — 命中供应商倍率时在消费日志中记录供应商 ID 与最终供应商分组倍率。
- `setting/ratio_setting/group_ratio.go` — 新增分组供应商倍率配置、校验、复制、JSON 转换及统一优先级解析器。
- `setting/ratio_setting/group_vendor_ratio_test.go` — 覆盖倍率优先级、免费倍率、无供应商回退、配置校验及 JSON 往返行为。
- `types/price_data.go` — 扩展分组倍率信息，携带供应商倍率命中状态与供应商 ID。
- `web/src/features/pricing/hooks/use-pricing-data.ts` — 按模型供应商生成有效分组倍率，并保持用户特殊倍率最高优先级。
- `web/src/features/pricing/index.tsx` — 模型详情使用所选模型计算后的有效分组倍率。
- `web/src/features/pricing/types.ts` — 补充供应商倍率和特殊倍率分组的接口类型。
- `web/src/features/system-settings/billing/index.tsx` — 计费设置表单默认值补充 `GroupVendorRatio`。
- `web/src/features/system-settings/billing/section-registry.tsx` — 计费设置字段注册表补充 `GroupVendorRatio`。
- `web/src/features/system-settings/models/group-ratio-form.tsx` — JSON 编辑模式与计费指南增加供应商倍率配置及优先级说明。
- `web/src/features/system-settings/models/group-ratio-visual-editor.tsx` — 可视化编辑器支持按分组添加、选择、修改和删除供应商倍率，并以供应商名称展示、ID 存储。
- `web/src/features/system-settings/models/index.tsx` — 分组设置默认值补充 `GroupVendorRatio`。
- `web/src/features/system-settings/models/ratio-settings-card.tsx` — 分组倍率卡片注册并保存供应商倍率配置。
- `web/src/features/system-settings/types.ts` — 系统设置类型补充 `GroupVendorRatio`。
- `web/src/i18n/locales/en.json` — 增加供应商倍率编辑器及计费优先级英文文案。
- `web/src/i18n/locales/zh.json` — 增加供应商倍率编辑器及计费优先级简体中文文案。
- `web/src/i18n/locales/zh-TW.json` — 增加供应商倍率编辑器及计费优先级繁体中文文案。
- `web/src/i18n/locales/fr.json` — 增加供应商倍率编辑器及计费优先级法语文案。
- `web/src/i18n/locales/ja.json` — 增加供应商倍率编辑器及计费优先级日语文案。
- `web/src/i18n/locales/ru.json` — 增加供应商倍率编辑器及计费优先级俄语文案。
- `web/src/i18n/locales/vi.json` — 增加供应商倍率编辑器及计费优先级越南语文案。
- `web/src/i18n/locales/_reports/_sync-report.json` — 更新国际化同步统计报告。
- `web/src/i18n/locales/_reports/fr.untranslated.json` — 更新法语未翻译项报告。
- `web/src/i18n/locales/_reports/ja.untranslated.json` — 更新日语未翻译项报告。
- `web/src/i18n/locales/_reports/ru.untranslated.json` — 更新俄语未翻译项报告。
- `web/src/i18n/locales/_reports/vi.untranslated.json` — 更新越南语未翻译项报告。

## 模型广场响应加密

- `common/aes_gcm.go` — 新增基于 SHA-256 密钥派生、随机 nonce 和附加认证数据的 AES-256-GCM 加解密工具，并要求密钥材料至少 32 字节。
- `common/aes_gcm_test.go` — 覆盖加解密往返、随机 nonce、空密钥、短密钥及附加认证数据不一致等边界。
- `controller/pricing.go` — 将完整模型广场响应序列化后加密为 Base64 文本返回，禁止缓存；密钥缺失或加密失败时拒绝降级返回明文。
- `controller/pricing_encryption_test.go` — 验证接口不暴露模型明文、密文可还原原始响应、响应类型与缓存头正确，以及缺少密钥时返回错误。
- `controller/ratio_sync.go` — 倍率同步支持识别并解密加密后的 `/api/pricing` 响应，同时保持对原有明文 JSON 上游的兼容。
- `web/src/features/pricing/api.ts` — 模型广场请求改为接收文本响应，解密成功后继续以原 `PricingData` 类型交给页面。
- `web/src/features/pricing/lib/pricing-encryption.ts` — 使用浏览器 Web Crypto API 完成 Base64 解码、AES-GCM 解密、UTF-8 转换、JSON 解析和响应结构校验。
- `web/src/features/pricing/lib/__tests__/pricing-encryption.test.ts` — 覆盖正确密钥解密、错误密钥、短密钥和非法响应结构。
- `web/src/env.d.ts` — 声明模型广场前端构建期密钥常量。
- `web/rsbuild.config.ts` — 从进程环境或仓库根目录 `.env` 读取模型广场密钥并在前端构建时注入。
- `.env.example` — 补充模型广场 AES 密钥长度、前后端一致性和 Docker 构建参数说明。
- `Dockerfile` — 前端镜像构建阶段支持通过 `MODEL_SQUARE_AES_KEY` build arg 注入密钥。
- `docker-compose.yml` — 正式容器运行时向后端传递模型广场 AES 密钥。
- `docker-compose.dev.yml` — 本地容器开发环境向后端传递模型广场 AES 密钥。

## 独立模型推荐配置

超级管理员通过「系统设置 → 模型与路由 → 模型广场配置」（`/system-settings/model-square`）维护推荐，不依赖原有模型元信息页面。旧地址 `/model-square-settings` 自动跳转至新地址，页面沿用系统设置侧边栏和超级管理员权限。后台保留场景及启停配置；广场在模型卡片右上边缘显示「推荐」标记，并在卡片正文下方展示适用场景，表格在模型名称旁显示标记、名称下方显示紧凑场景标签，不再展示独立推荐区域，不改变原列表排序、搜索、筛选和分页。同一模型配置多个场景时合并展示且仍只显示一个推荐标记。

配置默认关闭、推荐列表为空。配置以独立 `ModelSquareConfig` JSON 项存储于既有 `options` 表，无新增模型字段或表迁移。保存节点立即更新内存，其他节点通过既有配置同步周期刷新（默认 60 秒）；浏览器沿用定价查询缓存，保存后主动使该缓存失效。已下架模型保留在后台配置中以供修改或删除，公开推荐仅包含当前用户可见的启用模型。推荐标记采用暖金色实心星标、淡琥珀色胶囊底和清晰文字，固定在卡片右上边缘且不占用内容布局；星标与边缘微光以同一 3 秒周期同步呼吸，并遵循系统减少动态效果设置。表格复用紧凑的静态样式，兼容浅色/深色主题及七语言文案。

推荐理由已从后台表单和广场展示中移除；后端保留兼容历史 JSON 的字段解析，省略或 null 会归一化为空字符串，后台重新保存时不再提交理由。推荐配置只控制模型是否显示标记。

- `setting/model_square.go` — 配置类型、大小/字段/重复校验、快照读取及可见推荐过滤。
- `model/model_square.go` — 校验真实模型关联，以事务保存配置，并按传入的可见模型过滤推荐。
- `model/option.go` — 通用持久化入口增加推荐配置结构校验。
- `controller/model_square.go` — 独立配置读取/保存接口，请求限制为 256 KiB。
- `controller/option.go` — 阻止通用 option API 绕过独立配置接口的模型关联校验。
- `controller/pricing.go` — 推荐信息随按用户分组过滤后的完整定价响应加密返回。
- `router/api-router.go` — 注册仅超级管理员可用的配置路由并禁用响应缓存。
- `setting/model_square_test.go`、`model/model_square_test.go`、`controller/model_square_test.go`、`router/model_square_test.go` — 覆盖配置校验、事务持久化、公开可见性、加密契约和接口鉴权。
- `web/src/features/model-square-settings/` — 独立管理页、可搜索模型选择、表单校验、保存/重置/删除、错误重试、未保存离开提醒及模块测试。
- `web/src/routes/_authenticated/system-settings/model-square/index.tsx`、`web/src/routeTree.gen.ts` — 系统设置下的模型广场配置路由，继承父路由的超级管理员权限限制。
- `web/src/routes/_authenticated/model-square-settings/index.tsx` — 旧地址兼容跳转。
- `web/src/components/layout/config/system-settings.config.ts` — 在「模型与路由」分组中加入配置入口。
- `web/src/features/pricing/components/model-recommendation-badge.tsx` — 统一科技风格的推荐标记。
- `web/src/features/pricing/components/model-recommendation-scenarios.tsx` — 在卡片和表格中按当前语言展示推荐模型的适用场景。
- `web/src/features/pricing/components/model-card.tsx`、`web/src/features/pricing/components/pricing-columns.tsx` — 卡片和表格模型名称旁显示标记。
- `web/src/features/pricing/components/__tests__/recommendation-badge.test.tsx` — 标记启停、多场景去重、精确模型匹配、价格及详情交互、长名称布局和语言切换测试。
- `web/src/features/pricing/index.tsx`、`web/src/features/pricing/types.ts`、`web/src/features/pricing/hooks/use-pricing-data.ts` — 接入推荐数据，复用分组价格、搜索和筛选条件。
- `web/vitest.config.ts` — 将 Lobe 图标依赖交给测试转换器处理，支持使用真实模型卡片进行交互测试。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 推荐管理与展示文案。

### 本次验证

- `go build ./...`：通过。
- `go test ./setting ./model ./controller ./router -run "ModelSquare|GetPricing" -count=1`：通过，包含真实路由的超级管理员鉴权和推荐数据加密/分组过滤验证。
- `go test ./model -run "^TestModelSquareOptionPersistence$" -count=1 -v`：SQLite **3.50.4** 通过；覆盖首次保存、覆盖更新、重新加载、清空及保存失败后旧值不变。MySQL 和 PostgreSQL 因未配置 `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN` 跳过，当前也无可用 Docker；**尚未完成三库兼容验证**。后续须提供独立测试数据库并使用同一命令运行，记录实际版本与结果。
- 推荐功能初次实现时，前端相关测试共 133 项通过。入口迁入系统设置并移除推荐排序字段后，执行模型推荐设置及展示相关测试：4 个文件、23 项测试通过，覆盖新入口、旧地址跳转、权限、保存、缓存回显和推荐标记；原独立侧栏开关及其测试已移除。
- `bun run typecheck`、涉及文件的 oxlint 检查、`bun run build`：通过。
- 尚未执行真实浏览器与已部署后端联调。上线前应使用超级管理员保存推荐，再以不同可用分组的普通用户和访客确认展示范围，检查关闭推荐、模型下架和多节点同步后的页面结果。
