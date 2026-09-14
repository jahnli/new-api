#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按二级部门和月份生成 AI 中转站用量汇报。

本文件内置 weekly_stats.py 的逐条历史计费快照、quota 拆分和汇报逻辑，
不依赖项目中的其他 Python 文件。数据库连接固定在本文件内。

用法：
    python secondary_department_stats.py 自动化物流第一事业部 6
    python secondary_department_stats.py 自动化物流第一事业部 6 --year 2027
"""

from __future__ import annotations

import argparse
import ast
import base64
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_FLOOR
from typing import Any

import psycopg2


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


DEFAULT_DSN = "postgresql://admin:semitech@10.16.7.77:5432/ai-gateway"
DEFAULT_USD_TO_CNY_RATE = 6.8
DEFAULT_QUOTA_PER_UNIT = 500_000.0
TOKENS_PER_MILLION = 1_000_000.0
TOKENS_PER_HUNDRED_MILLION = 100_000_000.0
CONSUME_LOG_TYPE = 2
ALLOCATION_BUCKETS = ("input", "output", "cache_input", "cache_output")
DEFAULT_REPORT_YEAR = 2026
CHINA_TIMEZONE = timezone(timedelta(hours=8))
DEPARTMENT_SQL = "BTRIM(SPLIT_PART(department_name, '/', 2)) = %s"

ModelMapping = tuple[str, list[str]]
BUILTIN_MODEL_MAPPING: list[ModelMapping] = [
    ("Kimi-K2.5", ["kimi-k2.5"]),
    ("Kimi-K2.6", ["kimi-k2.6"]),
    ("Kimi-K2.7", ["kimi-k2.7-code"]),
    ("Qwen3-Reranker-8B", ["Qwen3-Reranker-8B"]),
    ("Qwen3-Embedding-8B", ["Qwen3-Embedding-8B"]),
    ("Claude Haiku 4.5", ["claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-haiku-4.5"]),
    ("Claude Sonnet 5", ["claude-sonnet-5"]),
    ("Claude Sonnet 4.6", ["claude-sonnet-4-6", "claude-sonnet-4.6", "anthropic/claude-sonnet-4.6"]),
    ("Claude Opus 4.6", ["claude-opus-4-6", "claude-opus-4.6", "anthropic/claude-opus-4.6"]),
    ("Claude Opus 4.7", ["claude-opus-4-7", "claude-opus-4.7", "anthropic/claude-opus-4.7"]),
    ("Claude Opus 4.8", ["claude-opus-4-8", "claude-opus-4.8", "anthropic/claude-opus-4.8"]),
    ("Deepseek-v4-flash", ["deepseek-v4-flash"]),
    ("Deepseek-v4-pro", ["deepseek-v4-pro"]),
    ("GLM-4.7", ["glm-4.7"]),
    ("GLM-5", ["glm-5"]),
    ("GLM-5-Turbo", ["glm-5-turbo"]),
    ("GLM-5.1", ["glm-5.1"]),
    ("GLM-5.2", ["glm-5.2"]),
    ("GPT-5.4-mini", ["gpt-5.4-mini"]),
    ("GPT-5.4", ["gpt-5.4"]),
    ("GPT-5.5", ["gpt-5.5"]),
    ("GPT-5.6-luna", ["gpt-5.6-luna"]),
    ("GPT-5.6-terra", ["gpt-5.6-terra"]),
    ("GPT-5.6-sol", ["gpt-5.6-sol"]),
    ("Codex Auto Review", ["codex-auto-review"]),
]

MODEL_LOOKUP = {
    name.strip().lower(): mapping[0]
    for mapping in BUILTIN_MODEL_MAPPING
    for name in (mapping[0], *mapping[1])
}


@dataclass
class ModelStats:
    name: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_input_tokens: int = 0
    cache_output_tokens: int = 0
    quota: int = 0
    input_quota: int = 0
    output_quota: int = 0
    cache_input_quota: int = 0
    cache_output_quota: int = 0
    quota_cost_cny: float = 0.0
    input_cost_cny: float = 0.0
    output_cost_cny: float = 0.0
    cache_input_cost_cny: float = 0.0
    cache_output_cost_cny: float = 0.0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens + self.cache_input_tokens + self.cache_output_tokens


def normalize_model_name(value: Any) -> str:
    return str(value or "").strip().lower()


@dataclass
class TokenCategories:
    prompt: int
    input: int
    output: int
    cache_input: int
    cache_output: int
    cache_creation: int
    cache_creation_5m: int
    cache_creation_1h: int
    anthropic_semantic: bool


def parse_log_other(raw_other: Any) -> tuple[dict[str, Any], bool]:
    if isinstance(raw_other, dict):
        return raw_other, False
    if raw_other in (None, ""):
        return {}, False
    try:
        parsed = json.loads(
            str(raw_other),
            parse_float=Decimal,
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
        )
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}, True
    return (parsed, False) if isinstance(parsed, dict) else ({}, True)


def decimal_field(data: dict[str, Any], key: str) -> Decimal | None:
    value = data.get(key)
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed.is_finite() and parsed >= 0 else None


def nonnegative_int(value: Any) -> int:
    if value is None or isinstance(value, bool):
        return 0
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return 0
    if not parsed.is_finite() or parsed < 0 or parsed != parsed.to_integral_value():
        return 0
    return int(parsed)


def first_token_count(data: dict[str, Any], *keys: str) -> int:
    for key in keys:
        if key in data:
            return nonnegative_int(data[key])
    return 0


def extract_token_categories(prompt_tokens: Any, completion_tokens: Any, other: dict[str, Any]) -> TokenCategories:
    prompt = nonnegative_int(prompt_tokens)
    completion = nonnegative_int(completion_tokens)
    cache_input = first_token_count(other, "cache_tokens")
    cache_write = first_token_count(other, "cache_write_tokens")
    cache_creation = first_token_count(other, "cache_creation_tokens")
    cache_creation_5m = first_token_count(other, "cache_creation_tokens_5m")
    cache_creation_1h = first_token_count(other, "cache_creation_tokens_1h")
    cache_output = max(
        cache_write,
        cache_creation,
        cache_creation_5m + cache_creation_1h,
    )

    semantic = str(other.get("usage_semantic") or "").strip().lower()
    anthropic_semantic = semantic == "anthropic"
    if not semantic and other.get("claude") is True and (cache_creation_5m or cache_creation_1h):
        anthropic_semantic = True

    input_tokens = prompt
    if not anthropic_semantic:
        input_tokens = max(prompt - cache_input - cache_output, 0)
    return TokenCategories(
        prompt=prompt,
        input=input_tokens,
        output=completion,
        cache_input=cache_input,
        cache_output=cache_output,
        cache_creation=cache_creation,
        cache_creation_5m=cache_creation_5m,
        cache_creation_1h=cache_creation_1h,
        anthropic_semantic=anthropic_semantic,
    )


def add_logged_surcharges(weights: dict[str, Decimal], other: dict[str, Any]) -> None:
    for count_key, price_key in (
        ("web_search_call_count", "web_search_price"),
        ("file_search_call_count", "file_search_price"),
    ):
        count = nonnegative_int(other.get(count_key))
        price = decimal_field(other, price_key)
        if count and price is not None:
            weights["input"] += Decimal(count) * price * Decimal(1000)

    image_generation_price = decimal_field(other, "image_generation_call_price")
    if image_generation_price is not None:
        weights["output"] += image_generation_price * Decimal(1_000_000)

    if other.get("audio_input_seperate_price") is True:
        audio_input_price = decimal_field(other, "audio_input_price")
        if audio_input_price is not None:
            weights["input"] += audio_input_price * Decimal(1_000_000)


def standard_cost_weights(other: dict[str, Any], tokens: TokenCategories) -> dict[str, Decimal] | None:
    weights = {bucket: Decimal(0) for bucket in ALLOCATION_BUCKETS}
    model_price = decimal_field(other, "model_price")
    if model_price is not None and model_price > 0:
        weights["input"] = model_price * Decimal(1_000_000)
        add_logged_surcharges(weights, other)
        return weights

    model_ratio = decimal_field(other, "model_ratio")
    if model_ratio is None:
        return None
    base_input_price = model_ratio * 2
    completion_ratio = decimal_field(other, "completion_ratio")
    cache_ratio = decimal_field(other, "cache_ratio")
    cache_creation_ratio = decimal_field(other, "cache_creation_ratio")
    cache_creation_ratio_5m = decimal_field(other, "cache_creation_ratio_5m")
    cache_creation_ratio_1h = decimal_field(other, "cache_creation_ratio_1h")

    completion_ratio = Decimal(1) if completion_ratio is None else completion_ratio
    cache_ratio = Decimal(1) if cache_ratio is None else cache_ratio
    cache_creation_ratio = Decimal(1) if cache_creation_ratio is None else cache_creation_ratio
    cache_creation_ratio_5m = cache_creation_ratio if cache_creation_ratio_5m is None else cache_creation_ratio_5m
    cache_creation_ratio_1h = cache_creation_ratio if cache_creation_ratio_1h is None else cache_creation_ratio_1h

    weights["input"] = Decimal(tokens.input) * base_input_price
    weights["output"] = Decimal(tokens.output) * base_input_price * completion_ratio
    weights["cache_input"] = Decimal(tokens.cache_input) * base_input_price * cache_ratio

    split_cache_creation = tokens.cache_creation_5m + tokens.cache_creation_1h
    generic_cache_creation = max(tokens.cache_output - split_cache_creation, 0)
    weights["cache_output"] = base_input_price * (
        Decimal(generic_cache_creation) * cache_creation_ratio
        + Decimal(tokens.cache_creation_5m) * cache_creation_ratio_5m
        + Decimal(tokens.cache_creation_1h) * cache_creation_ratio_1h
    )

    text_input = first_token_count(other, "text_input")
    audio_input = first_token_count(other, "audio_input", "audio_input_token_count")
    text_output = first_token_count(other, "text_output")
    audio_output = first_token_count(other, "audio_output")
    if text_input or audio_input:
        audio_ratio = decimal_field(other, "audio_ratio")
        audio_ratio = Decimal(1) if audio_ratio is None else audio_ratio
        weights["input"] = base_input_price * (
            Decimal(text_input) + Decimal(audio_input) * audio_ratio
        )
    if text_output or audio_output:
        audio_ratio = decimal_field(other, "audio_ratio")
        audio_completion_ratio = decimal_field(other, "audio_completion_ratio")
        audio_ratio = Decimal(1) if audio_ratio is None else audio_ratio
        audio_completion_ratio = Decimal(1) if audio_completion_ratio is None else audio_completion_ratio
        weights["output"] = base_input_price * (
            Decimal(text_output) * completion_ratio
            + Decimal(audio_output) * audio_ratio * audio_completion_ratio
        )

    add_logged_surcharges(weights, other)
    return weights


def extract_tier_cost(expression: str, matched_tier: str) -> str | None:
    matches: list[tuple[str, str]] = []
    cursor = 0
    while True:
        match = re.search(r"\btier\s*\(", expression[cursor:])
        if match is None:
            break
        call_start = cursor + match.end()
        quote_start = call_start
        while quote_start < len(expression) and expression[quote_start].isspace():
            quote_start += 1
        if quote_start >= len(expression) or expression[quote_start] not in ('"', "'"):
            cursor = call_start
            continue
        quote = expression[quote_start]
        quote_end = quote_start + 1
        escaped = False
        while quote_end < len(expression):
            char = expression[quote_end]
            if char == quote and not escaped:
                break
            escaped = char == "\\" and not escaped
            if char != "\\":
                escaped = False
            quote_end += 1
        if quote_end >= len(expression):
            break
        try:
            label = ast.literal_eval(expression[quote_start : quote_end + 1])
        except (SyntaxError, ValueError):
            cursor = quote_end + 1
            continue
        comma = quote_end + 1
        while comma < len(expression) and expression[comma].isspace():
            comma += 1
        if comma >= len(expression) or expression[comma] != ",":
            cursor = comma
            continue

        value_start = comma + 1
        depth = 1
        index = value_start
        string_quote = ""
        escaped = False
        while index < len(expression):
            char = expression[index]
            if string_quote:
                if char == string_quote and not escaped:
                    string_quote = ""
                escaped = char == "\\" and not escaped
                if char != "\\":
                    escaped = False
            elif char in ('"', "'"):
                string_quote = char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    matches.append((str(label), expression[value_start:index].strip()))
                    cursor = index + 1
                    break
            index += 1
        else:
            break

    selected = [cost for label, cost in matches if label == matched_tier]
    if len(selected) == 1:
        return selected[0]
    if not matched_tier and len(matches) == 1:
        return matches[0][1]
    return None


def parse_affine_cost(expression: str) -> tuple[Decimal, dict[str, Decimal]] | None:
    allowed_variables = {"p", "c", "cr", "cc", "cc1h", "img", "img_o", "ai", "ao"}

    def evaluate(node: ast.AST) -> tuple[Decimal, dict[str, Decimal]]:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return Decimal(str(node.value)), {}
        if isinstance(node, ast.Name) and node.id in allowed_variables:
            return Decimal(0), {node.id: Decimal(1)}
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            constant, coefficients = evaluate(node.operand)
            factor = Decimal(-1) if isinstance(node.op, ast.USub) else Decimal(1)
            return constant * factor, {key: value * factor for key, value in coefficients.items()}
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub)):
            left_constant, left_coefficients = evaluate(node.left)
            right_constant, right_coefficients = evaluate(node.right)
            factor = Decimal(-1) if isinstance(node.op, ast.Sub) else Decimal(1)
            coefficients = dict(left_coefficients)
            for key, value in right_coefficients.items():
                coefficients[key] = coefficients.get(key, Decimal(0)) + value * factor
            return left_constant + right_constant * factor, coefficients
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult):
            left_constant, left_coefficients = evaluate(node.left)
            right_constant, right_coefficients = evaluate(node.right)
            if left_coefficients and right_coefficients:
                raise ValueError("non-affine multiplication")
            if left_coefficients:
                return left_constant * right_constant, {
                    key: value * right_constant for key, value in left_coefficients.items()
                }
            if right_coefficients:
                return right_constant * left_constant, {
                    key: value * left_constant for key, value in right_coefficients.items()
                }
            return left_constant * right_constant, {}
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
            numerator_constant, numerator_coefficients = evaluate(node.left)
            denominator_constant, denominator_coefficients = evaluate(node.right)
            if denominator_coefficients or denominator_constant == 0:
                raise ValueError("non-affine division")
            return numerator_constant / denominator_constant, {
                key: value / denominator_constant for key, value in numerator_coefficients.items()
            }
        raise ValueError("unsupported expression")

    try:
        parsed = ast.parse(expression, mode="eval")
        constant, coefficients = evaluate(parsed.body)
    except (SyntaxError, ValueError, InvalidOperation, ZeroDivisionError):
        return None
    if constant < 0 or any(value < 0 for value in coefficients.values()):
        return None
    return constant, coefficients


def tiered_cost_weights(other: dict[str, Any], tokens: TokenCategories) -> dict[str, Decimal] | None:
    encoded_expression = str(other.get("expr_b64") or "").strip()
    if not encoded_expression:
        return None
    try:
        expression = base64.b64decode(encoded_expression, validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None
    billing_expression = expression.split("|||", 1)[0]
    billing_expression = re.sub(r"^v\d+:", "", billing_expression.strip(), count=1)
    matched_tier = str(other.get("matched_tier") or "")
    tier_cost = extract_tier_cost(billing_expression, matched_tier)
    if tier_cost is None:
        return None
    affine = parse_affine_cost(tier_cost)
    if affine is None:
        return None
    constant, coefficients = affine
    used_variables = set(re.findall(r"\b(?:p|c|cr|cc|cc1h|img|img_o|ai|ao)\b", billing_expression))

    cache_creation_1h = tokens.cache_creation_1h
    cache_creation = tokens.cache_creation_5m
    if cache_creation == 0:
        cache_creation = max(tokens.cache_output - cache_creation_1h, 0)
    image_input = first_token_count(other, "image_input", "image_input_tokens")
    image_output = first_token_count(other, "image_output", "image_output_tokens")
    audio_input = first_token_count(other, "audio_input", "audio_input_token_count")
    audio_output = first_token_count(other, "audio_output", "audio_output_token_count")

    prompt = tokens.prompt
    completion = tokens.output
    normalized_prompt = prompt
    normalized_completion = completion
    if not tokens.anthropic_semantic:
        if "cr" in used_variables:
            normalized_prompt -= tokens.cache_input
        if "cc" in used_variables:
            normalized_prompt -= cache_creation
        if "cc1h" in used_variables:
            normalized_prompt -= cache_creation_1h
        if "img" in used_variables:
            normalized_prompt -= image_input
        if "ai" in used_variables:
            normalized_prompt -= audio_input
        if "img_o" in used_variables:
            normalized_completion -= image_output
        if "ao" in used_variables:
            normalized_completion -= audio_output
    normalized_prompt = max(normalized_prompt, 0)
    normalized_completion = max(normalized_completion, 0)

    input_prompt_tokens = normalized_prompt
    implicit_cache_input = 0
    implicit_cache_output = 0
    if not tokens.anthropic_semantic:
        if "cr" not in used_variables:
            implicit_cache_input = min(tokens.cache_input, input_prompt_tokens)
            input_prompt_tokens -= implicit_cache_input
        implicit_write_tokens = 0
        if "cc" not in used_variables:
            implicit_write_tokens += cache_creation
        if "cc1h" not in used_variables:
            implicit_write_tokens += cache_creation_1h
        implicit_cache_output = min(implicit_write_tokens, input_prompt_tokens)
        input_prompt_tokens -= implicit_cache_output

    p_coefficient = coefficients.get("p", Decimal(0))
    weights = {bucket: Decimal(0) for bucket in ALLOCATION_BUCKETS}
    weights["input"] = constant + p_coefficient * Decimal(input_prompt_tokens)
    weights["input"] += coefficients.get("img", Decimal(0)) * Decimal(image_input)
    weights["input"] += coefficients.get("ai", Decimal(0)) * Decimal(audio_input)
    weights["output"] = coefficients.get("c", Decimal(0)) * Decimal(normalized_completion)
    weights["output"] += coefficients.get("img_o", Decimal(0)) * Decimal(image_output)
    weights["output"] += coefficients.get("ao", Decimal(0)) * Decimal(audio_output)
    weights["cache_input"] = coefficients.get("cr", Decimal(0)) * Decimal(tokens.cache_input)
    weights["cache_input"] += p_coefficient * Decimal(implicit_cache_input)
    weights["cache_output"] = coefficients.get("cc", Decimal(0)) * Decimal(cache_creation)
    weights["cache_output"] += coefficients.get("cc1h", Decimal(0)) * Decimal(cache_creation_1h)
    weights["cache_output"] += p_coefficient * Decimal(implicit_cache_output)
    add_logged_surcharges(weights, other)
    return weights


def token_fallback_weights(tokens: TokenCategories) -> dict[str, Decimal]:
    return {
        "input": Decimal(tokens.input),
        "output": Decimal(tokens.output),
        "cache_input": Decimal(tokens.cache_input),
        "cache_output": Decimal(tokens.cache_output),
    }


def allocate_quota(quota: int, weights: dict[str, Decimal]) -> dict[str, int]:
    sign = -1 if quota < 0 else 1
    target = abs(quota)
    clean_weights = {
        bucket: weight if weight.is_finite() and weight >= 0 else Decimal(0)
        for bucket, weight in weights.items()
    }
    total_weight = sum(clean_weights.values(), Decimal(0))
    if target == 0:
        return {bucket: 0 for bucket in ALLOCATION_BUCKETS}
    if total_weight == 0:
        return {"input": quota, "output": 0, "cache_input": 0, "cache_output": 0}

    exact = {
        bucket: Decimal(target) * clean_weights[bucket] / total_weight
        for bucket in ALLOCATION_BUCKETS
    }
    allocated = {
        bucket: int(exact[bucket].to_integral_value(rounding=ROUND_FLOOR))
        for bucket in ALLOCATION_BUCKETS
    }
    remainder = target - sum(allocated.values())
    order = sorted(
        ALLOCATION_BUCKETS,
        key=lambda bucket: (
            -(exact[bucket] - Decimal(allocated[bucket])),
            ALLOCATION_BUCKETS.index(bucket),
        ),
    )
    for bucket in order[:remainder]:
        allocated[bucket] += 1
    return {bucket: sign * allocated[bucket] for bucket in ALLOCATION_BUCKETS}


def collect_statistics(
    conn: Any,
    start_ts: int,
    end_ts: int,
    user_ids: list[int] | None = None,
) -> tuple[list[ModelStats], int, int]:
    statistics: dict[str, ModelStats] = {}
    total_quota = 0
    fallback_rows = 0
    with conn.cursor(name="weekly_report_log_rows") as cur:
        cur.itersize = 2_000
        user_filter = ""
        params: tuple[Any, ...] = (CONSUME_LOG_TYPE, start_ts, end_ts)
        if user_ids is not None:
            user_filter = " AND user_id = ANY(%s::bigint[])"
            params += (user_ids,)
        cur.execute(
            f"""
            SELECT id, model_name, prompt_tokens, completion_tokens, quota, other
            FROM logs
            WHERE type = %s AND created_at >= %s AND created_at <= %s
            {user_filter}
            """,
            params,
        )
        for _log_id, model_name, prompt_tokens, completion_tokens, quota_value, raw_other in cur:
            quota = int(quota_value or 0)
            other, malformed_other = parse_log_other(raw_other)
            tokens = extract_token_categories(prompt_tokens, completion_tokens, other)

            is_tiered = str(other.get("billing_mode") or "").strip().lower() == "tiered_expr"
            weights = tiered_cost_weights(other, tokens) if is_tiered else standard_cost_weights(other, tokens)
            used_fallback = malformed_other or weights is None
            if weights is None or (quota != 0 and sum(weights.values(), Decimal(0)) == 0):
                weights = token_fallback_weights(tokens)
                used_fallback = True
            if used_fallback:
                fallback_rows += 1
            allocation = allocate_quota(quota, weights)

            normalized_model = normalize_model_name(model_name)
            category = MODEL_LOOKUP.get(normalized_model)
            if category is None:
                category = str(model_name or "未标注模型").strip() or "未标注模型"
            stat = statistics.setdefault(category, ModelStats(category))
            stat.input_tokens += tokens.input
            stat.output_tokens += tokens.output
            stat.cache_input_tokens += tokens.cache_input
            stat.cache_output_tokens += tokens.cache_output
            stat.quota += quota
            stat.input_quota += allocation["input"]
            stat.output_quota += allocation["output"]
            stat.cache_input_quota += allocation["cache_input"]
            stat.cache_output_quota += allocation["cache_output"]
            total_quota += quota

    for stat in statistics.values():
        allocated_quota = (
            stat.input_quota
            + stat.output_quota
            + stat.cache_input_quota
            + stat.cache_output_quota
        )
        if allocated_quota != stat.quota:
            raise RuntimeError(f"模型 {stat.name} 的四类费用拆分未与日志 quota 对齐")

    model_order = {mapping[0]: index for index, mapping in enumerate(BUILTIN_MODEL_MAPPING)}
    result = sorted(
        statistics.values(),
        key=lambda stat: (model_order.get(stat.name, len(model_order)), stat.name.lower()),
    )
    return result, total_quota, fallback_rows


def load_options(conn: Any) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute('SELECT "key", value FROM options')
        return {str(key): value for key, value in cur.fetchall() if value is not None}


def get_positive_option(options: dict[str, Any], keys: tuple[str, ...], default: float) -> float:
    for key in keys:
        try:
            value = float(options[key])
            if value > 0:
                return value
        except (KeyError, TypeError, ValueError):
            continue
    return default


def apply_quota_costs(
    stats: list[ModelStats],
    quota_per_unit: float,
    exchange_rate: float,
) -> None:
    """把逐条日志拆分后的 quota 按周报口径换算为人民币费用。"""
    for stat in stats:
        stat.quota_cost_cny = stat.quota / quota_per_unit * exchange_rate
        stat.input_cost_cny = stat.input_quota / quota_per_unit * exchange_rate
        stat.output_cost_cny = stat.output_quota / quota_per_unit * exchange_rate
        stat.cache_input_cost_cny = stat.cache_input_quota / quota_per_unit * exchange_rate
        stat.cache_output_cost_cny = stat.cache_output_quota / quota_per_unit * exchange_rate


def fetch_enabled_department_user_ids(
    conn: Any,
    department_name: str,
    registered_before_ts: int,
) -> list[int]:
    """返回月末前已注册的启用用户 ID；禁用用户及其日志均不参与统计。"""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id
            FROM users
            WHERE {DEPARTMENT_SQL}
              AND status = 1
              AND created_at <= %s
            ORDER BY id
            """,
            (department_name, registered_before_ts),
        )
        return [int(row[0]) for row in cur.fetchall()]


def format_token_amount(tokens: int) -> str:
    text = f"{tokens / TOKENS_PER_HUNDRED_MILLION:.2f}".rstrip("0").rstrip(".")
    return f"{text} 亿"


def displayed_token_amount(tokens: int) -> Decimal:
    return Decimal(f"{tokens / TOKENS_PER_HUNDRED_MILLION:.2f}")


def format_displayed_token_amount(tokens: Decimal) -> str:
    text = format(tokens, "f").rstrip("0").rstrip(".")
    return f"{text} 亿"


def format_cost(cost: float) -> str:
    return f"{cost:,.0f}"


def displayed_cost(cost: float) -> Decimal:
    return Decimal(f"{cost:.0f}")


def unit_price(cost: float, tokens: int) -> float:
    return cost / tokens * TOKENS_PER_MILLION if tokens > 0 else 0.0


def print_report(
    label: str,
    start: datetime,
    end: datetime,
    total_users: int,
    stats: list[ModelStats],
    department_name: str | None = None,
    per_capita_million_tokens: float | None = None,
    department_label: str = "二级部门",
) -> None:
    input_tokens = sum(item.input_tokens for item in stats)
    output_tokens = sum(item.output_tokens for item in stats)
    cache_input_tokens = sum(item.cache_input_tokens for item in stats)
    cache_output_tokens = sum(item.cache_output_tokens for item in stats)
    # 四项费用来自逐条日志 quota 的精确拆分，合计严格等于最终日志费用。
    input_cost = sum(item.input_cost_cny for item in stats)
    output_cost = sum(item.output_cost_cny for item in stats)
    cache_input_cost = sum(item.cache_input_cost_cny for item in stats)
    cache_output_cost = sum(item.cache_output_cost_cny for item in stats)
    displayed_total_tokens = sum(
        (
            displayed_token_amount(input_tokens),
            displayed_token_amount(output_tokens),
            displayed_token_amount(cache_input_tokens),
            displayed_token_amount(cache_output_tokens),
        ),
        Decimal(0),
    )
    displayed_total_cost = sum(
        (
            displayed_cost(input_cost),
            displayed_cost(output_cost),
            displayed_cost(cache_input_cost),
            displayed_cost(cache_output_cost),
        ),
        Decimal(0),
    )
    displayed_average_price = (
        displayed_total_cost / (displayed_total_tokens * Decimal(100))
        if displayed_total_tokens > 0
        else Decimal(0)
    )
    total_input_tokens = input_tokens + cache_input_tokens + cache_output_tokens
    total_output_tokens = output_tokens
    input_output_ratio = total_input_tokens / total_output_tokens if total_output_tokens else 0.0
    cache_hit_rate = cache_input_tokens / total_input_tokens * 100 if total_input_tokens else 0.0
    department_line = f"\n{department_label}：{department_name}" if department_name else ""
    per_capita_text = (
        f"，人均 Token 量 {per_capita_million_tokens:,.2f} 百万"
        if per_capita_million_tokens is not None
        else ""
    )
    per_capita_cost = (
        sum((input_cost, output_cost, cache_input_cost, cache_output_cost)) / total_users
        if total_users > 0
        else 0.0
    )

    print(f"""Hi 各位领导：
AI 中转站{label}统计{department_line}
统计周期：{start.strftime('%Y-%m-%d %H:%M:%S')} － {end.strftime('%Y-%m-%d %H:%M')}
总注册人数：{total_users:,} 人

非缓存输入，Token 量 {format_token_amount(input_tokens)}，费用 {format_cost(input_cost)} 元，单价 {unit_price(input_cost, input_tokens):.2f} 元
非缓存输出，Token 量 {format_token_amount(output_tokens)}，费用 {format_cost(output_cost)} 元，单价 {unit_price(output_cost, output_tokens):.2f} 元
缓存输入，Token 量 {format_token_amount(cache_input_tokens)}，费用 {format_cost(cache_input_cost)} 元，单价 {unit_price(cache_input_cost, cache_input_tokens):.2f} 元
缓存输出，Token 量 {format_token_amount(cache_output_tokens)}，费用 {format_cost(cache_output_cost)} 元，单价 {unit_price(cache_output_cost, cache_output_tokens):.2f} 元

Token 总量 {format_displayed_token_amount(displayed_total_tokens)}{per_capita_text}，人均费用 {per_capita_cost:,.2f} 元，总费用 {displayed_total_cost:,.0f} 元，均价 {displayed_average_price:.2f} 元
输入输出倍数：{input_output_ratio:.1f} 倍，综合缓存命中率：{cache_hit_rate:.1f}%

Top 5 费用的模型：""")
    for index, item in enumerate(sorted(stats, key=lambda value: value.quota_cost_cny, reverse=True)[:5], start=1):
        print(
            f"{index}. {item.name}，费用 {format_cost(item.quota_cost_cny)} 元，"
            f"Token 量 {format_token_amount(item.total_tokens)}，"
            f"单价 {unit_price(item.quota_cost_cny, item.total_tokens):.2f} 元"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="按 users.department_name 的第二段统计二级部门指定月份的用量",
    )
    parser.add_argument(
        "department_name",
        help="二级部门名称，例如：自动化物流第一事业部",
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
        default=DEFAULT_REPORT_YEAR,
        help=f"统计年份，默认 {DEFAULT_REPORT_YEAR}",
    )
    return parser.parse_args()


def resolve_period(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, 0, 0, 0, tzinfo=CHINA_TIMEZONE)
    if month == 12:
        next_month = datetime(year + 1, 1, 1, tzinfo=CHINA_TIMEZONE)
    else:
        next_month = datetime(year, month + 1, 1, tzinfo=CHINA_TIMEZONE)
    return start, next_month - timedelta(seconds=1)


def main() -> int:
    args = parse_args()
    department_name = args.department_name.strip()
    if not department_name or "/" in department_name:
        raise SystemExit("请传入单独的二级部门名称，不要传完整部门路径。")

    start, end = resolve_period(args.year, args.month)
    start_ts = int(start.timestamp())
    end_ts = int(end.timestamp())

    conn = psycopg2.connect(DEFAULT_DSN)
    try:
        user_ids = fetch_enabled_department_user_ids(conn, department_name, end_ts)
        if not user_ids:
            raise SystemExit(f"未找到启用用户所属的二级部门：{department_name}")

        options = load_options(conn)
        exchange_rate = get_positive_option(
            options,
            ("Price", "USDExchangeRate", "usd_exchange_rate", "price"),
            DEFAULT_USD_TO_CNY_RATE,
        )
        quota_per_unit = get_positive_option(
            options,
            ("QuotaPerUnit", "quota_per_unit"),
            DEFAULT_QUOTA_PER_UNIT,
        )
        stats, total_quota, fallback_rows = collect_statistics(
            conn,
            start_ts,
            end_ts,
            user_ids=user_ids,
        )
        apply_quota_costs(stats, quota_per_unit, exchange_rate)
        if sum(stat.quota for stat in stats) != total_quota:
            raise RuntimeError("模型汇总 quota 与日志总 quota 不一致")
    finally:
        conn.close()

    if fallback_rows:
        print(
            f"提示：{fallback_rows:,} 条日志因历史计费快照不完整或表达式无法线性拆分，"
            "已按该条日志的四类 Token 占比分配最终 quota。",
            file=sys.stderr,
        )

    total_tokens = sum(item.total_tokens for item in stats)
    per_capita_million_tokens = (
        total_tokens / len(user_ids) / TOKENS_PER_MILLION
        if user_ids
        else 0.0
    )
    print_report(
        f" {args.year} 年 {args.month} 月",
        start,
        end,
        len(user_ids),
        stats,
        department_name=department_name,
        per_capita_million_tokens=per_capita_million_tokens,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
