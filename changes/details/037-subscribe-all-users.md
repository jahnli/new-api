# 订阅管理增强：公司范围订阅、分类额度调整与高级模型限额

**日期**: 2026-10-02

## 涉及文件

- `common/quota_math.go` — 增加 decimal 严格额度转换入口，换算超限时拒绝操作而非使用饱和值。
- `controller/subscription.go` — 新增按公司全员订阅、已启用公司选项及单用户人民币额度增减接口；套餐按用户公司过滤可见范围。
- `model/subscription.go` — 全员订阅按所选启用公司覆盖全部用户（含禁用、注销），取消同套餐有效订阅后按最新额度/周期创建替代订阅，保留已用额度且不叠加总额；按旧订阅结束与新订阅开始的精确接续关系恢复旧版误清零用量；批量操作校验套餐公司范围；仅 active 且未到期订阅可调整额度，并按 USDExchangeRate 将人民币换算为 quota；减少后总额度不得低于已用额度或变为代表无限额度的零值，无限额度订阅不可减少；自动或管理员手动重置额度时，订阅总额度恢复为当前套餐额度，使手动增减只在当前重置周期生效；套餐支持 company 字段、可见性及购买前校验。
- `model/subscription_reset_test.go` — 覆盖自动重置和管理员手动重置恢复套餐额度，以及无限额度套餐重置后仍保持无限。
- `model/subscription_quota_adjustment_test.go` — 覆盖正常减少、减少至已用额度、低于已用额度、无限额度及零总额度边界。
- `model/subscription_subscribe_all_test.go` — 覆盖所选公司用户（启用、禁用、注销）订阅、旧版误清零用量恢复及越界公司套餐拒绝。
- `router/api-router.go` — 注册公司选项、全员订阅和单用户额度增减路由。
- `middleware/audit.go` — 新增 subscribe_all 审计动作。
- `web/src/features/subscriptions/api.ts` — 全员订阅增加 company_id 参数，新增公司选项查询及单用户额度减少请求。
- `web/src/features/subscriptions/types.ts` — 增加公司选项与结果类型。
- `web/src/components/confirm-dialog.tsx` — `isLoading` 时确认按钮显示旋转图标，确认/取消按钮均禁用。
- `web/src/components/__tests__/confirm-dialog.test.tsx` — 覆盖加载图标与按钮禁用。
- `web/src/features/subscriptions/components/dialogs/subscribe-all-dialog.tsx` — 弹窗加宽加高，底部操作栏固定；增加必选公司、加载失败/无公司状态，并提示覆盖同套餐有效订阅、保留额度且包含禁用/注销用户。
- `web/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx` — 用户订阅操作菜单新增“减少”，按人民币金额扣减总额度；无限额度订阅禁用该操作。
- `web/src/features/subscriptions/components/user-premium-policy.tsx` — 用户高级模型比例设置与套餐额度预览分栏展示，手动比例输入限制为正整数。
- `web/src/features/subscriptions/components/premium-quota-summary.tsx` — 合并可用额度与新上限展示，增加上限变化箭头并保留固定图标占位。
- `web/src/features/usage-logs/components/log-user-identity.tsx` — 增加可选姓名区域样式，供订阅弹框紧凑复用用户分析弹框的用户信息组。
- `web/src/features/users/components/data-table-row-actions.tsx` — 向订阅弹框传入完整用户行数据，用于展示头像、姓名与用户名。
- `web/src/features/subscriptions/components/dialogs/__tests__/quota-decrease.test.tsx` — 覆盖有效有限额度提交减少请求及无限额度禁用操作。
- `web/src/features/subscriptions/components/dialogs/__tests__/company-selection.test.tsx` — 覆盖公司展示及未选公司时禁用确认。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补充公司范围全员订阅及减少额度操作的 7 语言翻译。

## 2026-09-14 订阅管理界面弹框化与套餐额度标签

- `web/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx` — 由 `Sheet` 侧边抽屉改为共用 `Dialog` 居中弹框（`sm:max-w-4xl`，内容区 `space-y-4`）；套餐下拉选项改为「套餐名文本 + 人民币额度徽章」，去掉美元价格，总额度为 0 的套餐徽章显示 `Unlimited`；选中后收起态输入框内叠加显示套餐名与额度徽章；选项左侧内边距设为 2rem，与右侧选中对勾留白一致；下拉不再因聚焦自动展开（`openOnFocus={false}`），点击仍可展开。
- `web/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx` — 套餐新建与编辑由 `Sheet` 侧边抽屉改为共用 `Dialog` 居中弹框，宽度为视口 50%（`sm:max-w-[50vw]`，窄屏仍为全宽）；标题与描述移入弹框头部，页脚改由 `footer` 属性承载，关闭按钮用 `DialogClose` 渲染、提交按钮继续以 `form='subscription-form'` 关联表单，头部与页脚固定、表单区由弹框自身滚动；表单类名由 `sideDrawerFormClassName()` 改为 `flex min-w-0 flex-col gap-6`，避免与弹框内边距叠加及双层滚动；分区与开关行继续复用 `SideDrawerSection`、`sideDrawerSwitchItemClassName`。
- `web/src/components/ui/combobox.tsx` — `OptionCombobox`（Base UI 路径）新增 `showSelectedContent`，收起态以叠加层展示选中项的图标、文本与尾部内容，并隐藏真实输入文本与光标；选项尾部内容由右对齐改为紧跟标签文本；新增 `itemClassName` 透传选项类名。
- `web/src/components/ui/combobox-input.tsx` — `ComboboxInput` 新增 `itemClassName`，使选项类名在传统实现路径下同样生效。

## 2026-09-15 高阶模型额度限制

订阅总额度内增加高阶模型消费上限，由管理员选择模型并设置 0～100 的整数比例；用户可以继承系统默认或单独覆盖。初始关闭限制、默认比例为 100%。高阶请求同时占用总额度与高阶额度，标准模型请求仍可使用全部剩余总额度；更改比例或模型配置保留已有占用。预扣与追加预留检查限额，实际结算允许超过高阶分类限额并记录超额；总额度不足时保留待结算状态。钱包回退沿用现有计费偏好。

- `setting/subscription_premium.go` — 定义全局策略、默认比例、模型列表、配置版本及首次启用时间。
- `controller/subscription_premium.go` — 提供模型选项、全局策略及用户比例读写接口；按计费模型名称归并选项并保留别名，使用预期版本或原覆盖值检测并发修改，记录管理审计。
- `controller/option.go`、`model/option.go` — 禁止通过通用设置入口修改高阶额度策略，统一使用专用接口。
- `controller/audit.go` — 增加全局策略与用户比例变更的审计文案。
- `controller/subscription.go` — 个人与管理员订阅列表附带高阶额度摘要。
- `router/api-router.go` — 在订阅管理路由下注册全局策略、模型选项及用户比例接口。
- `model/user.go` — 新增可空用户比例覆盖字段，区分继承默认与显式 0%。
- `model/subscription.go` — 新增高阶已用额度、重置版本及预扣记录计费上下文；预扣同时检查总额度与高阶限额；重置同步清零高阶占用并递增周期版本；全员覆盖仅继承当前周期占用并迁移关联记账记录，不再从已取消订阅恢复已重置的旧用量；有记账记录的订阅禁止直接删除，保留必要记录供后续结算与退款使用。
- `model/subscription_premium.go` — 实现策略存取、比例覆盖、整数限额计算与额度摘要；按请求、目标净额及修订号处理预留、结算和退款，记录待结算及高阶超额状态；旧周期请求不再修改当前周期余额。
- `relay/helper/price.go` — 统一计费模型名称解析，供高阶分类与模型选项使用。
- `relay/common/relay_info.go` — 携带高阶分类、比例、周期版本、记账修订号、净占用及超额信息。
- `service/funding_source.go`、`service/billing_session.go`、`service/billing.go` — 订阅资金源接入持久化目标净额记账；零差额结算同样完成状态迁移，追加预留与退款使用同一请求记录，待结算状态保留预扣。
- `service/quota.go` — 实时音频订阅追加预留接入计费会话；兼容结算路径按已确认净额与修订号更新订阅占用。
- `controller/relay.go`、`service/violation_fee.go` — 订阅违规费用先结算后处理退款；异步任务保存订阅请求与预期修订号，实际订阅费用在任务持久化后结算。
- `model/task.go`、`service/task_billing.go` — 任务保存订阅请求与记账修订号，差额结算及退款检测重复应用；持久化任务额度时核对记账状态并保留其他轮询数据。
- `service/log_info_generate.go` — 消费日志附带高阶分类、比例、周期版本、计费模型、净占用与超额信息；任务日志由 `service/task_billing.go` 补充相应快照。
- `web/src/features/subscriptions/premium-api.ts`、`web/src/features/subscriptions/types.ts` — 增加策略、用户覆盖及额度摘要类型与请求封装，保存时携带并发校验字段。
- `web/src/features/subscriptions/components/premium-policy-dialog.tsx`、`web/src/features/subscriptions/components/subscriptions-primary-buttons.tsx` — 订阅管理新增全局设置弹框，支持启停限制、默认比例、模型多选与刷新，保留已选但暂不可用的模型。
- `web/src/features/subscriptions/components/user-premium-policy.tsx`、`web/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx` — 用户订阅弹框增加默认比例继承、单独覆盖与新限额预览，保存后刷新相关数据。
- `web/src/features/subscriptions/components/premium-quota-summary.tsx`、`web/src/features/subscriptions/lib/premium-quota.ts` — 展示高阶已用额度、上限、可用额度、比例来源及限制状态，明确包含请求预留；使用大整数处理额度并保护展示精度。
- `web/src/features/profile/components/subscription-card.tsx` — 个人订阅卡片展示高阶额度摘要，改用查询缓存加载订阅数据。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补充高阶额度配置、比例校验、继承与额度展示文案。
- `docs/subscription-premium-quota-implementation-plan.md` — 记录额度口径、实施边界、记账生命周期及部署验收要求；数据库验证与部署验收仍待完成。

## 2026-09-17 高阶额度不足专用提示与通知

高阶模型初始预扣或追加预留因高阶限额不足被拒绝时，使用独立错误码 `subscription_premium_quota_insufficient` 和中文提示，说明普通模型仍可使用订阅剩余总额度。保留原有计费偏好及套餐钱包回退规则；高阶额度与钱包余额均不足时，同时说明两种原因，避免钱包错误覆盖高阶不足原因。

- `service/billing_session.go` — 区分高阶限额不足与普通订阅额度不足，接入专用提示及异步通知；订阅优先和钱包优先两种路径均保留双重不足信息，钱包支付成功仍正常返回，数据库和令牌错误不改写为高阶余额不足。
- `service/subscription_premium_notify.go` — 新增高阶额度不足错误构造及通知，复用用户已有的邮件、Webhook、Bark、Gotify 渠道与限频机制，使用独立通知类别，避免被总额度提醒共用的限频计数抑制；通知说明等待重置、联系管理员调整比例及钱包支付的条件，明确充值钱包不会直接增加订阅高阶额度。通知在高阶预扣不足时触发，即使随后钱包支付成功也会提醒，不代表请求最终失败；原有总额度阈值预警保持不变。

本次 `go build ./...` 与 `git diff --check` 通过；未新增、修改或运行测试，未发送实际通知。

## 2026-09-20 个人资料高阶额度摘要交互优化

- `web/src/features/subscriptions/components/premium-quota-summary.tsx` — 放大高阶额度摘要文字，并将额度说明悬停提示的等待时间缩短至 100ms，使提示快速显示。

## 2026-09-23 订阅额度分类调整与精度优化

- `model/subscription_quota_adjustment.go` — 新增原子化的总额度、标准模型额度和高阶模型额度调整，记录调整前后额度与比例并校验已用额度、无限额度、并发版本及两位小数舍入边界。
- `controller/subscription.go`、`model/subscription.go` — 管理员额度增减接口支持选择额度类型，审计记录调整前后额度、额度类别及高阶比例变化。
- `setting/subscription_premium.go`、`model/subscription_premium.go`、`controller/subscription_premium.go`、`model/user.go`、`relay/common/relay_info.go` — 高阶模型默认比例和用户覆盖比例支持 0～100 的两位小数，并以浮点比例贯穿策略校验、额度计算和中继计费上下文。
- `web/src/features/subscriptions/api.ts`、`web/src/features/subscriptions/types.ts`、`web/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx`、`web/src/features/subscriptions/components/premium-policy-dialog.tsx`、`web/src/features/subscriptions/components/user-premium-policy.tsx` — 订阅管理支持选择总额度/标准模型额度/高阶模型额度，展示比例调整说明，并将比例输入精度扩展至两位小数。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补充额度类型、分类调整、比例精度和调整后用户覆盖规则的多语言文案。

## 2026-09-24 额度术语与不足提示统一

- `service/subscription_premium_notify.go` — 高级模型额度不足统一返回 HTTP 402，保留业务错误码 `subscription_premium_quota_insufficient`；错误文案说明标准模型仍可使用剩余订阅额度，并引导等待重置或通过飞书、钉钉申请高级模型额度。异步通知同步将“普通模型”改为“标准模型”。
- `controller/subscription_premium.go`、`router/api-router.go` — 新增登录用户可访问的当前高级模型只读接口，仅返回策略中配置的模型名称，不开放管理配置。
- `web/src/features/subscriptions/premium-api.ts` — 增加当前高级模型名称查询，供额度明细通过 React Query 共享缓存复用。
- `web/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx` — 管理员额度调整选项将“基础模型额度”改为“标准模型额度”，内部 `basic` 额度类型保持不变。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 七种语言统一使用“标准模型额度”及对应说明，并移除不再使用的基础模型额度翻译键。

## 2026-09-25 用户订阅管理弹框与额度预览优化

- 管理弹框改为分区卡片布局，桌面端高度为视口的 84%、最大宽度为 `max-w-5xl`；下方订阅区域填满剩余高度，新增入口固定在区域顶部，表格支持内部滚动，总额度列增加用量进度条。
- 头部左侧直接复用用户分析弹框的 `LogUserIdentity`，右侧展示标题；传入头像、显示名称、用户名等资料，保留悬停资料卡能力。通过可选 `nameClassName` 去掉本弹框内姓名区域的预留宽度，其他调用方维持默认布局。
- 高级模型额度设置与用量分栏展示，额度卡片显示套餐名称和订阅 ID，复用个人资料页相同尺寸、配色与背景的皇冠 `IconBadge`。隐藏重复的高级模型额度标题行，说明及额度辅助文字统一使用 `text-sm`。
- 可用额度和新额度上限并排展示，窄屏自动换行；新上限使用原始 `bigint` 额度与当前上限比较，提高时显示向上箭头和成功色，降低时显示向下箭头和警告色。相同或预览无效时不显示箭头，但保留固定的 16×16px 图标位置和文字间距，避免图标切换引起布局跳动，并保留读屏方向提示。
- 用户手动覆盖比例改为 1～100 的正整数，步进为 1；输入或粘贴时去掉小数部分并限制上下界，保存与预览校验同步收紧。继承系统默认时仍接受原有 0～100、最多两位小数的策略值，不改变后端及全局策略契约。
- 增加、减少额度弹框移除比例联动及舍入的长说明；选择特定模型额度时，仍提示调整会成为用户覆盖比例且在重置后保留。
- 七种语言补充“可用额度”和“新额度上限”的简短文案，使用翻译脚本写入并执行 `bun run i18n:sync`。

本次实现过程中执行 `bun run typecheck`、对修改过的 TSX 文件执行 `bunx --no-install oxlint -c .oxlintrc.json <文件路径>` 与 `bunx --no-install oxfmt --check <文件路径>`，均通过；`git diff --check` 通过。未新增、修改或运行测试，最终箭头切换效果尚未在浏览器中复核。

## 2026-10-02 订阅套餐与额度策略标签页

- `web/src/features/subscriptions/index.tsx` — 订阅管理拆分为「订阅套餐 / 额度策略」两个标签页，复用模型管理相同的分段标签样式；套餐列表及合规提示保留在订阅套餐页，额度策略页支持独立滚动。
- `web/src/features/subscriptions/components/subscriptions-primary-buttons.tsx` — 移除高级模型额度设置弹框入口，新增套餐按钮仅在订阅套餐页显示。
- `web/src/features/subscriptions/components/premium-policy-dialog.tsx` — 全局配置由弹框改为页内表单，分成「额度规则」与「适用模型」两张卡片；保留启停限制、默认比例、模型多选、刷新及不可用模型回显，明确比例占订阅总额度及高级用量同时消耗总额度；保存成功后更新策略缓存与版本并刷新相关查询，沿用现有接口和并发校验。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补齐标签页、分区标题、比例标签及模型适用说明的七种语言翻译。

## 自 CHANGELOG 说明列迁入

订阅管理增强：全员订阅按所选公司覆盖全部用户（含禁用、注销），重复执行覆盖同套餐有效订阅、保留已用额度且不叠加总额，并可恢复旧逻辑误清零的用量；确认框优化加载态与禁用态；管理员可按人民币金额增减单个有效用户总额度，减少后不得低于已用额度，无限额度不可减少；额度重置时总额度恢复为当前套餐额度，手动增减仅当期生效；套餐选择显示额度，套餐按公司限制可见范围，购买与批量订阅同步校验
