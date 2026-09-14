#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按个人和月份生成 AI 中转站用量总览。

通过 users.username 精确匹配用户，统计与计费口径复用
secondary_department_stats.py 的 logs 逐条汇总逻辑。

用法：
    python personal_monthly_stats.py zhangsan 6 --year 2027
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psycopg2

if __package__:
    from . import secondary_department_stats as stats
else:
    import secondary_department_stats as stats


@dataclass(frozen=True)
class ReportUser:
    id: int
    username: str
    display_name: str
    job_title: str
    department_name: str
    created_at: int
    last_login_at: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="按 users.username 统计个人指定月份的用量",
    )
    parser.add_argument(
        "username",
        help="用户名（精确匹配）",
    )
    parser.add_argument(
        "month",
        type=int,
        choices=range(1, 13),
        metavar="MONTH",
        help="统计月份，取值 1～12",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=stats.DEFAULT_REPORT_YEAR,
        help=f"统计年份，默认 {stats.DEFAULT_REPORT_YEAR}",
    )
    return parser.parse_args()


def fetch_report_user(conn: Any, username: str) -> ReportUser:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, username, display_name, job_title, department_name,
                   created_at, last_login_at
            FROM users
            WHERE username = %s
            """,
            (username,),
        )
        row = cur.fetchone()

    if row is None:
        raise SystemExit(f"未找到用户名：{username}")

    return ReportUser(
        id=int(row[0]),
        username=str(row[1] or ""),
        display_name=str(row[2] or ""),
        job_title=str(row[3] or ""),
        department_name=str(row[4] or ""),
        created_at=int(row[5] or 0),
        last_login_at=int(row[6] or 0),
    )


def format_token_amount(tokens: int) -> str:
    return f"{tokens / stats.TOKENS_PER_HUNDRED_MILLION:.2f} 亿"


def format_login_time(timestamp: int) -> str:
    if timestamp <= 0:
        return "从未登录"
    return datetime.fromtimestamp(timestamp, stats.CHINA_TIMEZONE).strftime(
        "%Y-%m-%d %H:%M:%S"
    )


def main() -> int:
    args = parse_args()
    username = args.username.strip()
    if not username:
        raise SystemExit("用户名不能为空。")

    start, end = stats.resolve_period(args.year, args.month)
    start_ts = int(start.timestamp())
    end_ts = int(end.timestamp())

    conn = psycopg2.connect(stats.DEFAULT_DSN)
    try:
        user = fetch_report_user(conn, username)
        if user.created_at > end_ts:
            raise SystemExit(
                f"用户 {user.username} 在统计周期结束后注册，本月无可统计数据。"
            )

        options = stats.load_options(conn)
        exchange_rate = stats.get_positive_option(
            options,
            ("Price", "USDExchangeRate", "usd_exchange_rate", "price"),
            stats.DEFAULT_USD_TO_CNY_RATE,
        )
        quota_per_unit = stats.get_positive_option(
            options,
            ("QuotaPerUnit", "quota_per_unit"),
            stats.DEFAULT_QUOTA_PER_UNIT,
        )
        model_stats, total_quota, fallback_rows = stats.collect_statistics(
            conn,
            start_ts,
            end_ts,
            user_ids=[user.id],
        )
        stats.apply_quota_costs(model_stats, quota_per_unit, exchange_rate)
        if sum(item.quota for item in model_stats) != total_quota:
            raise RuntimeError("模型汇总 quota 与日志总 quota 不一致")
    finally:
        conn.close()

    if fallback_rows:
        print(
            f"提示：{fallback_rows:,} 条日志因历史计费快照不完整或表达式无法线性拆分，"
            "已按该条日志的四类 Token 占比分配最终 quota。",
            file=sys.stderr,
        )

    input_tokens = sum(item.input_tokens for item in model_stats)
    output_tokens = sum(item.output_tokens for item in model_stats)
    cache_input_tokens = sum(item.cache_input_tokens for item in model_stats)
    cache_output_tokens = sum(item.cache_output_tokens for item in model_stats)
    input_cost = sum(item.input_cost_cny for item in model_stats)
    output_cost = sum(item.output_cost_cny for item in model_stats)
    cache_input_cost = sum(item.cache_input_cost_cny for item in model_stats)
    cache_output_cost = sum(item.cache_output_cost_cny for item in model_stats)
    total_tokens = (
        input_tokens + output_tokens + cache_input_tokens + cache_output_tokens
    )
    total_cost = input_cost + output_cost + cache_input_cost + cache_output_cost
    total_input_tokens = input_tokens + cache_input_tokens + cache_output_tokens
    total_output_tokens = output_tokens
    input_output_ratio = (
        total_input_tokens / total_output_tokens if total_output_tokens else 0.0
    )
    cache_hit_rate = (
        cache_input_tokens / total_input_tokens * 100 if total_input_tokens else 0.0
    )

    print(f"""Hi 各位领导：
AI 中转站 {args.year} 年 {args.month} 月个人统计
统计用户：{user.display_name or user.username}（ID：{user.id}）
岗位职级：{user.job_title or '-'}
所属部门：{user.department_name or '-'}
最后登录：{format_login_time(user.last_login_at)}
统计周期：{start.strftime('%Y-%m-%d %H:%M:%S')} － {end.strftime('%Y-%m-%d %H:%M')}

非缓存输入，Token 量 {format_token_amount(input_tokens)}，费用 {stats.format_cost(input_cost)} 元，单价 {stats.unit_price(input_cost, input_tokens):.2f} 元
非缓存输出，Token 量 {format_token_amount(output_tokens)}，费用 {stats.format_cost(output_cost)} 元，单价 {stats.unit_price(output_cost, output_tokens):.2f} 元
缓存输入，Token 量 {format_token_amount(cache_input_tokens)}，费用 {stats.format_cost(cache_input_cost)} 元，单价 {stats.unit_price(cache_input_cost, cache_input_tokens):.2f} 元
缓存输出，Token 量 {format_token_amount(cache_output_tokens)}，费用 {stats.format_cost(cache_output_cost)} 元，单价 {stats.unit_price(cache_output_cost, cache_output_tokens):.2f} 元

Token 总量 {format_token_amount(total_tokens)}，总费用 {stats.format_cost(total_cost)} 元，均价 {stats.unit_price(total_cost, total_tokens):.2f} 元
输入输出倍数：{input_output_ratio:.1f} 倍，综合缓存命中率：{cache_hit_rate:.1f}%

Top 5 最常用模型：""")
    top_models = sorted(
        model_stats,
        key=lambda item: item.total_tokens,
        reverse=True,
    )[:5]
    if not top_models:
        print("无")
    for index, item in enumerate(top_models, start=1):
        print(
            f"{index}. {item.name}，费用 {stats.format_cost(item.quota_cost_cny)} 元，"
            f"Token 量 {format_token_amount(item.total_tokens)}，"
            f"单价 {stats.unit_price(item.quota_cost_cny, item.total_tokens):.2f} 元"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
