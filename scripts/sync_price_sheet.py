#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将模型广场指定分组价格同步到既有报价表（Python 3.10+）。

    python -m pip install cryptography python-dotenv
    python scripts/sync_price_sheet.py          # 只读预览
    python scripts/sync_price_sheet.py --apply  # 备份后更新原文件

自动加载根目录 .env，环境变量优先：MODEL_SQUARE_BASE_URL、MODEL_SQUARE_TOKEN
（控制台个人访问令牌）、MODEL_SQUARE_AES_KEY（与部署站点一致）。
可用 --pricing-json 和 --status-json 同时传入已解密的接口响应，离线同步。

仅更新“模型价格列表”工作表中现有模型行的 B/C/D/E/G 列，
不新增模型、不改接口协议及表格排版。
Token 价格为人民币/百万 Token；按次价格 B=￥xx/次、C=按次收费、D/E=—。
分组名称在脚本开头的 GROUP_NAME 设置，匹配忽略大小写。
倍率优先级为用户特殊倍率 > 供应商倍率 > 分组倍率。
汇率读取 /api/status.usd_exchange_rate，不应用充值折算。
价格精度跟随模型广场：金额 >= 1 最多 4 位小数，< 1 最多 6 位小数；
旧版按次价格最多 4 位小数。去除末尾零，非零小额保留界面的最小显示值。
普通 Token 阶梯使用模型广场摘要的第一档，预览会注明阶梯标签；不执行表达式。
不支持时段、混合计费或任务用量表达式，遇到此类价格停止，避免写入错误报价。
折扣=未舍入的本地非缓存输入价/官方 input*10，固定保留两位小数。
按次模型仅与官方 per_call（元/次，可选扩展字段）比较，绝不与 Token 价比较。
缺失、null、空对象或没有可比较的官方价格时，G 列写 —。
折扣保留两位小数后为 10 折及以上时，G 列也写 —。

Excel 使用标准库定点更新 OOXML 单元格，保留原有样式、合并、图片及其他 ZIP
成员。写入前全量校验，原文件旁保存带时间戳的 .xlsx.bak 备份，再原子替换。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import posixpath
import re
import sys
import tempfile
from datetime import datetime
from decimal import Decimal, DecimalException, ROUND_HALF_UP
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from xml.dom import Node, minidom
from xml.parsers.expat import ExpatError
from zipfile import BadZipFile, ZipFile

from model_square_prices import PRICE_FIELDS, calculate_prices, positive_decimal, to_decimal


GROUP_NAME = "Basic"  # 要同步的分组名称，不区分大小写
SHEET_NAME = "模型价格列表"  # 要同步的工作表名称

SCRIPT_DIR = Path(__file__).resolve().parent
SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
MISSING = "—"
NUMBER = r"(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
VARIABLE = r"(?:p|c|cr|cc|cc1h|img|img_cr|img_o|ai|ao)"
TERM = rf"{VARIABLE}\s*\*\s*{NUMBER}"
TIER = re.compile(
    rf'tier\(\s*("(?:[^"\\]|\\.)*")\s*,\s*'
    rf'(?P<body>fixed\(\s*{NUMBER}\s*\)|{TERM}(?:\s*\+\s*{TERM})*)\s*\)'
)
CONDITION = rf"(?:p|c|len)\s*(?:<=|>=|<|>)\s*{NUMBER}"


def nonnegative(value, field: str) -> Decimal:
    result = to_decimal(value, field)
    if result < 0:
        raise ValueError(f"{field} 不能小于 0")
    return result


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def display_price(value: Decimal, small_digits: int = 6) -> Decimal:
    """匹配 pricing/lib/price.ts、dynamic-price.ts 与 lib/currency.ts。"""
    digits = 4 if value >= 1 else small_digits
    step = Decimal(1).scaleb(-digits)
    # currency.ts 的 adjustForMinimum 会把非零小额提升到最小显示单位。
    if 0 < value < step:
        value = step
    rounded = value.quantize(step, rounding=ROUND_HALF_UP)
    return Decimal(decimal_text(rounded))


def read_payload(args, endpoint: str) -> dict:
    source = args.pricing_json if endpoint == "pricing" else args.status_json
    if source:
        raw = source.read_bytes()
    else:
        headers = {"Accept": "application/json, text/plain"}
        if args.token:
            headers["Authorization"] = f"Bearer {args.token.strip()}"
        request = Request(f"{args.base_url.rstrip('/')}/api/{endpoint}", headers=headers)
        try:
            with urlopen(request, timeout=float(args.timeout)) as response:
                raw = response.read()
        except HTTPError as exc:
            raise ValueError(
                f"/api/{endpoint} 返回 HTTP {exc.code}；请检查站点及 MODEL_SQUARE_TOKEN。"
            ) from None
        except (URLError, TimeoutError):
            raise ValueError(f"无法连接 /api/{endpoint}，请检查网络和站点地址。") from None

    if endpoint == "pricing" and not raw.lstrip().startswith(b"{"):
        key = os.getenv("MODEL_SQUARE_AES_KEY", "").encode("utf-8")
        if len(key) < 32:
            raise ValueError("加密响应需要与站点一致的 MODEL_SQUARE_AES_KEY（至少 32 字节）。")
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            from cryptography.exceptions import InvalidTag
        except ImportError:
            raise ValueError("请先执行：python -m pip install cryptography") from None
        try:
            encrypted = base64.b64decode(raw.strip(), validate=True)
            raw = AESGCM(hashlib.sha256(key).digest()).decrypt(
                encrypted[:12], encrypted[12:], b"new-api:model-square:v1"
            )
        except (ValueError, InvalidTag):
            raise ValueError("模型价格响应解密失败，请检查 MODEL_SQUARE_AES_KEY。") from None

    payload = json.loads(raw, parse_float=Decimal)
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise ValueError(f"/api/{endpoint} 未返回成功的接口响应。")
    return payload


def basic_prices(model: dict, pricing: dict, group: str, exchange: Decimal) -> tuple[list, str]:
    name = model["model_name"]
    enabled = model.get("enable_groups", [])
    if not isinstance(enabled, list) or (group not in enabled and "all" not in enabled):
        raise ValueError(f"{name} 未在 {group} 分组启用")
    ratio = pricing["group_ratio"][group]
    vendor = str(model.get("vendor_id", ""))
    if group not in pricing.get("group_special_ratios", []):
        ratio = pricing.get("group_vendor_ratio", {}).get(group, {}).get(vendor, ratio)
    ratio = nonnegative(ratio, f"{name}.{group}.ratio")
    conversion = ratio * exchange
    mode = model.get("billing_mode", "ratio")
    for variant in model.get("billing_plugin_variants", []):
        if (
            variant.get("billing_mode", "ratio") != mode
            or variant.get("billing_expr", "") != model.get("billing_expr", "")
        ):
            raise ValueError(f"{name} 有不同的供应商定价，无法合并为单行")

    note = ""
    per_call = None
    if mode == "tiered_expr":
        expression = model.get("billing_expr")
        if not isinstance(expression, str):
            raise ValueError(f"{name} 缺少计费表达式")
        expression = expression.strip()
        expression, separator, _ = expression.partition("|||")
        expression = re.sub(r"^v1:\s*", "", expression.strip())
        tiers = list(TIER.finditer(expression))
        # 只接受完整的标准 Token 阶梯链，拒绝 regex 提取部分系数后遗漏乘数。
        shape = TIER.sub("T", expression)
        chain = rf"(?:{CONDITION}(?:\s*&&\s*{CONDITION})*\s*\?\s*T\s*:\s*)*T"
        if not tiers or not re.fullmatch(chain, shape.strip()):
            raise ValueError(f"{name} 的表达式无法可靠转换为报价表单价")
        fixed = [tier["body"].startswith("fixed") for tier in tiers]
        if any(fixed) and not all(fixed):
            raise ValueError(f"{name} 混合按次与 Token 计费，无法写入单行报价")
        note = f"阶梯 {json.loads(tiers[0][1])}（共 {len(tiers)} 档）"
        if separator:
            note += "，基础价不含条件附加倍率"
        if fixed[0]:
            per_call = nonnegative(re.search(NUMBER, tiers[0]["body"])[0], name) * conversion
        else:
            rates = {}
            for variable, raw in re.findall(rf"({VARIABLE})\s*\*\s*({NUMBER})", tiers[0]["body"]):
                if variable in rates:
                    raise ValueError(f"{name} 的表达式包含重复价格项 {variable}")
                rates[variable] = nonnegative(raw, name) * conversion
            prices = dict(zip(
                PRICE_FIELDS, (rates.get(v) for v in ("p", "c", "cr", "cc"))
            ))
            # 与模型广场一致：同价缓存读取不单列，但显式零价仍展示。
            if prices["cache_read"] and prices["cache_read"] == prices["input"]:
                prices["cache_read"] = None
    elif mode in ("ratio", "", None):
        if model.get("quota_type") == 1:
            per_call = nonnegative(model.get("model_price"), f"{name}.model_price") * conversion
        elif model.get("quota_type") == 0:
            for field in ("model_ratio", "completion_ratio"):
                nonnegative(model.get(field), f"{name}.{field}")
            for field in ("cache_ratio", "create_cache_ratio"):
                if model.get(field) is not None:
                    nonnegative(model[field], f"{name}.{field}")
            # 复用现有导出脚本的倍率计算，仅提供已解析的目标分组倍率。
            prices = calculate_prices(
                {**model, "enable_groups": [group]}, {group: ratio}, {}, {group}, exchange
            )
        else:
            raise ValueError(f"{name} 的 quota_type 无效")
    else:
        raise ValueError(f"{name} 的计费模式不支持：{mode}")

    if per_call is not None:
        displayed = display_price(per_call, 6 if mode == "tiered_expr" else 4)
        return [f"￥{decimal_text(displayed)}/次", "按次收费", MISSING, MISSING, per_call], note
    return [*(prices[field] if prices[field] is not None else MISSING for field in PRICE_FIELDS), None], note


def cell_text(cell, strings: list[str]) -> str:
    if cell is None:
        return ""
    if cell.getAttribute("t") == "inlineStr":
        return "".join(
            child.data for node in cell.getElementsByTagNameNS(SHEET_NS, "t")
            for child in node.childNodes if child.nodeType == Node.TEXT_NODE
        )
    values = cell.getElementsByTagNameNS(SHEET_NS, "v")
    value = "".join(n.data for n in values[0].childNodes) if values else ""
    return strings[int(value)] if cell.getAttribute("t") == "s" else value


def set_cell_value(row, cell, address: str, value) -> None:
    """只替换单元格内容，保留原有样式与扩展属性。"""
    doc = row.ownerDocument
    prefix = f"{row.prefix}:" if row.prefix else ""
    if cell is None:
        cell = doc.createElementNS(SHEET_NS, prefix + "c")
        cell.setAttribute("r", address)
        column = re.sub(r"\d", "", address)
        following = None
        for candidate in row.childNodes:
            if candidate.nodeType != Node.ELEMENT_NODE or candidate.localName != "c":
                continue
            candidate_column = re.sub(r"\d", "", candidate.getAttribute("r"))
            if (len(candidate_column), candidate_column) > (len(column), column):
                following = candidate
                break
        row.insertBefore(cell, following)
    for child in list(cell.childNodes):
        if child.nodeType == Node.ELEMENT_NODE and child.localName in ("v", "is", "f"):
            cell.removeChild(child)
    cell.setAttribute("t", "n" if isinstance(value, Decimal) else "inlineStr")
    if isinstance(value, Decimal):
        container = doc.createElementNS(SHEET_NS, prefix + "v")
        container.appendChild(doc.createTextNode(decimal_text(value)))
    else:
        container = doc.createElementNS(SHEET_NS, prefix + "is")
        text = doc.createElementNS(SHEET_NS, prefix + "t")
        text.appendChild(doc.createTextNode(value))
        container.appendChild(text)
    cell.insertBefore(container, cell.firstChild)


def update_workbook(
    original: bytes, models: dict, pricing: dict, group: str,
    exchange: Decimal, official: dict,
) -> tuple[dict[str, bytes], int]:
    changed = {}
    count = 0
    with ZipFile(io.BytesIO(original)) as archive:
        workbook = minidom.parseString(archive.read("xl/workbook.xml"))
        sheets = [sheet for sheet in workbook.getElementsByTagNameNS(SHEET_NS, "sheet")
                  if sheet.getAttribute("name") == SHEET_NAME]
        if len(sheets) != 1:
            raise ValueError(f"未找到唯一的 {SHEET_NAME!r} 工作表，请检查工作表名称")
        relationship_id = sheets[0].getAttributeNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"
        )
        relationships = minidom.parseString(archive.read("xl/_rels/workbook.xml.rels"))
        targets = [node for node in relationships.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/package/2006/relationships", "Relationship"
        ) if node.getAttribute("Id") == relationship_id]
        if (
            not relationship_id or len(targets) != 1
            or targets[0].getAttribute("TargetMode") == "External"
            or targets[0].getAttribute("Type")
            != "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
        ):
            raise ValueError(f"{SHEET_NAME!r} 工作表关联无效")
        target = targets[0].getAttribute("Target")
        sheet_path = posixpath.normpath(target.lstrip("/") if target.startswith("/")
                                       else posixpath.join("xl", target))
        if not target or sheet_path not in archive.namelist():
            raise ValueError(f"{SHEET_NAME!r} 工作表 XML 文件不存在")
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            doc = minidom.parseString(archive.read("xl/sharedStrings.xml"))
            strings = [
                "".join(child.data for text in item.getElementsByTagNameNS(SHEET_NS, "t")
                        for child in text.childNodes if child.nodeType == Node.TEXT_NODE)
                for item in doc.getElementsByTagNameNS(SHEET_NS, "si")
            ]
        for entry in archive.namelist():
            if entry != sheet_path:
                continue
            doc = minidom.parseString(archive.read(entry))
            sheet_changed = False
            in_table = False
            merged = [node.getAttribute("ref") for node in doc.getElementsByTagNameNS(SHEET_NS, "mergeCell")]
            for row in doc.getElementsByTagNameNS(SHEET_NS, "row"):
                cells = {cell.getAttribute("r"): cell for cell in row.childNodes
                         if cell.nodeType == Node.ELEMENT_NODE and cell.localName == "c"}
                number = row.getAttribute("r")
                name = cell_text(cells.get(f"A{number}"), strings).strip()
                if name == "模型名称":
                    if (
                        "输入价" not in cell_text(cells.get(f"B{number}"), strings)
                        or "折扣" not in cell_text(cells.get(f"G{number}"), strings)
                    ):
                        raise ValueError(f"{entry}:{number} 表头不符合 B～E 价格、G 折扣布局")
                    in_table = True
                    continue
                if not name or f"A{number}:G{number}" in merged:
                    in_table = False
                if not in_table:
                    continue
                if name not in models:
                    raise ValueError(f"{entry}:A{number} 模型 {name!r} 不在接口返回的模型列表中")
                values, note = basic_prices(models[name], pricing, group, exchange)
                per_call = values.pop()
                official_model = official.get(name)
                discount = MISSING
                if official_model is not None:
                    if not isinstance(official_model, dict):
                        raise ValueError(f"{name} 的官方价格必须为对象或 null")
                    field = "per_call" if per_call is not None else "input"
                    reference = official_model.get(field)
                    actual = per_call if per_call is not None else values[0]
                    if reference is not None:
                        reference = nonnegative(reference, f"official.{name}.{field}")
                        if reference > 0 and isinstance(actual, Decimal):
                            rounded_discount = (actual / reference * 10).quantize(
                                Decimal("0.01"), rounding=ROUND_HALF_UP
                            )
                            if rounded_discount < 10:
                                discount = f"{rounded_discount:.2f} 折"
                # 先使用原价计算折扣，再将预览及 Excel 数值统一到界面显示精度。
                values = [display_price(value) if isinstance(value, Decimal) else value
                          for value in values]
                values.append(discount)
                print(f"{entry}:行 {number} {name}: " + " | ".join(map(str, values)) + (f" [{note}]" if note else ""))
                count += 1
                for column, value in zip("BCDEG", values):
                    address = f"{column}{number}"
                    for region in merged:
                        bounds = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", region)
                        if (
                            bounds and int(bounds[2]) <= int(number) <= int(bounds[4])
                            and (len(bounds[1]), bounds[1]) <= (1, column)
                            <= (len(bounds[3]), bounds[3])
                        ):
                            raise ValueError(f"目标 {address} 属于合并单元格 {region}，已停止")
                    cell = cells.get(address)
                    if cell is not None and cell.getElementsByTagNameNS(SHEET_NS, "f"):
                        raise ValueError(f"目标 {address} 含公式，已停止以免破坏依赖")
                    if cell is not None and cell_text(cell, strings) == str(value):
                        continue
                    set_cell_value(row, cell, address, value)
                    sheet_changed = True
            if sheet_changed:
                changed[entry] = doc.toxml(encoding="UTF-8")
    if not count:
        raise ValueError(f"未找到模型报价行，请检查 {SHEET_NAME!r} 工作表中的“模型名称”表头")
    return changed, count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workbook", type=Path, default=SCRIPT_DIR / "AI Gateway 体系说明与价格表.xlsx")
    parser.add_argument("--official-prices", type=Path, default=SCRIPT_DIR / "official_model_prices.json")
    parser.add_argument("--base-url", help="默认 MODEL_SQUARE_BASE_URL 或 https://ai.semi-tech.com")
    parser.add_argument("--token", help="默认 MODEL_SQUARE_TOKEN，建议通过环境变量配置")
    parser.add_argument("--pricing-json", type=Path, help="已解密的 /api/pricing 响应文件")
    parser.add_argument("--status-json", type=Path, help="/api/status 响应文件，与 --pricing-json 同时使用")
    parser.add_argument("--timeout", type=positive_decimal, default=Decimal(20))
    parser.add_argument("--apply", action="store_true", help="备份并更新原表，默认仅预览")
    args = parser.parse_args()
    if bool(args.pricing_json) != bool(args.status_json):
        parser.error("--pricing-json 和 --status-json 必须同时提供")
    try:
        env_file = SCRIPT_DIR.parent / ".env"
        if env_file.is_file() and not args.pricing_json:
            try:
                from dotenv import load_dotenv
            except ImportError:
                raise ValueError("加载 .env 需要：python -m pip install python-dotenv") from None
            load_dotenv(env_file, override=False, interpolate=False, encoding="utf-8-sig")
        args.base_url = args.base_url or os.getenv("MODEL_SQUARE_BASE_URL", "https://ai.semi-tech.com")
        args.token = args.token or os.getenv("MODEL_SQUARE_TOKEN", "")
        url = urlsplit(args.base_url)
        if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password or url.query or url.fragment:
            raise ValueError("--base-url 必须为不含凭据、查询参数或片段的 HTTP(S) 站点地址")
        if args.workbook.suffix.lower() != ".xlsx":
            raise ValueError("工作簿必须是 .xlsx 文件")
        original = args.workbook.read_bytes()
        official = json.loads(args.official_prices.read_text(encoding="utf-8-sig"), parse_float=Decimal)
        if not isinstance(official, dict):
            raise ValueError("官方价格文件必须为 JSON 对象")
        pricing = read_payload(args, "pricing")
        status = read_payload(args, "status").get("data")
        if not isinstance(status, dict):
            raise ValueError("/api/status 缺少 data 对象")
        exchange = nonnegative(status.get("usd_exchange_rate"), "usd_exchange_rate")
        if exchange == 0:
            raise ValueError("usd_exchange_rate 必须大于 0")
        ratios = pricing.get("group_ratio")
        if not isinstance(ratios, dict):
            raise ValueError("/api/pricing 缺少 group_ratio 对象")
        groups = [group for group in ratios if group.casefold() == GROUP_NAME.casefold()]
        if len(groups) != 1:
            raise ValueError(f"未找到唯一的 {GROUP_NAME} 分组，请检查分组名称和当前用户的分组权限")
        if not isinstance(pricing.get("group_vendor_ratio", {}), dict) or not isinstance(pricing.get("group_special_ratios", []), list):
            raise ValueError("分组供应商倍率或特殊倍率结构无效")
        for vendor_ratios in pricing.get("group_vendor_ratio", {}).values():
            if not isinstance(vendor_ratios, dict):
                raise ValueError("供应商倍率必须按分组嵌套对象")
        data = pricing.get("data")
        if not isinstance(data, list):
            raise ValueError("/api/pricing 缺少模型列表")
        models = {}
        for model in data:
            if not isinstance(model, dict) or not isinstance(model.get("model_name"), str):
                raise ValueError("模型列表包含无效记录")
            name = model["model_name"]
            if name in models:
                raise ValueError(f"接口返回重复模型：{name}")
            models[name] = model
        print(f"分组：{groups[0]}；美元兑人民币：{exchange}；B/C/D/E/G 列预览：")
        changed, count = update_workbook(original, models, pricing, groups[0], exchange, official)
        if not args.apply:
            print(f"已预览 {count} 行，未修改文件。添加 --apply 写入。")
            return 0
        if not changed:
            print(f"{count} 行价格已一致，无需修改。")
            return 0
        with tempfile.NamedTemporaryFile(dir=args.workbook.parent, suffix=".xlsx", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            with ZipFile(io.BytesIO(original)) as source, ZipFile(temporary_path, "w") as target:
                target.comment = source.comment
                for entry in source.infolist():
                    target.writestr(entry, changed.get(entry.filename, source.read(entry.filename)))
            if args.workbook.read_bytes() != original:
                raise ValueError("工作簿在同步期间被其他程序修改，已停止，请重新执行")
            backup = args.workbook.with_name(args.workbook.name + datetime.now().strftime(".%Y%m%d-%H%M%S-%f.bak"))
            with backup.open("xb") as file:
                file.write(original)
            os.replace(temporary_path, args.workbook)
        finally:
            temporary_path.unlink(missing_ok=True)
        print(f"已同步 {count} 行：{args.workbook}\n备份：{backup}")
        return 0
    except (ValueError, OSError, DecimalException, BadZipFile, ExpatError, KeyError, IndexError) as exc:
        print(f"同步失败（未写入工作簿）：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
