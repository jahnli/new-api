# 用量报表

命令从项目根目录执行，`python` 代表已检查的解释器。例子中的姓名、部门和年月是占位示例，运行时用用户实际参数替换。

## 月报

```text
python scripts/company_stats.py "公司名称" 9 --year 2026
python scripts/primary_department_stats.py "一级部门名称" 9 --year 2026
python scripts/secondary_department_stats.py "二级部门名称" 9 --year 2026
python scripts/personal_monthly_stats.py "username" 9 --year 2026
```

- 必需依赖：`psycopg2`（可通过 `psycopg2-binary` 安装）。四种月报均通过 `secondary_department_stats.py` 内的 `DEFAULT_DSN` 连接 PostgreSQL；它不读取 `SQL_DSN` 或 `.env`，不能声称设置环境变量即可换站。
- 公司按 `users.company` 匹配；一级/二级部门分别匹配 `users.department_name` 路径的第一/第二段。传单段名称，不传完整路径。个人按 `users.username` 精确匹配，显示名不能替代用户名。
- 公司和一级部门包含月末前注册的禁用用户；二级部门只包含启用用户；个人查询不按启用状态筛选。人数和总费用的对比必须保留这一区别。
- 时间为北京时间月初 00:00:00 到月末 23:59:59，包含两端。脚本默认年份目前固定为 2026，必须传 `--year`。查询本月时注明“整月窗口，目前已有记录”，不能把它描述成已结束月份的完整结果。
- 月报仅支持整月，没有 `--start`、`--end`、`--output`、`--send-feishu`。任意日期的公司/部门/个人报表不能用全站周报替代。支持逐月运行以覆盖多个月。
- 产物为标准输出文本；保存文件由技能捕获文本完成。保留脚本关于历史日志按 Token 占比分摊费用的提示，不把回退分摊值描述成精确的分类原始账单。

## 周报与自定义周期

```text
python scripts/weekly_stats.py --period current
python scripts/weekly_stats.py --period last
python scripts/weekly_stats.py --start "2026-10-12 00:00:00" --end "2026-10-18 23:59:59"
```

当前脚本的周报口径：

| 参数 | 实际时间范围（北京时间） |
| --- | --- |
| `--period current` | 本周一 00:00:00 至运行时刻 |
| `--period last` | 上周一 00:00:00 至上周五 18:30:00 |
| `--start` 与 `--end` | 明确指定的区间，包含两端，覆盖 `--period` |

普通“上周报告”沿用脚本 `last` 口径，并在执行说明和结果中明确截止周五 18:30。明确要求“完整自然周”“含周末”时计算上周一至周日 23:59:59，使用自定义参数。不能把脚本默认上周说成完整七天；不能用下周一 00:00:00 作结束时间而引入重复边界。

- 必需依赖：`psycopg2`、`matplotlib`、`PIL`（安装包为 `Pillow`），以及可用的中文字体。支持 `--font <字体文件>`；不要在缺字体时声称中文图表正常。
- 主站使用脚本内 `DEFAULT_DSN`，文字报告和消费图针对内置 `TARGET_COMPANY`（当前为赛美特集团）；第二站使用 `SECONDARY_STATS_DSN` 环境变量，未设置时用内置 `SECONDARY_DSN`，用户表包括公司字段非空的用户。两个站点都要可访问，两份数据不是同一用户范围。
- 不支持 `--company`、`--site` 或单站开关，不能为了绕过第二站失败而静默交付“完整周报”。配置及飞书凭据的实际来源以当次源码为准，不输出其值。
- 本地模式在 `scripts/` 生成 `weekly_consumption_histogram.png` 和 `weekly_user_stats.png`，或分页的 `weekly_user_stats_001.png` 等；会复用同名文件。运行前将已有同名产物备份到本次输出目录的 `previous/`，仅处理这些明确命名的文件；运行后依据本次输出的路径收集新文件，复制到本次输出目录交付，不用宽泛通配符混入旧分页。
- `--rows-per-image` 默认为 50，0 表示完整长图。只按用户请求或明确的可读性需要调整。

## 飞书发送

在已经选定的周报命令上追加 `--send-feishu`。例如：

```text
python scripts/weekly_stats.py --period last --send-feishu
```

此参数会发送主站文字周报、消费图和第二站用户表格，发送到脚本配置的群机器人，不能只发送其中一部分。运行前说明该范围；用户要求发送单部门报表或更换群时，现有参数不支持，不擅自复用此命令。

发送模式使用临时目录，完成后图片会被清理；仅要求发送时不承诺可下载文件。如同时要求保存本地副本和发送，可先以固定 `--start/--end` 本地生成，再以相同参数发送，说明两次查询期间数据可能变化；如要求发送与本地严格相同的快照，现有接口不支持直接发送既有产物，需先说明缺口。

只在脚本确认完整发送成功时报告全部成功。中断或发送错误可能意味着部分消息已到达，不能自动重跑整条命令。
