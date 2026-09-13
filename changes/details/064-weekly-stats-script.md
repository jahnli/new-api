# AI 中转站周报统计脚本

**日期**: 2026-07-25

## 涉及文件

- `scripts/weekly_stats.py`

## 自 CHANGELOG 说明列迁入

新增 AI 中转站周报统计脚本：按使用日志历史计费快照拆分输入、输出与缓存 Token/费用，汇总均价、缓存命中率及费用 Top 5 模型；支持上周/本周周期选择、内置模型归一化映射，并补充 Claude Sonnet 5；修正 Anthropic 缓存写入统计，优先采用显式 cache_write_tokens 并增强 Claude 语义识别，避免缓存 Token 重复计算
