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

## 人员每日金额表

“人员每日金额表”“按公司导出每天消费”“周末金额归周一”使用 `scripts/daily_usage.py`；个人月报仍使用 `personal_monthly_stats.py`。

```text
python scripts/daily_usage.py --month 6
python scripts/daily_usage.py --month 6 --company "赛美特集团"
python scripts/daily_usage.py --month 6 --company "上海繁竞科技有限公司" --output "output/gateway-ops/本次运行/每日金额.csv"
```

- Python 3.10+；数据库依赖 `psycopg2`（安装包 `psycopg2-binary`），默认 Excel 输出另需 `openpyxl`，CSV 不需要该包。需要可用的 `Asia/Shanghai` 时区数据；Windows 缺少时区数据时可在项目环境安装 `tzdata`。
- `--month` 必填，范围 1–12；年份固定为 2026，不支持 `--year`。用户请求其他年份时说明能力缺口，不映射到 2026 年执行。`--tz` 默认 `Asia/Shanghai`，决定日期边界与周末判断。
- 默认分别统计“赛美特集团”和“上海繁竞科技有限公司”；`--company` 仅接受这两个精确名称，可重复指定，重复公司会去重。只指定一家时仅导出该公司，不能用此脚本统计其他公司或筛选个人、部门。
- 数据源为 PostgreSQL `quota_data`，连接默认来自脚本内 `POSTGRES_*` 常量，不读取 `.env` 或 `SQL_DSN`。支持 `--host`、`--port`、`--user`、`--password`、`--schema`，数据库名固定；schema 仅允许字母、数字、下划线且不能以数字开头。技能调用不把密码放进命令文本，现有参数若无法安全传递所需凭据，应说明缺口。
- 只统计 `users.open_id` 非空且去空格后非空的用户，公司按当前 `users.company` 精确匹配，无启用状态筛选。公司内同工号合并，无工号按 user_id 独立；工号优先取 `job_number`，不存在时取 `employee_number`，均不存在则失败。归属依赖当前用户资料，不是历史组织快照。
- 周六、周日的额度固定归入下一个周一，周末日期列为 0，无开关；不支持旧的 `--weekend-to-friday`。按归并后的日期筛选月份：月初为周日或周一时补取上月底相应周末；月末周末若对应下月周一，计入下月。查询时间左闭右开，结束于下月 1 日 00:00:00。该口径与自然月账单总额不同，本月也只能称为“整月归集窗口，目前已有记录”。
- 金额为 `quota / QuotaPerUnit * exchange_rate`，先按人员、归集日累加额度，再转换并四舍五入到两位；人员总计为展示的每日金额之和。`--quota-per-unit` 必须大于 0，未提供时读取 `options.QuotaPerUnit`，缺失或无效时使用 500000；`--exchange-rate` 必须大于 0，默认 6.8。保留此口径，不重算历史账单。
- `--output` 是基础文件名，仅支持 `.xlsx` 或 `.csv`，自动在扩展名前添加 `_<公司名称>`。默认在当前目录生成 `person_daily_amount_2026MM_weekend_to_monday_<公司名称>.xlsx`，两家公司各一个文件。技能运行优先显式指定本次独立输出目录中的基础文件名，避免同名覆盖；父目录会自动创建，已有同名文件会覆盖，无备份或预览开关。
- 表格含年份、月份、员工名称、username、工号、部门、固定 1–31 日列及总计；超出当月天数的列为 0。Excel 提供冻结列、筛选和金额格式；CSV 为 UTF-8 BOM。仅查询数据库和写本地文件，无数据库业务写入、API 写入或飞书发送，不支持 `--apply`、`--send-feishu`、任意日期区间。
- 交付时核对每家公司输出的用户数、合并后人数、人民币总额及“已输出”路径，并确认文件属于本次运行。即使无用户也会生成仅表头的文件，必须说明为空。某家公司写入失败时可能已生成另一家的文件，核对实际产物后报告部分完成，不能只凭首个文件认定全部成功。

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
