# 模型广场优化

**日期**: 2026-09-05 ~ 09-13

## 涉及文件

- `web/default/src/features/pricing/components/model-card.tsx` — 「动态计费」标签颜色从橙色改为主题色。
- `web/default/src/components/status-badge.tsx` — 新增 primary variant 支持主题色状态标签。
- `controller/pricing.go` — 超级管理员可查看全部分组。
- `web/src/features/pricing/index.tsx` — 按当前用户角色判断是否展示分组倍率，并把用户所属分组和当前筛选分组传入模型卡片与模型详情。
- `web/default/src/features/pricing/components/pricing-toolbar.tsx` — 向筛选侧边栏透传分组倍率可见性。
- `web/default/src/features/pricing/components/pricing-sidebar.tsx` — 分组筛选项按权限显示或隐藏倍率后缀。
- `web/src/features/pricing/components/model-details.tsx` — 模型详情按权限过滤分组：管理员可查看全部分组与倍率，普通用户仅可见所属分组并隐藏倍率与自动分组链；同一可见分组范围传入 API 速率限制区域；独立详情页使用模型实际有效分组倍率。
- `web/src/features/pricing/components/model-details-price.tsx` — 模型详情基础价格按当前筛选分组或用户实际所属分组计算，覆盖 Token、按次及动态表达式计费，保留供应商分组倍率。
- `web/src/features/pricing/components/__tests__/base-price-group.test.tsx` — 覆盖筛选分组优先、全部分组时回退用户所属分组以及动态计费应用实际分组倍率。
- `web/src/features/pricing/components/model-details-api.tsx` — API 速率限制表按权限过滤后的可见分组渲染，无可见分组时隐藏该区域。
- `web/src/features/pricing/lib/mock-stats.ts` — 速率限制数据生成支持显式指定可见分组，并区分未指定分组与空可见分组。
- `web/src/features/pricing/components/__tests__/rate-limit-visibility.test.ts` — 覆盖普通用户仅查看所属分组、管理员查看全部分组及无可见分组时隐藏速率限制。
- `web/src/features/pricing/components/model-card-grid.tsx` — 把当前用户所在分组传给模型卡片。
- `web/src/features/pricing/components/model-card.tsx` — 模型卡片计费标签旁优先显示当前用户所在分组。
- `web/src/features/pricing/lib/model-helpers.ts` — 新增模型卡片分组显示解析逻辑，兼容未登录或用户分组为空时的回退展示。
- `web/src/features/pricing/lib/__tests__/model-display-group.test.ts` — 覆盖当前用户分组优先、空分组回退及模型无分组场景。

## 分组 × 供应商定价

- `plan.md` — 记录分组 × 供应商定价的需求、优先级、计费链路、前后端改造方案与验证计划。
- `controller/option.go` — 为 `GroupVendorRatio` option 增加配置合法性校验。
- `controller/pricing.go` — 模型广场接口下发按可用分组过滤的供应商倍率及当前用户特殊倍率分组标记。
- `model/option.go` — 注册并持久化 `GroupVendorRatio` option。
- `model/pricing.go` — 定价缓存维护模型到启用供应商 ID 的映射，供计费路径快速解析。
- `relay/helper/price.go` — 主计费链路统一按“用户特殊倍率 > 分组供应商倍率 > 分组基础倍率”解析最终分组倍率。
- `service/quota.go` — Realtime WebSocket 预扣费同步使用统一供应商倍率解析逻辑。
- `service/task_billing.go` — 任务按 Token 重算同步使用统一供应商倍率解析逻辑。
- `service/log_info_generate.go` — 命中供应商倍率时在消费日志记录供应商 ID 与最终供应商分组倍率。
- `setting/ratio_setting/group_ratio.go` — 新增分组供应商倍率配置、校验、复制、JSON 转换及统一优先级解析器。
- `setting/ratio_setting/group_vendor_ratio_test.go` — 覆盖倍率优先级、免费倍率、无供应商回退、配置校验及 JSON 往返行为。
- `types/price_data.go` — 扩展分组倍率信息，携带供应商倍率命中状态与供应商 ID。
- `web/src/features/pricing/hooks/use-pricing-data.ts` — 按模型供应商生成有效分组倍率，保持用户特殊倍率最高优先级。
- `web/src/features/pricing/index.tsx` — 模型详情使用所选模型计算后的有效分组倍率。
- `web/src/features/pricing/types.ts` — 补充供应商倍率和特殊倍率分组的接口类型。
- `web/src/features/system-settings/billing/index.tsx` — 计费设置表单默认值补充 `GroupVendorRatio`。
- `web/src/features/system-settings/billing/section-registry.tsx` — 计费设置字段注册表补充 `GroupVendorRatio`。
- `web/src/features/system-settings/models/group-ratio-form.tsx` — JSON 编辑模式与计费指南增加供应商倍率配置及优先级说明。
- `web/src/features/system-settings/models/group-ratio-visual-editor.tsx` — 可视化编辑器支持按分组添加/选择/修改/删除供应商倍率，以供应商名称展示、ID 存储。
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

- `common/aes_gcm.go` — 新增基于 SHA-256 密钥派生、随机 nonce 和附加认证数据的 AES-256-GCM 加解密工具，要求密钥材料至少 32 字节。
- `common/aes_gcm_test.go` — 覆盖加解密往返、随机 nonce、空密钥、短密钥及附加认证数据不一致等边界。
- `controller/pricing.go` — 完整模型广场响应序列化后加密为 Base64 文本返回，禁止缓存；密钥缺失或加密失败时拒绝降级返回明文。
- `controller/pricing_encryption_test.go` — 验证接口不暴露模型明文、密文可还原原始响应、响应类型与缓存头正确，以及缺少密钥时返回错误。
- `controller/ratio_sync.go` — 倍率同步支持识别并解密加密后的 `/api/pricing` 响应，同时兼容原有明文 JSON 上游。
- `web/src/features/pricing/api.ts` — 模型广场请求改为接收文本响应，解密成功后继续以原 `PricingData` 类型交给页面。
- `web/src/features/pricing/lib/pricing-encryption.ts` — 用浏览器 Web Crypto API 完成 Base64 解码、AES-GCM 解密、UTF-8 转换、JSON 解析和响应结构校验。
- `web/src/features/pricing/lib/__tests__/pricing-encryption.test.ts` — 覆盖正确密钥解密、错误密钥、短密钥和非法响应结构。
- `web/src/env.d.ts` — 声明模型广场前端构建期密钥常量。
- `web/rsbuild.config.ts` — 从进程环境或仓库根目录 `.env` 读取模型广场密钥并在前端构建时注入。
- `.env.example` — 补充模型广场 AES 密钥长度、前后端一致性和 Docker 构建参数说明。
- `Dockerfile` — 前端镜像构建阶段支持通过 `MODEL_SQUARE_AES_KEY` build arg 注入密钥。
- `docker-compose.yml` — 正式容器运行时向后端传递模型广场 AES 密钥。
- `docker-compose.dev.yml` — 本地容器开发环境向后端传递模型广场 AES 密钥。

## 独立模型推荐配置

超级管理员通过「系统设置 → 模型与路由 → 模型广场配置」（`/system-settings/model-square`）维护推荐，不依赖原有模型元信息页面。旧地址 `/model-square-settings` 自动跳转至新地址，页面沿用系统设置侧边栏与超级管理员权限。后台保留场景及启停配置；广场在模型卡片右上边缘显示「推荐」标记、卡片正文下方展示适用场景，表格在模型名称旁显示标记、名称下方显示紧凑场景标签，不再展示独立推荐区域，原列表排序、搜索、筛选和分页不变。同一模型配置多个场景时合并展示且仍只显示一个推荐标记。

配置默认关闭、推荐列表为空。配置以独立 `ModelSquareConfig` JSON 项存于既有 `options` 表，无新增模型字段或表迁移。保存节点立即更新内存，其他节点经既有配置同步周期刷新（默认 60 秒）；浏览器沿用定价查询缓存，保存后主动使其失效。已下架模型保留在后台配置中供修改或删除，公开推荐仅含当前用户可见的启用模型。推荐标记采用暖金色实心星标、淡琥珀色胶囊底与清晰文字，固定在卡片右上边缘且不占用内容布局；星标与边缘微光以同一 3 秒周期同步呼吸，并遵循系统减少动态效果设置。表格复用紧凑静态样式，兼容浅色/深色主题及七语言文案。

推荐理由已从后台表单和广场展示移除；后端保留兼容历史 JSON 的字段解析，省略或 null 归一化为空字符串，后台重新保存时不再提交理由。推荐配置只控制模型是否显示标记。

- `setting/model_square.go` — 配置类型、大小/字段/重复校验、快照读取及可见推荐过滤。
- `model/model_square.go` — 校验真实模型关联，事务保存配置，并按传入的可见模型过滤推荐。
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
- `web/src/features/pricing/components/model-recommendation-scenarios.tsx` — 在卡片和表格中按当前语言展示推荐模型适用场景。
- `web/src/features/pricing/components/model-card.tsx`、`web/src/features/pricing/components/pricing-columns.tsx` — 卡片和表格模型名称旁显示标记。
- `web/src/features/pricing/components/__tests__/recommendation-badge.test.tsx` — 标记启停、多场景去重、精确模型匹配、价格及详情交互、长名称布局和语言切换测试。
- `web/src/features/pricing/index.tsx`、`web/src/features/pricing/types.ts`、`web/src/features/pricing/hooks/use-pricing-data.ts` — 接入推荐数据，复用分组价格、搜索和筛选条件。
- `web/vitest.config.ts` — 把 Lobe 图标依赖交给测试转换器，支持用真实模型卡片做交互测试。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 推荐管理与展示文案。

### 本次验证

- `go build ./...`：通过。
- `go test ./setting ./model ./controller ./router -run "ModelSquare|GetPricing" -count=1`：通过，包含真实路由的超级管理员鉴权和推荐数据加密/分组过滤验证。
- `go test ./model -run "^TestModelSquareOptionPersistence$" -count=1 -v`：SQLite **3.50.4** 通过；覆盖首次保存、覆盖更新、重新加载、清空及保存失败后旧值不变。MySQL 和 PostgreSQL 因未配置 `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN` 跳过，当前也无可用 Docker；**尚未完成三库兼容验证**。后续须提供独立测试数据库并使用同一命令运行，记录实际版本与结果。
- 推荐功能初次实现时前端相关测试共 133 项通过。入口迁入系统设置并移除推荐排序字段后，执行模型推荐设置及展示测试：4 个文件、23 项通过，覆盖新入口、旧地址跳转、权限、保存、缓存回显和推荐标记；原独立侧栏开关及其测试已移除。
- `bun run typecheck`、涉及文件的 oxlint 检查、`bun run build`：通过。
- 尚未执行真实浏览器与已部署后端联调。上线前应以超级管理员保存推荐，再以不同可用分组的普通用户和访客确认展示范围，检查关闭推荐、模型下架和多节点同步后的页面结果。

## 顶部推荐横滑区

模型广场在筛选工具栏之上新增「推荐模型」横滑区，把全部推荐模型集中到首屏，无需清空筛选或翻页即可访问。横滑区复用现有模型卡片，适用场景、分组价格、按次与动态计费、性能徽章及详情抽屉交互与网格、表格一致；横滑区内每张卡片都是推荐模型，因此不再逐张显示卡片右上角的「推荐」标记，改由标题承担：标题本身就是一枚带边框的「推荐模型」胶囊徽章，不再另写文案；无推荐模型时不渲染该区域，不占用布局。此处与前述「不再展示独立推荐区域」不冲突：卡片与表格内仍不插入独立推荐块，本次新增的是工具栏之上的横滑区，网格与表格中的卡片仍保留右上角推荐标记。

横滑区与卡片网格共用抽出的性能指标查询 hook，命中同一 TanStack Query 缓存条目，不产生额外请求。轮播组件上/下一张按钮的无障碍文案由硬编码英文改为 i18next 键，并补齐七语言。

- `web/src/features/pricing/components/recommended-models-shelf.tsx` — 顶部推荐横滑区：基于 embla 轮播横向展示推荐模型卡片并复用 `ModelCard`，标题与轮播按钮同排，无推荐模型时返回空；标题由小星图标加文字改为直接复用 `ModelRecommendationBadge` 的 `prominent` 胶囊徽章，文案经 `label` 传入「推荐模型」，标题节点不再单独输出文案。
- `web/src/features/pricing/components/model-recommendation-badge.tsx` — 新增可选 `label`，默认仍为「推荐」，供徽章作为区域标题时替换文案；`prominent` 变体的上下内边距由 `py-0.75` 增至 `py-1.5`，胶囊更饱满（卡片角标与横滑区标题同用该变体）。
- `web/src/features/pricing/components/model-card.tsx` — 新增 `showRecommendationBadge` 开关，默认显示右上角「推荐」标记；横滑区传 `false` 关闭，避免同一区域内反复声明推荐。
- `web/src/features/pricing/index.tsx` — 在主内容列的筛选工具栏之上渲染推荐横滑区，透传价格、分组、Token 单位与演示模式等参数。
- `web/src/features/pricing/components/index.ts` — 导出推荐横滑区组件。
- `web/src/features/pricing/hooks/use-model-perf-badges.ts` — 抽出近 24 小时性能指标查询及按模型名索引的映射，供横滑区与卡片网格共用同一缓存条目。
- `web/src/features/pricing/components/model-card-grid.tsx` — 改用共享性能指标 hook，移除组件内联查询。
- `web/src/components/ui/carousel.tsx` — 轮播上/下一张按钮的屏幕阅读器文案改为 i18next 文案。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 新增「上一张 / 下一张」屏幕阅读器文案。

### 本次验证

- `bun run typecheck`、涉及文件的 oxlint 检查、`bun run format:check`、`bun run build`：通过。
- 未执行真实浏览器与已部署后端联调。上线前应以已配置推荐的超级管理员确认首屏横滑区的展示范围、横向拖拽与按钮翻页行为。

## 推荐横滑区自动循环滚动

横滑区改为自动向前匀速漂移并首尾循环，用户无需手动翻页即可看完所有推荐模型；卡片尺寸同步放大，单张卡片承载更多信息。指针悬停、键盘焦点进入或用户拖拽时暂停，拖拽结束后恢复；系统开启「减少动态效果」时完全不启动自动滚动，仅保留手动拖拽与翻页按钮；推荐模型不足以铺满一屏时不会漂移，此时翻页按钮一并隐藏。

- `web/src/features/pricing/components/recommended-models-shelf.tsx` — 接入 embla 官方 `AutoScroll` 插件，轮播开启 `loop`；用 `setApi` 拿到 embla 实例，在 `reInit` / `resize` 时比较容器滚动宽度与视口宽度，据此决定是否渲染翻页按钮；`plugins` 用 `useMemo` 保持引用稳定（embla 的 `arePluginsEqual` 只比对插件 options，但避免每次渲染新建插件实例）；以 `useMediaQuery('(prefers-reduced-motion: reduce)')` 作为自动滚动的开关；卡片宽度由 `basis-[85%] sm:basis-[340px]` 调整为 `basis-[88%] sm:basis-[380px]`。
- `web/package.json`、`bun.lock` — 新增依赖 `embla-carousel-auto-scroll@^8.6.0`，与既有 `embla-carousel-react@^8.6.0` 同版本线（peer 依赖要求 `embla-carousel@8.6.0`，MIT）。

### 变更说明

- 滚动速度 `speed: 2`（像素/帧，约 120px/s）。
- `startDelay: 0`：插件用同一个定时器处理首次启动与每次暂停后的恢复，默认 1000ms 会让鼠标移出后像卡住一样；设为 0 后移开指针立即继续漂移。
- `stopOnInteraction: false` + `stopOnMouseEnter: true`：悬停暂停、移开恢复，拖拽结束后也恢复，避免一次拖拽就永久停住。
- 悬停暂停的 `rootNode` 指向整个横滑区（`Carousel` 根节点，含标题行与翻页按钮），而非插件默认的轮播视口。自动滚动进行中会接管 `engine.scrollBody`，此时翻页按钮的目标位置会被自动滚动覆盖而失效，因此必须让指针移到按钮上也触发暂停，按钮才可用；不可滚动时按钮直接不渲染，避免出现永远点不动的控件。
- `loop: true` 交给 embla 自行判定：`createEngine` 在 `slideLooper.canLoop()` 为 false 时自动降级为 `loop: false`，因此推荐模型数量不足以铺满视口时不会出现异常回绕；AutoScroll 自身在 `scrollSnapList().length <= 1` 时也不会启动。
- `canLoop()` 要求轨道长度达到「视口宽度 + 单张卡片宽度」，即推荐模型数量少于一屏时无法无缝循环。曾尝试按需复制卡片填满轨道以实现「任何数量都滚动」，但复制会让同一模型在行内重复出现，与推荐区的语义冲突，已放弃；当前行为是卡片不足一屏则不滚动。
- 自动滚动属于持续 5 秒以上的动效，暂停能力由悬停暂停、焦点暂停与减少动态效果三处提供。

### 本次验证

- `bun run typecheck`、`bunx oxlint -c .oxlintrc.json <改动文件>`、`bunx oxfmt --check <改动文件>`、`bun run build`：通过。
- 未执行真实浏览器验证。上线前应确认循环滚动无明显跳帧、悬停与拖拽后能恢复、开启系统「减少动态效果」后横滑区保持静止。

## 模型卡片悬停边框

模型广场的模型卡片悬停时只做一件事——边框淡入淡出：卡片常驻一圈极淡的描边，指针移入后推荐卡片变为琥珀色、其他卡片加深，移出后按同样的 150ms 渐变还原；不使用卡片通用的浮起位移与投影动效。

- `web/src/features/pricing/components/model-card.tsx` — 卡片根节点传 `data-card-hover='false'` 退出全局卡片悬停浮起，用 `border border-foreground/10` 取代 Card 自带的 `ring-1`（以 `ring-0` 关闭），推荐卡片的琥珀色描边由常驻改为仅悬停生效，非推荐卡片的 `hover:ring-foreground/20` 改为 `hover:border-foreground/20`，边框过渡由保留下来的 `transition-colors` 提供。

### 变更说明

- `data-card-hover='false'` 是 `web/src/styles/index.css` 中既有的卡片微交互开关（`titled-card.tsx`、个人资料与安全设置等多处已在用），这里复用它让模型卡片不参与浮起与投影，`styles/index.css` 不需要任何改动，其他卡片行为不变。
- 退出该规则后，Card 自带的 `ring-1 ring-foreground/10` 不会再被悬停规则抹掉。若继续保留 `border-transparent`，悬停时会出现「默认淡描边 + 琥珀边框」双重描边，因此改为 `ring-0` 关掉 ring，并把这条描边本身做成实边框 `border-foreground/10`，观感与原先的 ring 一致。
- `ring-0` 与 Card 基础的 `ring-1`、`ring-foreground/10` 同属 Tailwind ring 工具类，`cn()` 走 tailwind-merge，会正确丢弃 `ring-1` 并保留 `ring-0`。
- 边框过渡回到 ModelCard 自己的 `transition-colors`（含 `border-color`，150ms）。它此前不生效是因为 `styles/index.css` 的卡片微交互规则没有写进 `@layer`，无层级样式整体压过 Tailwind utilities；模型卡片退出该规则后即恢复生效，无需改动 `styles/index.css`。
- 原先的 `border-amber-300/70`、`dark:border-amber-700/60` 与 `hover:ring-foreground/20` 都不会生效：Card 基础样式用的是 `ring-1`，本身没有 `border` 宽度，只给 `border-color` 画不出边；`hover:ring-*` 则被上述无层级样式覆盖，表现为「悬停时边框消失」。
- 浅色模式下 `--background` 与 `--card` 同为纯白，这圈极淡描边是卡片与页面背景之间唯一的边界，因此保留而未改成完全无描边。

### 本次验证

- `bun run typecheck`、`bunx oxlint -c .oxlintrc.json <改动文件>`、`bun run build`：通过；编译产物确认 `transition-colors` 含 `border-color`、`ring-0` 已生成，`styles/index.css` 的卡片规则与改动前一致。
- 未执行真实浏览器验证。上线前应确认悬停只有边框渐变、没有位移与投影，移出后同样渐变还原，推荐卡片与其他模型卡片的反馈一致。

## 自 CHANGELOG 说明列迁入

模型广场与分组定价优化：动态计费标签改为主题色；管理员可查看全部分组、分组倍率及 API 速率限制，普通用户仅见所属分组；模型卡片显示当前用户分组；模型详情基础价格按筛选分组或用户实际所属分组显示；新增分组 × 供应商倍率配置，按用户特殊倍率 > 供应商倍率 > 基础倍率的优先级统一计费、日志审计与广场价格展示，并提供可视化编辑器及多语言文案；广场完整定价响应改用环境变量密钥做 AES-256-GCM 加密，前端解密校验后展示，兼容加密响应的倍率同步与本地、Docker 部署；新增独立的超级管理员「模型广场配置」入口，可按场景配置推荐模型及启停，广场按用户可见模型与筛选条件显示推荐标记与适用场景，复用现有价格与详情交互；筛选工具栏之上新增「推荐模型」顶部横滑区，集中展示全部推荐模型卡片，复用现有模型卡片的价格、分组、性能徽章与详情交互，无推荐模型时不渲染；横滑区与卡片网格共用抽出的性能指标查询 hook，命中同一缓存条目而不产生额外请求；轮播上/下一张按钮的无障碍文案由硬编码英文改为 i18next 并补齐七语言
