# 订阅管理增强：全员订阅、单用户额度调整与高阶模型额度限制

**日期**: 2026-09-15

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
- `web/src/features/subscriptions/components/dialogs/__tests__/quota-decrease.test.tsx` — 覆盖有效有限额度提交减少请求及无限额度禁用操作。
- `web/src/features/subscriptions/components/dialogs/__tests__/company-selection.test.tsx` — 覆盖公司展示及未选公司时禁用确认。
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json` — 补充公司范围全员订阅及减少额度操作的 7 语言翻译。

## 2026-09-14 订阅管理界面弹框化与套餐额度标签

- `web/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx` — 由 `Sheet` 侧边抽屉改为共用 `Dialog` 居中弹框（`sm:max-w-4xl`，内容区 `space-y-4`）；套餐下拉选项改为「套餐名文本 + 人民币额度徽章」，去掉美元价格，总额度为 0 的套餐徽章显示 `Unlimited`；选中后收起态输入框内叠加显示套餐名与额度徽章；选项左侧内边距设为 2rem，与右侧选中对勾留白一致；下拉不再因聚焦自动展开（`openOnFocus={false}`），点击仍可展开。
- `web/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx` — 套餐新建与编辑由 `Sheet` 侧边抽屉改为共用 `Dialog` 居中弹框，宽度为视口 50%（`sm:max-w-[50vw]`，窄屏仍为全宽）；标题与描述移入弹框头部，页脚改由 `footer` 属性承载，关闭按钮用 `DialogClose` 渲染、提交按钮继续以 `form='subscription-form'` 关联表单，头部与页脚固定、表单区由弹框自身滚动；表单类名由 `sideDrawerFormClassName()` 改为 `flex min-w-0 flex-col gap-6`，避免与弹框内边距叠加及双层滚动；分区与开关行继续复用 `SideDrawerSection`、`sideDrawerSwitchItemClassName`。
- `web/src/components/ui/combobox.tsx` — `OptionCombobox`（Base UI 路径）新增 `showSelectedContent`，收起态以叠加层展示选中项的图标、文本与尾部内容，并隐藏真实输入文本与光标；选项尾部内容由右对齐改为紧跟标签文本；新增 `itemClassName` 透传选项类名。
- `web/src/components/ui/combobox-input.tsx` — `ComboboxInput` 新增 `itemClassName`，使选项类名在传统实现路径下同样生效。

## 2026-09-15 高阶模型额度限制

订阅总额度内增加高阶模型消费上限，由管理员选择模型并设置 0～100 的整数比例；用户可以继承系统默认或单独覆盖。初始关闭限制、默认比例为 100%。高阶请求同时占用总额度与高阶额度，普通请求仍可使用全部剩余总额度；更改比例或模型配置保留已有占用。预扣与追加预留检查限额，实际结算允许超过高阶分类限额并记录超额；总额度不足时保留待结算状态。钱包回退沿用现有计费偏好。

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

## 自 CHANGELOG 说明列迁入

订阅管理增强：全员订阅按所选公司覆盖全部用户（含禁用、注销），重复执行覆盖同套餐有效订阅、保留已用额度且不叠加总额，并可恢复旧逻辑误清零的用量；确认框优化加载态与禁用态；管理员可按人民币金额增减单个有效用户总额度，减少后不得低于已用额度，无限额度不可减少；额度重置时总额度恢复为当前套餐额度，手动增减仅当期生效；套餐选择显示额度，套餐按公司限制可见范围，购买与批量订阅同步校验
