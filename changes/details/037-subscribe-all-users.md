# 订阅管理增强：全员订阅与单用户额度调整

**日期**: 2026-09-01

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

## 自 CHANGELOG 说明列迁入

订阅管理增强：全员订阅按所选公司覆盖全部用户（含禁用、注销），重复执行覆盖同套餐有效订阅、保留已用额度且不叠加总额，并可恢复旧逻辑误清零的用量；确认框优化加载态与禁用态；管理员可按人民币金额增减单个有效用户总额度，减少后不得低于已用额度，无限额度不可减少；额度重置时总额度恢复为当前套餐额度，手动增减仅当期生效；套餐选择显示额度，套餐按公司限制可见范围，购买与批量订阅同步校验
