# 计费规则

本文件规定 Go 后端中配额、定价、预扣费、结算、退款及用量数量相关代码必须遵循的约定。`AGENTS.md` 定义了哪些任务涉及计费（参见**计费规则（强制读取）**）；凡符合任一条件的任务，都必须在规划、编码或审查前完整读取本文件。不符合任何触发条件的任务可以跳过。本文件中的“必须”和“不得”等措辞与 `AGENTS.md` 具有同等约束力。

**计费表达式系统：** 处理阶梯计费或动态计费（基于表达式的定价）时，必须先阅读 `pkg/billingexpr/expr.md`。该文档说明了设计理念、表达式语言、完整架构、Token 归一化规则、配额转换和表达式版本管理。所有计费表达式相关改动都必须遵循该文档。

**内置模型定价：** 新增的内置模型价格必须在 `setting/billing_setting/builtin_billing.go` 中定义为自包含的计费表达式，并使用真实的美元/百万 Token 价格。不得将新的内置价格添加到旧版模型倍率、补全倍率或缓存倍率表中。必须保留管理员显式设置的价格覆盖项。只有在明确要求时，才迁移现有的旧版价格。必须核实官方公布的价格，并覆盖适用的上下文长度阈值和缓存类别。

**计费安全不变量：** 配额和计费代码绝不能因算术溢出或未校验的输入而产生负数扣费（即反向增加余额）。必须实施纵深防御：

- 每个由用户控制且会成为计费乘数的数量（图片 `n`、视频 `seconds`/`duration`、分辨率或质量倍率、批次数量），都必须在进入配额计算前受到上下界限制。请求校验阶段必须对越界值返回 400。现有边界包括：图片生成数量使用 `dto.MaxImageN`，任务视频时长使用 `relaycommon.MaxTaskDurationSeconds`，所有中继格式（OpenAI、Claude、Gemini、Responses）的 `max_tokens` 系列字段使用 `maxTokensLimit`（位于 `relay/helper/valid_request.go`）。相同概念必须复用这些常量，不得另行引入临时限制。新增中继格式或请求 DTO 时，必须从一开始就在其校验器中限制最大 Token 数和数量字段。
- 注意可能绕过校验的路径：透传字段（例如 `Extra["parameters"]`）、任务 `metadata` 映射和 multipart 表单字段，都可能绕过标准 DTO 校验携带相同的数量。任何从此类路径读取计费乘数的适配器，都必须在本地执行相同的边界检查或钳制。
- 从媒体元数据解析出的时长同样受用户或上游控制：音频文件头（用于转录 Token 计数、TTS 响应时长）以及上游扣费数值（例如 Kling 的 `FinalUnitDeduction`）都可能声称不合理的巨大数值。在这些值转换为 Token 数之前，必须进行饱和转换。
- 绝不能通过裸类型转换将计算出的配额或 Token 数转为 `int`，例如对无界输入使用 `int(float64(quota) * ratio)`、`int(math.Round(...))` 或 `int(decimal.IntPart())`。所有配额舍入和转换都集中在 `common/quota_math.go` 中；必须使用其中的辅助函数：浮点乘积使用 `common.QuotaFromFloat`（截断），需要舍入时使用 `common.QuotaRound`（中点值向远离零的方向舍入），十进制乘积使用 `common.QuotaFromDecimal`。`billingexpr.QuotaRound` 委托给 `common.QuotaRound`。不得重新引入局部转换辅助函数或裸类型转换。单次请求的饱和上限保持在 int32 边界，以免批量累加接近 64 位整数回绕；钱包和充值转换使用 `common.WalletQuotaFromDecimalStrict`，并采用 JavaScript 安全的 `common.MaxWalletQuota` 边界。每次钳制或 NaN 回退都必须通过 `common.SysError` 记录。
- 饱和事件也必须接受审计：每个辅助函数都有对应的 `*Checked` 变体（`common.QuotaFromFloatChecked`、`QuotaRoundChecked`、`QuotaFromDecimalChecked`），发生钳制时还会返回 `*common.QuotaClamp`。计算扣费的计费路径必须将该钳制信息记录到 `relayInfo.QuotaClamp`（或将其传递到任务结算流程），并在写入消费日志或任务日志前调用 `attachQuotaSaturation`（位于 `service/log_info_generate.go`）。该函数会把标记嵌套在日志的 `other.admin_info.quota_saturation` 下，并发出与请求关联的 `logger.LogWarn`。嵌套在 `admin_info` 下可自然限制为仅管理员可见，因为非管理员日志视图会移除 `admin_info`。新增计费路径时，必须使用 `*Checked` 变体并以相同方式暴露钳制信息，确保管理员日志界面和后端日志都能审计该异常。
- 计费乘数映射必须通过 `types.PriceData.AddOtherRatio` 写入；该方法会拒绝非正数、NaN 和正无穷倍率。不得直接写入 `PriceData.OtherRatios`，也不得削弱这些保护措施。
- 预扣费与结算（包括差额处理）都必须安全：经饱和处理的超大配额必须因配额不足而导致预扣费失败，绝不能静默回绕。新增计费路径（新的中继格式、任务平台或调整钩子）时，必须追踪完整链路——校验 → `EstimateBilling`/`OtherRatios` → 配额转换 → 预扣费 → 结算/退款——并确认每一步都维持这些不变量。
- 解析为无符号类型（`*uint`）的字段会接受巨大的 JSON 正数（例如 `18446744073686646784`，即回绕后的负数）；仅检查 `>= 0` 并不足够，必须设置上限。
- 测试操作遵循根目录 `AGENTS.md` 中“必须获得用户明确授权”的限制。获得授权后，这些不变量的回归测试应与其所保护的边界放在一起（请求校验器、转换辅助函数）。预期风格参见 `relay/helper/openai_image_request_test.go`、`relay/common/relay_utils_test.go` 和 `common/quota_math_test.go`。

**上游图片数量结算：** 只有通过 `RelayInfo.UpdateImageCount`，才能根据上游响应调低或调高计费图片数量；数量为零或越界时，必须保留请求阶段预留的数量。图片数量必须从图片载荷推导，绝不能根据 JSON 结构推导：

- 不得使用 gjson 的 `data.#`、`len(data)` 或任何元素计数方式统计 `data`。OpenAI 兼容渠道背后的提供商可能返回非标准结构：`data` 可能是单个对象；一张图片可能拆分为一个 `url` 条目和一个 `b64_json` 条目；条目也可能只包含 `revised_prompt`。
- 当对象形式的 `data` 含有非空 `url` 或 `b64_json` 时，计为一张图片，否则计为零。对于数组，数量为“含非空 `url` 的条目数”和“含非空 `b64_json` 的条目数”两者中的较大值。标准响应只使用一种 `response_format`，因此该值等于条目数；拆分表示的一张图片只计费一次；没有图片载荷的条目不计费。参考实现是 `relay/channel/openai/relay_image.go` 中的 `openaiImageResponseCount`；任何转发或重建 OpenAI 格式图片响应的渠道都必须复用该实现或采用相同规则。xAI 适配器已通过 `OpenaiImageHandler` 继承此规则。
- 将 OpenAI 格式的 JSON 响应体重新发送为 SSE 时，必须按相同的结构处理规则，为每个图片载荷转发一个 `image_generation.completed` 事件（对象对应一个事件，丢弃无载荷条目）。绝不能让客户端在被收取图片费用的同时只收到 `[DONE]`。
- 对于真实 SSE 流，应统计 `image_generation.completed` / `image_edit.completed` 事件；只有上游已完成流（`done` / `eof`）时，才可信任低于请求数量的统计结果。客户端中止连接时，不得将收费数量降低到请求数量以下。
- 具有自身用量字段的渠道（如阿里的 `usage.image_count`）使用该值，并以 `dto.MaxImageN` 为上限；缺失或无效时回退到转换后响应的长度。通过带类型结构体重建响应的渠道应统计对应的类型化切片；任何渠道都不得读取 `data.#`。
- 用户明确授权修改测试后，对象结构、拆分结构和无载荷结构的回归用例应添加到 `relay/channel/openai/image_stream_test.go` 中现有的固定价格、阶梯表达式及 JSON 转 SSE 转发表格。应扩展这些表格，不得新增文件。
