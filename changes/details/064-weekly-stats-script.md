# AI 中转站周报统计

**日期**: 2026-09-14

周报按使用日志历史计费快照拆分输入、输出和缓存 Token/费用，汇总均价、命中率及费用 Top 5 模型；支持上周/本周和模型归一化映射（含 Claude Sonnet 5）。

优先使用显式 cache_write_tokens 并识别 Claude usage 语义，避免缓存重复累计；写入归输入侧且视为未命中，命中率为 cache_read ÷（uncached_input + cache_read + cache_write），保留一位小数，输入/输出倍数使用同一口径。个人月报与部门脚本同步该规则。

入口：`scripts/weekly_stats.py`、`scripts/personal_monthly_stats.py`、`scripts/secondary_department_stats.py`。
