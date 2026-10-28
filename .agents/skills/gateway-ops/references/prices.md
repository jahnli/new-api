# 模型价格操作

从项目根目录执行。运行价格同步前完整读取 `.agents/rules/billing.md`。这里只编排现有脚本，不修改价格算法、表达式或官方参考价格。

## 导出新的模型价格表

```text
python scripts/model_square_prices.py --output "<绝对路径>/model-prices.xlsx"
```

- 必需依赖：`openpyxl`。输出目录需预先存在，文件后缀必须为 `.xlsx`；始终显式传入 `--output`，避免覆盖脚本默认桌面文件。
- 读取进程环境 `MODEL_SQUARE_BASE_URL`、`MODEL_SQUARE_TOKEN`；此脚本不自动加载 `.env`。用户已配置根目录 `.env` 且需要复用时，可通过 `python-dotenv` 在当前子进程内加载（`override=False, interpolate=False, encoding="utf-8-sig"`）后执行，不打印配置，也不把令牌写入 `--token` 命令参数。
- 可用参数还有 `--base-url`、`--official-prices`、`--timeout`。通过 `/api/status` 和 `/api/pricing` 获取数据；官方参考默认来自 `scripts/official_model_prices.json`，不代表已实时核对官网。
- 价格为人民币/百万 Token，取当前用户可见分组的最低有效倍率；不等同于报价表同步的固定 `Basic` 分组。不要捏造 `--group`。
- 此脚本读取普通 JSON 定价响应；如果站点返回它不支持的加密或其他结构，报告实际错误，不宣称导出成功或擅自改用另一个站点。

## 更新既有报价表

```text
python scripts/sync_price_sheet.py --workbook "<报价表绝对路径>.xlsx"
python scripts/sync_price_sheet.py --workbook "<报价表绝对路径>.xlsx" --apply
```

- 第一条为只读预览，第二条备份后写入；用户只要求预览时停在第一条。明确要求更新时先预览，确认实际工作簿与授权一致后执行第二条，不重复询问已明确的写入意图。
- 工作簿默认 `scripts/AI Gateway 体系说明与价格表.xlsx`，先检查存在；不存在时询问实际路径，不新建空表替代。只修改“模型价格列表”已有模型行的 B/C/D/E/G 列，不增加模型，不改协议列和排版。
- 分组由脚本 `GROUP_NAME` 固定（当前 `Basic`，忽略大小写）。没有 `--group`。其他分组请求需先说明限制，不临时改源码完成运营调用。
- 在线模式自动加载根目录 `.env`，已有环境优先：`MODEL_SQUARE_BASE_URL`、`MODEL_SQUARE_TOKEN`、`MODEL_SQUARE_AES_KEY`。在线模式存在 `.env` 时需要 `python-dotenv`；加密响应需要 `cryptography` 和对应 AES Key。离线模式不加载 `.env`。不展示密钥、令牌或原始敏感响应。
- 离线模式同时提供 `--pricing-json <已解密定价响应>` 和 `--status-json <状态响应>`；两者缺一不可。另支持 `--official-prices`、`--timeout`，无 `--output`。
- Token 价格为人民币/百万 Token，按次价格为人民币/次。普通 Token 阶梯默认使用摘要第一档；用户指定档位时传入 `--tier "长上下文"` 等实际名称，单档模型沿用唯一档位，多档模型找不到唯一匹配项时停止。单个模型可用 `--model-tier "deepseek-v4.1-flash=高峰"` 覆盖；该参数可重复，时段价格必须经用户明确选择档位后使用，不按当前时间推测。预览会注明实际档位；遇到未明确选择的时段、混合计费或任务用量表达式会停止，不能跳过失败模型强行写表。
- 原文件旁生成带时间戳的 `.xlsx.bak`，校验后原子替换。交付实际备份链接；无变化时可能不生成备份，不能编造。价格响应或工作簿并发变化报错时停止，保留原始失败原因的脱敏摘要。

## 跨站同步基础定价和推荐

```text
python scripts/sync_model_prices.py
python scripts/sync_model_prices.py --apply
```

- 方向固定为 `SQL_DSN`（A 源站）→ `TARGET_SQL_DSN`（B 目标站），从环境和根目录 `.env` 读取，环境优先。只显示 A/B 与必要的非秘密站点标识，不输出 DSN。用户要求反向同步时不能直接运行当前配置。
- PostgreSQL 需要 `psycopg`（安装包 `psycopg[binary]`），MySQL 需要 `pymysql`（安装包 `PyMySQL`），按两端类型检查。存在 `.env` 时需要 `python-dotenv`。脚本不支持 SQLite，不能套用项目主程序的三库兼容声明。
- 默认预览；`--apply` 备份后事务写入。可用 `--backup-dir <目录>`，默认用户目录下 `.new-api-pricing-backups`。备份中有原始配置和待写入内容，不含密码；保留备份，不自动清理。
- **完整替换目标站价格映射和模型广场推荐配置，不是仅追加缺失模型。** B 站独有价格覆盖项也会移除并回退默认值。推荐总开关、列表、顺序、场景、理由和启用状态均被覆盖；A 未保存推荐配置时会按应用默认值关闭推荐并清空 B 列表。执行写入前必须说明这一实际范围。
- 不修改分组倍率、工具附加费、用户、渠道、余额、日志；不创建模型或渠道。`QuotaPerUnit` 只比较不修改。目标不可用模型不会因为同步推荐就可用。
- 两站应使用相同代码和任务插件版本，源价格应已通过后台校验；同步期间需避免后台编辑价格与推荐。用户已提供维护窗口/暂停编辑信息时复用，未明确且可能并发编辑时先完成预览并说明所需条件，不自行停止服务。不能绕过脚本的配置缺失、配额单位不一致、锁定后并发变化等检查。
- 执行后报告数据库写入状态、变更摘要和备份；应用各实例仍需按 `SYNC_FREQUENCY` 刷新（默认约 60 秒），页面也有缓存。不自动重启服务，不以数据库写入成功宣称所有实例和页面已刷新。
- 提交时断线或结果不明：停止写入，先重新只读预览并核对备份和目标状态；不直接再次 `--apply`。没有自动恢复参数，不臆造 `--restore`，也不自动把备份回灌数据库。
