#!/usr/bin/env python3
"""
Parse downloaded official NBS HTML documents:
1. 2025 National Statistical Communique (t20260228_1962662.html) -> 2025 national preliminary observations
2. 7th National Population Census Bulletin No. 5 (t20230206_1902005.html) -> 2020 census age 65+ provincial & national observations

All extracted rows conform to the unified normalized observation schema.
"""
from __future__ import annotations

import csv
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
REGIONS_CSV = ROOT / "data" / "metadata" / "regions.csv"
INDICATORS_CSV = ROOT / "data" / "metadata" / "indicators.csv"


def load_regions() -> dict[str, dict]:
    by_short = {}
    with open(REGIONS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["in_mainland_nbs_scope"] == "true":
                by_short[row["geo_name_short_zh"]] = row
                by_short[row["geo_name_zh"]] = row
    return by_short


def load_indicators() -> dict[str, dict]:
    out = {}
    with open(INDICATORS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["indicator_id"]] = row
    return out


def normalize_province_label(raw: str) -> str:
    cleaned = re.sub(r"[\s\u3000\xa0]+", "", raw)
    return cleaned


def parse_census2020_bulletin5(html_path: Path, retrieved_at: str) -> list[dict]:
    regions = load_regions()
    indicators = load_indicators()
    ind = indicators["population_65plus"]

    with open(html_path, "rb") as f:
        soup = BeautifulSoup(f.read().decode("utf-8", "replace"), "lxml")

    # Table 1 in Bulletin No. 5: 各地区人口年龄构成 (31 provinces + National)
    tables = soup.find_all("table")
    target_rows = []
    for tbl in tables:
        rows = [
            [" ".join(c.get_text(" ", strip=True).split()) for c in tr.find_all(["td", "th"])]
            for tr in tbl.find_all("tr")
        ]
        if len(rows) >= 34 and any("北京" in normalize_province_label(r[0]) for r in rows if r):
            target_rows = rows
            break

    records = []
    seen_geos = set()
    for r in target_rows:
        if len(r) < 5:
            continue
        geo_key = normalize_province_label(r[0])
        if geo_key not in regions:
            continue
        reg = regions[geo_key]
        if reg["geo_code"] in seen_geos:
            continue
        seen_geos.add(reg["geo_code"])
        val_str = r[4].strip()
        val = float(val_str)
        records.append({
            "indicator_id": "population_65plus",
            "indicator_name_zh": ind["indicator_name_zh"],
            "indicator_name_en": ind["indicator_name_en"],
            "geo_code": reg["geo_code"],
            "geo_name_zh": reg["geo_name_zh"],
            "geo_name_en": reg["geo_name_en"],
            "geo_level": reg["geo_level"],
            "year": 2020,
            "value": val,
            "unit": ind["unit"],
            "source_id": "NBS_CENSUS7_B5",
            "source_agency": "国家统计局 / 国务院第七次全国人口普查领导小组办公室",
            "source_url": "https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902005.html",
            "source_table": "第七次全国人口普查公报（第五号）表5-2：各地区人口年龄构成",
            "source_locator": f"Table 5-2, row '{geo_key}', column '其中：65岁及以上 (%)'",
            "publication_date": "2021-05-11",
            "retrieved_at": retrieved_at,
            "data_status": "final",
            "methodology_version": "7th_census_2020_full_enumeration",
            "transformation": "none (direct official percentage)",
            "verification_status": "verified",
            "notes": "2020年11月1日零时第七次全国人口普查全数登记口径（注：国家统计局官网重发路径归档于2023-02-06，原发布日期为2021-05-11）",
        })
    return records


def parse_communique_2025(html_path: Path, retrieved_at: str) -> list[dict]:
    regions = load_regions()
    indicators = load_indicators()
    cn = regions["全国"]

    with open(html_path, "rb") as f:
        soup = BeautifulSoup(f.read().decode("utf-8", "replace"), "lxml")
    content = soup.find("div", class_="trs_editor_view") or soup
    txt = " ".join(content.get_text(" ", strip=True).split())

    def extract_float(pattern: str) -> float:
        m = re.search(pattern, txt)
        if not m:
            raise ValueError(f"Pattern not found in 2025 communique: {pattern}")
        return float(m.group(1).replace(",", ""))

    url = "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html"
    pub = "2026-02-28"
    source_id = "NBS_COMMUNIQUE_2025"
    agency = "国家统计局"
    table_title = "中华人民共和国2025年国民经济和社会发展统计公报"

    # Parse Table 1 for 65+ share
    age65_pct = None
    for tbl in content.find_all("table"):
        for tr in tbl.find_all("tr"):
            cells = [" ".join(c.get_text(" ", strip=True).split()) for c in tr.find_all(["td", "th"])]
            if cells and "65" in cells[0] and "及以上" in cells[0] and len(cells) >= 3:
                age65_pct = float(cells[2])
                break
        if age65_pct is not None:
            break
    if age65_pct is None:
        raise ValueError("Could not find 65+ share in Table 1 of 2025 communique")

    extractions = [
        (
            "population",
            extract_float(r"年末全国人口\s*(?:\[\d+\]\s*)?([\d,\.]+)\s*万人"),
            "第一部分《综合》正文及表1：2025年年末人口数及其构成",
            "none",
            "初步核算/年度统计公报口径，不含港澳台",
        ),
        (
            "birth_rate",
            extract_float(r"出生率为\s*([\d\.]+)\s*‰"),
            "第一部分《综合》正文：人口出生率",
            "none",
            "2025年全国人口变动情况抽样调查及统计公报口径",
        ),
        (
            "urbanization_rate",
            extract_float(r"年末全国常住人口城镇化率为\s*([\d\.]+)%"),
            "第一部分《综合》正文：年末全国常住人口城镇化率",
            "none",
            "年末城镇常住人口95380万人/全国人口140489万人",
        ),
        (
            "population_65plus",
            age65_pct,
            "表1：2025年年末人口数及其构成（其中：65周岁及以上比重）",
            "none",
            "公报公布精度为一位小数（22365万人，占15.9%）",
        ),
        (
            "gdp",
            extract_float(r"初步核算，全年国内生产总值\s*(?:\[\d+\]\s*)?([\d,\.]+)\s*亿元"),
            "第一部分《综合》正文：全年国内生产总值（现价）",
            "none",
            "初步核算数，现价；按不变价计算同比增长5.0%",
        ),
        (
            "gdp_per_capita",
            extract_float(r"全年人均国内生产总值\s*([\d,\.]+)\s*元"),
            "第一部分《综合》正文：全年人均国内生产总值（现价）",
            "none",
            "初步核算数，现价；按不变价计算同比增长5.1%",
        ),
        (
            "disposable_income",
            extract_float(r"全年全国居民人均可支配收入\s*([\d,\.]+)\s*元"),
            "第九部分《人民生活和社会保障》正文：全国居民人均可支配收入",
            "none",
            "城乡一体化住户收支调查口径，名义增长5.0%",
        ),
        (
            "retail_sales",
            extract_float(r"全年社会消费品零售总额\s*([\d,\.]+)\s*亿元"),
            "第六部分《国内贸易》正文：全年社会消费品零售总额",
            "none",
            "初步统计数，比上年名义增长3.7%",
        ),
        (
            "higher_education_students",
            round(extract_float(r"普通、职业本专科\s*(?:\[\d+\]\s*)?招生\s*[\d\.]+\s*万人，在校生\s*([\d\.]+)\s*万人") * 10000),
            "第十部分《科学技术和教育》正文：普通、职业本专科在校生",
            "multiply_by_10000 (3954.0 万人 -> 39540000 人)",
            "含普通本科、职业本科、高职（专科），不含研究生；公报原文单位为万人（保留1位小数）",
        ),
    ]

    records = []
    for ind_id, val, locator, transform, note in extractions:
        ind = indicators[ind_id]
        records.append({
            "indicator_id": ind_id,
            "indicator_name_zh": ind["indicator_name_zh"],
            "indicator_name_en": ind["indicator_name_en"],
            "geo_code": cn["geo_code"],
            "geo_name_zh": cn["geo_name_zh"],
            "geo_name_en": cn["geo_name_en"],
            "geo_level": cn["geo_level"],
            "year": 2025,
            "value": val,
            "unit": ind["unit"],
            "source_id": source_id,
            "source_agency": agency,
            "source_url": url,
            "source_table": table_title,
            "source_locator": locator,
            "publication_date": pub,
            "retrieved_at": retrieved_at,
            "data_status": "preliminary",
            "methodology_version": "nbs_communique_2025",
            "transformation": transform,
            "verification_status": "verified",
            "notes": note,
        })
    return records


if __name__ == "__main__":
    c2020 = parse_census2020_bulletin5(
        ROOT / "data/raw/nbs_census2020/bulletin5_age.html",
        "2026-11-24T03:35:45Z",
    )
    c2025 = parse_communique_2025(
        ROOT / "data/raw/nbs_communique/communique_2025.html",
        "2026-11-24T03:35:40Z",
    )
    print(f"Parsed 2020 Census Bulletin 5: {len(c2020)} rows")
    print(f"Parsed 2025 National Communique: {len(c2025)} rows")
    for r in c2025:
        print(f"  2025 {r['indicator_id']:28s} = {r['value']} {r['unit']}")
