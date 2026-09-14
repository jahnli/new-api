# AI 中转站周报统计脚本

**日期**: 2026-07-25 ~ 09-14（最后更新 09-14）

## 涉及文件

- `scripts/weekly_stats.py`
- `scripts/weekly_stats.py`、`scripts/personal_monthly_stats.py`、`scripts/secondary_department_stats.py` — 缓存命中率分母改为非缓存输入 + 缓存读取 + 缓存写入，缓存写入 Token 从输出侧归回输入侧，输入输出倍数随口径修正；综合缓存命中率显示由整数改为保留一位小数

## 变更说明

- 缓存命中率口径：缓存写入属未命中，此前被并进输出侧，导致命中率被高估（例如实际 75% 被报为 90%）、输入输出倍数偏高。修正后为 `cache_read / (uncached_input + cache_read + cache_write)`，与后端计费口径（`service/text_quota.go`）一致。

## 自 CHANGELOG 说明列迁入

新增 AI 中转站周报统计脚本：按使用日志历史计费快照拆分输入、输出与缓存 Token/费用，汇总均价、缓存命中率及费用 Top 5 模型；支持上周/本周周期选择、内置模型归一化映射，并补充 Claude Sonnet 5；修正 Anthropic 缓存写入统计，优先采用显式 cache_write_tokens 并增强 Claude 语义识别，避免缓存 Token 重复计算
