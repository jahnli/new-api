# 排行榜 Token 可见性与热门模型 Tooltip 优化

**日期**: 2026-07-04

## 涉及文件

- `web/default/src/features/rankings/index.tsx` — 按当前用户角色判断是否超级管理员，并将 Token 数字可见性传给排行榜各模块
- `web/default/src/features/rankings/components/models-section.tsx` — 热门模型总 Token、图表坐标轴和 Tooltip Token 数字仅超级管理员可见；Tooltip 右侧新增按悬停数据排序的连续排行编号；榜单描述文案改为 Token 排行
- `web/default/src/features/rankings/components/model-leaderboard.tsx` — 模型排行榜行内 Token 数字与增长信息仅超级管理员可见
- `web/default/src/features/rankings/components/market-share-section.tsx` — 市场份额 Tooltip 和供应商列表 Token 数字仅超级管理员可见
- `web/default/src/i18n/locales/en.json` — 更新排行榜说明与 Token 排行相关英文文案
- `web/default/src/i18n/locales/fr.json` — 更新排行榜说明与 Token 排行相关法语文案
- `web/default/src/i18n/locales/ja.json` — 更新排行榜说明与 Token 排行相关日语文案
- `web/default/src/i18n/locales/ru.json` — 更新排行榜说明与 Token 排行相关俄语文案
- `web/default/src/i18n/locales/vi.json` — 更新排行榜说明与 Token 排行相关越南语文案
- `web/default/src/i18n/locales/zh.json` — 更新排行榜说明与 Token 排行相关中文文案
