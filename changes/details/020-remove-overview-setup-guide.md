# 移除概览页引导区域

**日期**: 2026-09-17

## 涉及文件

- `web/src/features/dashboard/components/overview/overview-dashboard.tsx` — 删除概览页 Setup guide 引导的全部实现，文件由 844 行缩减至 111 行

## 变更说明

### 2026-09-17：彻底移除引导

删除的界面：

- 展开态引导大卡片：「Get started」三步清单（创建 API Key / 充值 / 发送请求，含完成状态勾选与进度）、首个 API 请求的 curl 预览与复制按钮、路由/鉴权/模型的信号面板、「Recommended actions」推荐操作列表
- 折叠态 compact 条：引导进度徽章与「Show setup guide」按钮
- 页面标题右侧的「Setup guide」开关按钮

删除的状态与持久化：

- localStorage 键 `dashboard_overview_setup_guide_expanded`（值为 `expanded` / `collapsed`），以及 `getSavedSetupGuideExpanded`、`saveSetupGuideExpanded`
- `manualSetupGuideExpanded` state 与 `handleSetupGuideToggle`

删除仅服务引导的组件与工具：`SetupGuideBackdrop`、`StartStepItem`、`RequestPreview`、`QuickActionItem`、`CompactQuickAction`、`buildCurlCommand`、`normalizeEndpoint`、`getCurrentOrigin`、`getPreferredKey`、`formatDisplayKey`，以及 `StartStep`、`QuickAction`、`RequestExample`、`HeroSignal` 类型。

随之移除的无用请求与 import：`apiKeysQuery`、`modelsQuery`、`useApiInfo`、`useQuery`、`motion` / `useReducedMotion`、`MOTION_TRANSITION`、`IconBadge`、`Button`、`toast`、`useCopyToClipboard`、`fetchTokenKey`、`getApiKeys`、`getUserModels`、`handleServerError`。

保留内容：页面标题、`SummaryCards` 汇总卡片、内容面板（管理员性能健康、API 信息、公告、FAQ、Uptime），以及 `useDashboardContentVisibility` 对各面板的显隐控制。

`web/src/i18n/locales/*.json` 中 `Setup guide`、`Get started`、`Add credits` 等约 20 个键成为孤儿键，未删除（`bun run i18n:sync` 不按源码清理未使用键）。

### 2026-06-20：初版条目记录

初版条目记录的是移除概览页「开始使用」和「推荐操作」区域，对应同一文件。
