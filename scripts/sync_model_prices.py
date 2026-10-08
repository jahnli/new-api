#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 A 站的模型基础定价单向同步到 B 站（Python 3.10+）。

先填写下方 SOURCE_DB / TARGET_DB；两站应使用相同代码及任务插件版本。
    python scripts/sync_model_prices.py          # 只读预览
    python scripts/sync_model_prices.py --apply  # 备份后执行

MySQL:      python -m pip install PyMySQL
PostgreSQL: python -m pip install "psycopg[binary]"

同步完整价格映射：B 站独有的模型价格覆盖项也会被移除，回退到程序默认值。
不修改分组倍率、工具附加费、用户、渠道、余额或日志。QuotaPerUnit 只比较不修改。
缺失的数据库行不等于空映射：若 A 缺失而 B 存在，先在 A 后台保存模型定价，
让应用将内置默认值落库后重试；脚本不会猜测内置默认值或删除整个配置行。
表达式按原文复制，不代替应用的编译和插件兼容性检查；源站价格应已通过后台校验。

执行前暂停两站后台价格编辑。事务提交后各服务实例仍需等待配置刷新
（默认约 60 秒，以 SYNC_FREQUENCY 为准）；数据库验证不代表内存已刷新。
备份保留原始配置字符串及待写入内容，不含数据库密码，不自动删除。
连接信息按要求直接写在本文件中，填入真实密码后的文件请仅在本地保存。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from contextlib import ExitStack, closing
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path


# ======================== 只需修改此处 ========================
SOURCE_DB = {
    "driver": "postgres",  # mysql / postgres
    "host": "xxxxx",
    "port": 5432,  # PostgreSQL 通常为 5432
    "database": "xxxxx",
    "user": "xxxxx",
    "password": "xxxxx",
}

TARGET_DB = {
    "driver": "postgres",
    "host": "xxxxx",
    "port": 5432,
    "database": "xxxxx",
    "user": "xxxxx",
    "password": "xxxxx",
}

BACKUP_DIR = Path.home() / ".new-api-pricing-backups"
# ============================================================

# 与 model/model_pricing_config.go 的 modelPricingOptionKeys 保持一致。
PRICE_KEYS = (
    "AudioCompletionRatio", "AudioRatio", "CacheRatio", "CompletionRatio",
    "CreateCacheRatio", "ImageRatio", "ModelPrice", "ModelRatio",
    "billing_setting.billing_expr", "billing_setting.billing_mode",
    "billing_setting.plugin_billing_expr",
)
READ_KEYS = (*PRICE_KEYS, "QuotaPerUnit")


class SyncError(Exception):
    """可以直接展示、且不包含连接凭据的操作错误。"""


def connect_database(config: dict, label: str):
    driver = config["driver"]
    if driver not in ("mysql", "postgres"):
        raise SyncError(f"{label} driver 仅支持 mysql / postgres。")
    for key in ("host", "database", "user", "password"):
        if str(config[key]).startswith(("SOURCE_", "TARGET_")):
            raise SyncError(f"请先填写 {label} 的 {key}。")
    if driver == "mysql":
        try:
            import pymysql
        except ImportError:
            raise SyncError("请先执行：python -m pip install PyMySQL") from None
        return pymysql.connect(
            host=config["host"], port=config["port"], database=config["database"],
            user=config["user"], password=config["password"], charset="utf8mb4",
            connect_timeout=15, read_timeout=30, write_timeout=30,
            autocommit=True,
        )
    try:
        import psycopg
    except ImportError:
        raise SyncError('请先执行：python -m pip install "psycopg[binary]"') from None
    return psycopg.connect(
        host=config["host"], port=config["port"], dbname=config["database"],
        user=config["user"], password=config["password"], connect_timeout=15,
        autocommit=True,
    )


def check_target_schema(connection, driver: str):
    """仅允许有 key 单列主键的既有 options 表；不执行迁移。"""
    with closing(connection.cursor()) as cursor:
        if driver == "mysql":
            cursor.execute(
                "SELECT ENGINE FROM information_schema.TABLES "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'options'"
            )
            row = cursor.fetchone()
            if not row or row[0].lower() != "innodb":
                raise SyncError("B 站 options 必须是 InnoDB 表，才能保证事务回滚。")
            cursor.execute(
                "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'options' "
                "AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION"
            )
            primary_key = [row[0] for row in cursor.fetchall()]
        else:
            cursor.execute(
                "SELECT a.attname FROM pg_index i "
                "JOIN pg_attribute a ON a.attrelid = i.indrelid "
                "AND a.attnum = ANY(i.indkey) "
                "WHERE i.indrelid = 'options'::regclass AND i.indisprimary"
            )
            primary_key = [row[0] for row in cursor.fetchall()]
        if primary_key != ["key"]:
            raise SyncError("B 站 options 表缺少 key 单列主键；请先修复表结构。")


def read_prices(connection, driver: str, lock: bool = False) -> dict[str, str]:
    key_col = '`key`' if driver == "mysql" else '"key"'
    placeholders = ", ".join(["%s"] * len(READ_KEYS))
    query = (
        f"SELECT {key_col}, value FROM options WHERE {key_col} IN ({placeholders}) "
        f"ORDER BY {key_col}"
    )
    if lock:
        query += " FOR UPDATE"
    result = {}
    with closing(connection.cursor()) as cursor:
        cursor.execute(query, READ_KEYS)
        for key, value in cursor.fetchall():
            if key in result:
                raise SyncError(f"options 存在重复配置行：{key}，已停止。")
            if not isinstance(value, str):
                raise SyncError(f"配置 {key} 不是字符串，已停止。")
            result[key] = value
    return result


def unique_json_object(pairs: list) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise SyncError("价格 JSON 存在重复字段，已停止。")
        result[key] = value
    return result


def parse_prices(rows: dict[str, str]) -> dict[str, dict]:
    result = {}
    for key in PRICE_KEYS:
        if key not in rows:
            continue
        try:
            values = json.loads(
                rows[key], parse_float=Decimal, parse_int=Decimal,
                parse_constant=Decimal, object_pairs_hook=unique_json_object,
            )
        except (ValueError, InvalidOperation):
            raise SyncError(f"{key} 不是有效的 JSON。") from None
        if not isinstance(values, dict):
            raise SyncError(f"{key} 必须是 JSON 对象，不能是 null 或数组。")
        for name, value in values.items():
            if not name.strip():
                raise SyncError(f"{key} 包含空模型名。")
            if key == "billing_setting.billing_mode":
                valid = isinstance(value, str) and value in ("ratio", "tiered_expr")
            elif key.startswith("billing_setting."):
                valid = isinstance(value, str) and bool(value.strip())
            else:
                valid = (
                    isinstance(value, Decimal) and value.is_finite()
                    and value >= 0 and math.isfinite(float(value))
                )
            if not valid:
                raise SyncError(f"{key} 中 {name!r} 的值类型或范围无效。")
        result[key] = values
    return result


def sync_prices(apply: bool, backup_dir: Path):
    if SOURCE_DB == TARGET_DB:
        raise SyncError("A、B 数据库配置相同，已停止。")
    with ExitStack() as stack:
        source = stack.enter_context(closing(connect_database(SOURCE_DB, "A 站")))
        target = stack.enter_context(closing(connect_database(TARGET_DB, "B 站")))
        driver = TARGET_DB["driver"]
        check_target_schema(target, driver)
        source_rows = read_prices(source, SOURCE_DB["driver"])
        target_rows = read_prices(target, driver)
        source_maps = parse_prices(source_rows)
        target_maps = parse_prices(target_rows)
        if not source_maps:
            raise SyncError("A 站没有已落库的模型价格；请先在 A 站后台保存定价。")
        for key in PRICE_KEYS:
            if key not in source_maps and key in target_maps:
                raise SyncError(
                    f"A 站缺少 {key}，B 站存在此项。请先在 A 站后台保存模型定价，"
                    "将默认配置落库后重试；不能用空对象替代内置默认值。"
                )
        try:
            source_quota = Decimal(source_rows.get("QuotaPerUnit", "500000"))
            target_quota = Decimal(target_rows.get("QuotaPerUnit", "500000"))
        except InvalidOperation:
            raise SyncError("QuotaPerUnit 不是有效数字。") from None
        if not all(v.is_finite() and v > 0 for v in (source_quota, target_quota)):
            raise SyncError("QuotaPerUnit 必须是有限正数。")
        if source_quota != target_quota:
            raise SyncError("两站 QuotaPerUnit 不同，复制旧倍率不能保证基础价格一致。")

        changed = []
        print("方向：SOURCE_DB（A 站）→ TARGET_DB（B 站），完整替换基础定价映射。")
        for key in PRICE_KEYS:
            if key not in source_maps or source_maps[key] == target_maps.get(key):
                continue
            changed.append(key)
            before = target_maps.get(key, {})
            after = source_maps[key]
            print(f"\n[{key}]" + ("（B 站原先继承内置默认值）" if key not in target_maps else ""))
            for name in sorted(before.keys() | after.keys()):
                if name in before and name in after and before[name] == after[name]:
                    continue
                old = repr(before[name]) if name in before else "未配置（继承默认值）"
                new = repr(after[name]) if name in after else "移除覆盖（继承默认值）"
                print(f"  {name!r}: {old} -> {new}")
        if not changed:
            print("数据库中的基础定价配置一致，无需写入。")
            return
        print(f"\n共 {len(changed)} 项配置变化。")
        if not apply:
            print("仅预览，未写入数据库。确认后添加 --apply 执行。")
            return

        # 在锁定后重读整个价格集合，避免覆盖预览期间他人提交的修改。
        with closing(target.cursor()) as cursor:
            if driver == "mysql":
                cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                cursor.execute("START TRANSACTION")
            else:
                cursor.execute("BEGIN ISOLATION LEVEL SERIALIZABLE")
                cursor.execute("SET LOCAL lock_timeout = '15s'")
                cursor.execute("SET LOCAL statement_timeout = '30s'")
        committed = False
        try:
            if read_prices(target, driver, lock=True) != target_rows:
                raise SyncError("B 站价格在预览后发生变化，请重新执行预览。")
            if read_prices(source, SOURCE_DB["driver"]) != source_rows:
                raise SyncError("A 站价格在预览后发生变化，请重新执行预览。")
            backup_dir = backup_dir.expanduser().resolve()
            backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
            backup_path = backup_dir / f"prices-{timestamp}.json"
            backup = {
                "format": 1, "created_at": timestamp,
                "direction": "SOURCE_DB -> TARGET_DB",
                "target": {
                    key: TARGET_DB[key]
                    for key in ("driver", "host", "port", "database")
                },
                "changed_keys": changed,
                "before": {key: target_rows.get(key) for key in PRICE_KEYS},
                "after": {key: source_rows.get(key) for key in PRICE_KEYS},
                "quota_per_unit": str(target_quota),
                "note": "null 表示原配置行不存在；恢复此状态需删除行并重启服务以清除内存旧值",
            }
            fd = os.open(backup_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as output:
                json.dump(backup, output, ensure_ascii=False, indent=2, allow_nan=False)
                output.write("\n")
                output.flush()
                os.fsync(output.fileno())
            print(f"已保存写入前备份：{backup_path}", flush=True)
            key_col = '`key`' if driver == "mysql" else '"key"'
            with closing(target.cursor()) as cursor:
                for key in changed:
                    if key in target_rows:
                        cursor.execute(
                            f"UPDATE options SET value = %s "
                            f"WHERE {key_col} = %s", (source_rows[key], key),
                        )
                    else:
                        cursor.execute(
                            f"INSERT INTO options ({key_col}, value) "
                            "VALUES (%s, %s)", (key, source_rows[key]),
                        )
            expected = dict(target_rows)
            expected.update({key: source_rows[key] for key in changed})
            if read_prices(target, driver) != expected:
                raise SyncError("事务内回读不一致，取消提交。")
            target.commit()
            committed = True
        finally:
            if not committed:
                target.rollback()
        if read_prices(target, driver) != expected:
            raise SyncError("提交后的数据库回读不一致，请检查并发修改；写入前备份已保留。")
        print("同步已提交，数据库回读验证一致。请等待各实例配置刷新（默认约 60 秒）。")
        print("此结果不代表服务内存已刷新；已开始的请求或任务可能继续使用原定价快照。")


def main() -> int:
    # Windows 重定向输出时也保持中文和模型名可读。
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--apply", action="store_true", help="备份后向 B 站写入；默认只读预览")
    parser.add_argument("--backup-dir", type=Path, default=BACKUP_DIR, help="写入前备份保存目录")
    args = parser.parse_args()
    try:
        sync_prices(args.apply, args.backup_dir)
    except SyncError as exc:
        print(f"停止：{exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("操作中断。若已开始提交，请先检查目标数据库和备份再重试。", file=sys.stderr)
        return 130
    except Exception as exc:
        # 数据库异常可能包含连接信息，不打印原异常或 traceback。
        print(
            f"操作失败（{type(exc).__name__}）。请检查数据库配置、依赖、权限和连接状态。"
            "若提交期间连接断开，结果可能不确定，请先预览并核对备份再重试。",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
