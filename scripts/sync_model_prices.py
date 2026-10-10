#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 A 站的模型基础定价和模型广场推荐单向同步到 B 站（Python 3.10+）。

源数据库读取 SQL_DSN，目标数据库读取 TARGET_SQL_DSN。
自动加载仓库根目录 .env，已有环境变量优先；两站应使用相同代码及任务插件版本。
    python scripts/sync_model_prices.py          # 只读预览
    python scripts/sync_model_prices.py --apply  # 备份后执行

MySQL:      python -m pip install PyMySQL
PostgreSQL: python -m pip install "psycopg[binary]"
加载 .env:  python -m pip install python-dotenv
PostgreSQL DSN: postgresql://user:password@host:5432/dbname?sslmode=require
MySQL DSN: user:password@tcp(host:3306)/dbname?parseTime=true&charset=utf8mb4
MySQL 支持 tcp 连接；未支持的 DSN 参数会明确报错，不会静默忽略。

同步完整价格映射：B 站独有的模型价格覆盖项也会被移除，回退到程序默认值。
推荐配置完整覆盖，包括总开关、模型列表及顺序、场景、理由和各项启用状态。
A 站未保存推荐配置时，按应用默认值关闭推荐并清空 B 站推荐列表。
仅同步推荐配置，不创建模型或渠道；目标站不可用的模型不会展示为推荐。
不修改分组倍率、工具附加费、用户、渠道、余额或日志。QuotaPerUnit 只比较不修改。
缺失的数据库行不等于空映射：若 A 缺失而 B 存在，先在 A 后台保存模型定价，
让应用将内置默认值落库后重试；脚本不会猜测内置默认值或删除整个配置行。
表达式按原文复制，不代替应用的编译和插件兼容性检查；源站价格应已通过后台校验。

执行前暂停两站后台价格和推荐配置编辑。事务提交后各服务实例仍需等待配置刷新
（默认约 60 秒，以 SYNC_FREQUENCY 为准）；数据库验证不代表内存已刷新。
备份保留原始配置字符串及待写入内容，不含数据库密码，不自动删除。
不输出 DSN 或密码，也不将其写入备份。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import ssl
import sys
from contextlib import ExitStack, closing
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit


BACKUP_DIR = Path.home() / ".new-api-pricing-backups"

# 与 model/model_pricing_config.go 的 modelPricingOptionKeys 保持一致。
PRICE_KEYS = (
    "AudioCompletionRatio", "AudioRatio", "CacheRatio", "CompletionRatio",
    "CreateCacheRatio", "ImageRatio", "ModelPrice", "ModelRatio",
    "billing_setting.billing_expr", "billing_setting.billing_mode",
    "billing_setting.plugin_billing_expr",
)
RECOMMENDATION_KEY = "ModelSquareConfig"
SYNC_KEYS = (*PRICE_KEYS, RECOMMENDATION_KEY)
READ_KEYS = (*SYNC_KEYS, "QuotaPerUnit")


class SyncError(Exception):
    """可以直接展示、且不包含连接凭据的操作错误。"""


def database_config(env_name: str) -> dict:
    dsn = os.environ.get(env_name, "").strip()
    if not dsn:
        raise SyncError(f"请在环境变量或仓库根目录 .env 中设置 {env_name}。")
    if dsn.startswith(("postgres://", "postgresql://")):
        try:
            from psycopg.conninfo import conninfo_to_dict
        except ImportError:
            raise SyncError('请先执行：python -m pip install "psycopg[binary]"') from None
        try:
            params = conninfo_to_dict(dsn)
        except Exception:
            raise SyncError(f"{env_name} 不是有效的 PostgreSQL DSN。") from None
        return {
            "driver": "postgres", "dsn": dsn,
            "host": params.get("host", ""), "port": params.get("port", "5432"),
            "database": params.get("dbname", ""),
        }
    # Go MySQL DSN 的密码不做 URL 解码，并且允许包含 @、/、?。
    credentials, separator, address = dsn.rpartition("@tcp(")
    endpoint, closing_separator, database = address.partition(")/")
    if not separator or not closing_separator:
        raise SyncError(
            f"{env_name} 仅支持 PostgreSQL URL 或 user:password@tcp(host:port)/dbname 格式。"
        )
    user, _, password = credentials.partition(":")
    database_name, _, query = database.partition("?")
    if not user or not database_name:
        raise SyncError(f"{env_name} 必须明确指定 MySQL 用户和数据库名。")
    try:
        parsed = urlsplit("//" + endpoint)
        host, port = parsed.hostname, parsed.port or 3306
        if not host or parsed.username or parsed.path or parsed.query or parsed.fragment:
            raise ValueError()
        params = dict(parse_qsl(query, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        raise SyncError(f"{env_name} 的 MySQL 地址或查询参数无效。") from None
    supported = {"charset", "parseTime", "loc", "tls", "timeout", "readTimeout", "writeTimeout"}
    if params.keys() - supported:
        raise SyncError(
            f"{env_name} 含脚本尚不支持的 MySQL DSN 参数；"
            "支持 charset、parseTime、loc、tls、timeout、readTimeout、writeTimeout。"
        )
    kwargs = {
        "host": host, "port": port, "database": unquote(database_name),
        "user": user, "password": password, "charset": params.get("charset", "utf8mb4"),
        "connect_timeout": 15, "read_timeout": 30, "write_timeout": 30,
    }
    # 本脚本只读写字符串，Go 驱动的日期解析与时区选项不参与此操作。
    for key, argument in (
        ("timeout", "connect_timeout"), ("readTimeout", "read_timeout"),
        ("writeTimeout", "write_timeout"),
    ):
        if key not in params:
            continue
        match = re.fullmatch(r"(\d+(?:\.\d+)?)(ms|s|m)", params[key])
        if not match:
            raise SyncError(f"{env_name} 的 {key} 需为正数加 ms、s 或 m。")
        seconds = float(match[1]) * {"ms": 0.001, "s": 1, "m": 60}[match[2]]
        if (
            not math.isfinite(seconds) or seconds <= 0
            or (key == "timeout" and seconds > 31536000)
        ):
            raise SyncError(f"{env_name} 的 {key} 超出驱动支持范围。")
        kwargs[argument] = seconds
    tls = params.get("tls", "false").lower()
    if tls == "true":
        kwargs["ssl"] = ssl.create_default_context()
    elif tls == "skip-verify":
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        kwargs["ssl"] = context
    elif tls != "false":
        raise SyncError(f"{env_name} 的 tls 仅支持 true、false、skip-verify。")
    return {
        "driver": "mysql", "dsn": dsn, "host": host, "port": port,
        "database": kwargs["database"], "kwargs": kwargs,
    }


def connect_database(config: dict):
    if config["driver"] == "mysql":
        try:
            import pymysql
        except ImportError:
            raise SyncError("请先执行：python -m pip install PyMySQL") from None
        return pymysql.connect(**config["kwargs"], autocommit=True)
    try:
        import psycopg
    except ImportError:
        raise SyncError('请先执行：python -m pip install "psycopg[binary]"') from None
    return psycopg.connect(
        config["dsn"], connect_timeout=15, autocommit=True, prepare_threshold=None,
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
            raise SyncError("配置 JSON 存在重复字段，已停止。")
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


def parse_recommendations(raw: str | None) -> dict:
    """检查推荐配置结构，保留原始顺序和文案；缺失行采用应用默认值。"""
    if raw is None:
        return {"enabled": False, "recommendations": []}
    if len(raw.encode("utf-8")) > 256 * 1024:
        raise SyncError("ModelSquareConfig 超过 256 KiB。")
    try:
        config = json.loads(raw, object_pairs_hook=unique_json_object)
    except ValueError:
        raise SyncError("ModelSquareConfig 不是有效的 JSON。") from None
    if not isinstance(config, dict) or type(config.get("enabled")) is not bool:
        raise SyncError("ModelSquareConfig 必须包含布尔值 enabled。")
    recommendations = config.get("recommendations")
    if not isinstance(recommendations, list) or len(recommendations) > 100:
        raise SyncError("ModelSquareConfig.recommendations 必须是最多 100 项的数组。")
    legacy_scenarios = {
        "general": "General recommendations", "coding": "Coding",
        "chat": "Daily chat", "writing": "Writing", "image": "Image generation",
    }
    names = set()
    for index, item in enumerate(recommendations, start=1):
        if not isinstance(item, dict) or type(item.get("enabled")) is not bool:
            raise SyncError(f"推荐第 {index} 项必须是对象并包含布尔值 enabled。")
        name = item.get("model_name")
        reason = item.get("reason", "")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 128:
            raise SyncError(f"推荐第 {index} 项模型名必须为 1～128 个字符。")
        if name.strip() in names:
            raise SyncError(f"推荐第 {index} 项模型名重复。")
        names.add(name.strip())
        if not isinstance(reason, str) or len(reason.strip()) > 300:
            raise SyncError(f"推荐第 {index} 项理由必须为不超过 300 个字符的字符串。")
        scenarios = item.get("scenarios")
        # 兼容服务端接受的旧版单场景格式。
        if scenarios is None and isinstance(item.get("scenario"), str):
            scenarios = [item["scenario"]]
        if not isinstance(scenarios, list) or len(scenarios) > 10:
            raise SyncError(f"推荐第 {index} 项 scenarios 必须是最多 10 项的数组。")
        seen_scenarios = set()
        for scenario in scenarios:
            if not isinstance(scenario, str):
                raise SyncError(f"推荐第 {index} 项场景必须是字符串。")
            scenario = legacy_scenarios.get(scenario.strip().lower(), scenario.strip())
            if not 1 <= len(scenario) <= 40 or scenario in seen_scenarios:
                raise SyncError(f"推荐第 {index} 项场景为空、超过 40 个字符或重复。")
            seen_scenarios.add(scenario)
    return config


def sync_prices(apply: bool, backup_dir: Path):
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if env_file.is_file():
        try:
            from dotenv import load_dotenv
        except ImportError:
            raise SyncError("加载 .env 需要先执行：python -m pip install python-dotenv") from None
        load_dotenv(env_file, override=False, interpolate=False, encoding="utf-8-sig")
    source_config = database_config("SQL_DSN")
    target_config = database_config("TARGET_SQL_DSN")
    if source_config["dsn"] == target_config["dsn"] or all(
        str(source_config[key]) == str(target_config[key])
        for key in ("driver", "host", "port", "database")
    ):
        raise SyncError("A、B 数据库配置相同，已停止。")
    with ExitStack() as stack:
        source = stack.enter_context(closing(connect_database(source_config)))
        target = stack.enter_context(closing(connect_database(target_config)))
        driver = target_config["driver"]
        check_target_schema(target, driver)
        source_rows = read_prices(source, source_config["driver"])
        target_rows = read_prices(target, driver)
        source_maps = parse_prices(source_rows)
        target_maps = parse_prices(target_rows)
        source_recommendations = parse_recommendations(source_rows.get(RECOMMENDATION_KEY))
        target_recommendations = parse_recommendations(target_rows.get(RECOMMENDATION_KEY))
        # 保留 source_rows 原始快照用于并发检查；缺失推荐行写入明确默认值，
        # 避免删除数据库行后运行进程仍保留旧的 OptionMap 值。
        desired_rows = dict(source_rows)
        if RECOMMENDATION_KEY not in desired_rows:
            desired_rows[RECOMMENDATION_KEY] = json.dumps(source_recommendations)
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
        print("方向：SQL_DSN（A 站）→ TARGET_SQL_DSN（B 站），完整替换基础定价和模型广场推荐。")
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
        if source_recommendations != target_recommendations:
            changed.append(RECOMMENDATION_KEY)
            print(f"\n[{RECOMMENDATION_KEY}]（推荐配置完整覆盖，数组顺序即推荐顺序）")
            if RECOMMENDATION_KEY not in source_rows:
                print("A 站未配置推荐：将关闭 B 站推荐并清空列表。")
            print("B 站原配置：")
            print(json.dumps(target_recommendations, ensure_ascii=False, indent=2))
            print("同步后配置：")
            print(json.dumps(source_recommendations, ensure_ascii=False, indent=2))
        if not changed:
            print("数据库中的基础定价和推荐配置一致，无需写入。")
            return
        print(f"\n共 {len(changed)} 项配置变化。")
        if not apply:
            print("仅预览，未写入数据库。确认后添加 --apply 执行。")
            return

        # 在锁定后重读价格和推荐配置，避免覆盖预览期间他人提交的修改。
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
                raise SyncError("B 站价格或推荐配置在预览后发生变化，请重新执行预览。")
            if read_prices(source, source_config["driver"]) != source_rows:
                raise SyncError("A 站价格或推荐配置在预览后发生变化，请重新执行预览。")
            backup_dir = backup_dir.expanduser().resolve()
            backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
            backup_path = backup_dir / f"prices-{timestamp}.json"
            backup = {
                "format": 1, "created_at": timestamp,
                "direction": "SQL_DSN -> TARGET_SQL_DSN",
                "target": {
                    key: target_config[key]
                    for key in ("driver", "host", "port", "database")
                },
                "changed_keys": changed,
                "before": {key: target_rows.get(key) for key in SYNC_KEYS},
                "after": {
                    key: desired_rows.get(key) if key in changed else target_rows.get(key)
                    for key in SYNC_KEYS
                },
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
                            f"WHERE {key_col} = %s", (desired_rows[key], key),
                        )
                    else:
                        cursor.execute(
                            f"INSERT INTO options ({key_col}, value) "
                            "VALUES (%s, %s)", (key, desired_rows[key]),
                        )
            expected = dict(target_rows)
            expected.update({key: desired_rows[key] for key in changed})
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
        print("模型广场页面也有查询缓存，配置刷新后请重新加载页面查看价格和推荐。")


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
