#!/usr/bin/env python3
"""
Build the versioned DuckDB warehouse, Parquet export, and pre-computed
Next.js frontend data bundles from data/normalized/observations.csv.

Outputs:
  - data/processed/china_data_atlas.duckdb
  - data/processed/observations.parquet
  - app/src/data/atlas-data.json        (SSR/SSG complete typed bundle)
  - app/public/data/observations.csv    (exact copy of normalized CSV)
  - app/public/data/data-dictionary.json
"""
from __future__ import annotations

import csv
import json
import math
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import duckdb

ROOT = Path(__file__).resolve().parents[2]
OBS_CSV = ROOT / "data" / "normalized" / "observations.csv"
IND_CSV = ROOT / "data" / "metadata" / "indicators.csv"
REG_CSV = ROOT / "data" / "metadata" / "regions.csv"
SRC_CSV = ROOT / "data" / "metadata" / "sources.csv"
PROCESSED_DIR = ROOT / "data" / "processed"
DUCKDB_PATH = PROCESSED_DIR / "china_data_atlas.duckdb"
PARQUET_PATH = PROCESSED_DIR / "observations.parquet"
APP_DATA_JSON = ROOT / "app" / "src" / "data" / "atlas-data.json"
PUBLIC_DATA_DIR = ROOT / "app" / "public" / "data"


def load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_duckdb_and_parquet() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    if DUCKDB_PATH.exists():
        DUCKDB_PATH.unlink()

    con = duckdb.connect(str(DUCKDB_PATH))
    con.execute(f"""
        CREATE TABLE regions AS
        SELECT * FROM read_csv_auto('{REG_CSV.as_posix()}', header=true);
    """)
    con.execute(f"""
        CREATE TABLE indicators AS
        SELECT * FROM read_csv_auto('{IND_CSV.as_posix()}', header=true);
    """)
    con.execute(f"""
        CREATE TABLE sources AS
        SELECT * FROM read_csv_auto('{SRC_CSV.as_posix()}', header=true);
    """)
    con.execute(f"""
        CREATE TABLE observations AS
        SELECT
            indicator_id,
            indicator_name_zh,
            indicator_name_en,
            geo_code,
            geo_name_zh,
            geo_name_en,
            geo_level,
            CAST(year AS INTEGER) AS year,
            TRY_CAST(NULLIF(trim(CAST(value AS VARCHAR)), '') AS DOUBLE) AS value,
            unit,
            source_id,
            source_agency,
            source_url,
            source_table,
            source_locator,
            publication_date,
            retrieved_at,
            data_status,
            methodology_version,
            transformation,
            verification_status,
            notes
        FROM read_csv_auto('{OBS_CSV.as_posix()}', all_varchar=true, header=true);
    """)
    con.execute(f"COPY observations TO '{PARQUET_PATH.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);")
    con.close()


def compute_dense_competition_ranks(items: list[tuple[str, float]], descending: bool = True) -> dict[str, int]:
    """Standard competition ranking (1, 2, 2, 4) for ties."""
    sorted_items = sorted(items, key=lambda x: (-x[1] if descending else x[1], x[0]))
    ranks: dict[str, int] = {}
    prev_val = None
    prev_rank = 0
    for idx, (geo_code, val) in enumerate(sorted_items, start=1):
        if prev_val is not None and math.isclose(val, prev_val, rel_tol=1e-9, abs_tol=1e-9):
            ranks[geo_code] = prev_rank
        else:
            ranks[geo_code] = idx
            prev_rank = idx
            prev_val = val
    return ranks


def build_frontend_bundle() -> None:
    indicators_raw = load_csv(IND_CSV)
    regions_raw = load_csv(REG_CSV)
    sources_raw = load_csv(SRC_CSV)
    obs_raw = load_csv(OBS_CSV)

    regions_by_code = {r["geo_code"]: r for r in regions_raw}
    provinces_by_region: dict[str, list[str]] = defaultdict(list)
    region_meta: dict[str, dict] = {}
    for r in regions_raw:
        if r["geo_level"] == "provincial" and r["in_mainland_nbs_scope"] == "true":
            provinces_by_region[r["region_code"]].append(r["geo_code"])
            region_meta[r["region_code"]] = {
                "region_code": r["region_code"],
                "region_name_zh": r["region_name_zh"],
                "region_name_en": r["region_name_en"],
            }

    # Index valid observations
    obs_by_ind: dict[str, list[dict]] = defaultdict(list)
    val_lookup: dict[tuple[str, str, int], float] = {}
    all_years: set[int] = set()

    for row in obs_raw:
        v_str = row["value"].strip()
        if v_str == "":
            continue
        val = float(v_str)
        year = int(row["year"])
        all_years.add(year)
        clean_row = {
            "indicator_id": row["indicator_id"],
            "geo_code": row["geo_code"],
            "geo_level": row["geo_level"],
            "year": year,
            "value": val,
            "source_id": row["source_id"],
            "source_agency": row["source_agency"],
            "source_url": row["source_url"],
            "source_table": row["source_table"],
            "source_locator": row["source_locator"],
            "publication_date": row["publication_date"],
            "retrieved_at": row["retrieved_at"],
            "data_status": row["data_status"],
            "methodology_version": row["methodology_version"],
            "transformation": row["transformation"],
            "verification_status": row["verification_status"],
            "notes": row["notes"],
        }
        obs_by_ind[row["indicator_id"]].append(clean_row)
        val_lookup[(row["indicator_id"], row["geo_code"], year)] = val

    indicators_out = []
    insights_out = []

    for ind in indicators_raw:
        ind_id = ind["indicator_id"]
        rows = obs_by_ind.get(ind_id, [])
        nat_rows = sorted([r for r in rows if r["geo_level"] == "national"], key=lambda x: x["year"])
        prov_rows = [r for r in rows if r["geo_level"] == "provincial"]

        prov_by_year: dict[int, list[dict]] = defaultdict(list)
        for r in prov_rows:
            prov_by_year[r["year"]].append(r)

        prov_years = sorted(prov_by_year.keys())
        complete_prov_years = [y for y in prov_years if len(prov_by_year[y]) == 31]
        latest_prov_year = complete_prov_years[-1] if complete_prov_years else (prov_years[-1] if prov_years else None)
        latest_nat = nat_rows[-1] if nat_rows else None

        # YoY for national ONLY if consecutive year & compatible methodology
        nat_yoy = None
        if len(nat_rows) >= 2:
            cur, prev = nat_rows[-1], nat_rows[-2]
            if cur["year"] == prev["year"] + 1 and prev["value"] != 0:
                is_rate = ind["unit"] in {"%", "‰"}
                diff = cur["value"] - prev["value"]
                pct = (diff / abs(prev["value"])) * 100.0
                nat_yoy = {
                    "from_year": prev["year"],
                    "to_year": cur["year"],
                    "abs_change": round(diff, 4),
                    "pct_change": round(pct, 2),
                    "is_rate_unit": is_rate,
                    "comparable": True,
                    "note": "现价名义同比（非不变价实际增速）" if ind_id in {"gdp", "gdp_per_capita"} else (
                        "公报初步数与上年统计年鉴/公报对比" if cur["data_status"] == "preliminary" else "同口径年度可比变化"
                    ),
                }

        # Top/Bottom provinces in latest provincial year
        top3, bottom3 = [], []
        latest_prov_coverage = 0.0
        if latest_prov_year is not None:
            latest_list = prov_by_year[latest_prov_year]
            latest_prov_coverage = round(len(latest_list) / 31.0, 4)
            ranks = compute_dense_competition_ranks([(r["geo_code"], r["value"]) for r in latest_list], descending=True)
            sorted_desc = sorted(latest_list, key=lambda r: (-r["value"], r["geo_code"]))
            top3 = [
                {
                    "geo_code": r["geo_code"],
                    "geo_name_zh": regions_by_code[r["geo_code"]]["geo_name_short_zh"],
                    "value": r["value"],
                    "rank": ranks[r["geo_code"]],
                }
                for r in sorted_desc[:3]
            ]
            bottom3 = [
                {
                    "geo_code": r["geo_code"],
                    "geo_name_zh": regions_by_code[r["geo_code"]]["geo_name_short_zh"],
                    "value": r["value"],
                    "rank": ranks[r["geo_code"]],
                }
                for r in reversed(sorted_desc[-3:])
            ]

        # Precompute statistically rigorous 7-region aggregates for each provincial year
        regional_agg: dict[str, list[dict]] = {}
        agg_method = ind["aggregation_method"]
        for y in prov_years:
            y_entries = []
            for r_code, p_codes in provinces_by_region.items():
                vals = [(p, val_lookup.get((ind_id, p, y))) for p in p_codes]
                present = [(p, v) for p, v in vals if v is not None]
                if len(present) < len(p_codes):
                    y_entries.append({
                        "region_code": r_code,
                        "value": None,
                        "method": agg_method,
                        "complete": False,
                        "provinces_present": len(present),
                        "provinces_total": len(p_codes),
                    })
                    continue

                agg_val = None
                if agg_method == "sum":
                    agg_val = round(sum(v for _, v in present), 2)
                elif agg_method == "population_weighted_mean":
                    weights = [(p, val_lookup.get(("population", p, y))) for p in p_codes]
                    if all(w is not None and w > 0 for _, w in weights):
                        w_map = dict(weights)
                        tot_w = sum(w_map.values())
                        agg_val = round(sum(v * w_map[p] for p, v in present) / tot_w, 2)
                elif agg_method == "ratio_gdp_over_pop":
                    gdps = [val_lookup.get(("gdp", p, y)) for p in p_codes]
                    pops = [val_lookup.get(("population", p, y)) for p in p_codes]
                    if all(g is not None for g in gdps) and all(p is not None and p > 0 for p in pops):
                        # gdp in 亿元 (1e8), pop in 万人 (1e4) -> ratio * 1e4 = 元/人
                        agg_val = round((sum(gdps) * 1e8) / (sum(pops) * 1e4), 0)

                y_entries.append({
                    "region_code": r_code,
                    "value": agg_val,
                    "method": agg_method,
                    "complete": agg_val is not None,
                    "provinces_present": len(present),
                    "provinces_total": len(p_codes),
                })
            regional_agg[str(y)] = y_entries

        # Data-driven finding for this indicator
        finding_zh = ""
        if latest_prov_year is not None and top3 and bottom3:
            p_prec = int(ind["precision"])
            fmt = lambda x: f"{x:,.{p_prec}f}"
            finding_zh = (
                f"{latest_prov_year}年省级数据显示，{top3[0]['geo_name_zh']}位居全国首位"
                f"（{fmt(top3[0]['value'])} {ind['unit']}），"
                f"其次为{top3[1]['geo_name_zh']}（{fmt(top3[1]['value'])}）与{top3[2]['geo_name_zh']}（{fmt(top3[2]['value'])}）；"
                f"{bottom3[0]['geo_name_zh']}处于省级序列末端（{fmt(bottom3[0]['value'])} {ind['unit']}）。"
            )
            if latest_nat:
                finding_zh += f" 最新全国统计值为{latest_nat['year']}年的{fmt(latest_nat['value'])} {ind['unit']}（{ '初步核算/公报' if latest_nat['data_status']=='preliminary' else '年鉴/修订口径' }）。"

        ind_obj = {
            **ind,
            "is_core": ind["is_core"] == "true",
            "precision": int(ind["precision"]),
            "additive_to_national": ind["additive_to_national"] == "true",
            "latest_national": latest_nat,
            "latest_national_yoy": nat_yoy,
            "latest_provincial_year": latest_prov_year,
            "latest_provincial_coverage": latest_prov_coverage,
            "provincial_years": prov_years,
            "national_years": [r["year"] for r in nat_rows],
            "all_years": sorted(set(prov_years) | {r["year"] for r in nat_rows}),
            "top3_latest": top3,
            "bottom3_latest": bottom3,
            "key_finding_zh": finding_zh,
            "regional_aggregates": regional_agg,
            "observation_count": len(rows),
            "verified_count": sum(1 for r in rows if r["verification_status"] == "verified"),
            "source_ids": sorted({r["source_id"] for r in rows}),
        }
        indicators_out.append(ind_obj)

        if ind_obj["is_core"] and top3:
            insights_out.append({
                "indicator_id": ind_id,
                "category_id": ind["category_id"],
                "title_zh": ind["indicator_name_zh"],
                "year": latest_prov_year,
                "national_year": latest_nat["year"] if latest_nat else None,
                "national_value": latest_nat["value"] if latest_nat else None,
                "unit": ind["unit"],
                "precision": int(ind["precision"]),
                "top_province": top3[0],
                "summary_zh": finding_zh,
            })

    bundle = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platform": {
            "name_zh": "中国数据地图",
            "name_en": "China Data Atlas",
            "tagline": "Make China's Data Accessible, Understandable, Traceable and Explorable.",
            "map_compliance_status": "deferred_non_map_compliant_alternative",
            "map_compliance_note_zh": "依据《地图管理条例》及自然资源部地图审核规范，公开发布含动态专题数据叠加的交互式中国行政区划地图须使用具备法定审图号或测绘资质的合规底图服务。本版本严格不采用来源不明的第三方GeoJSON，正式采用「七大区域省级矩阵热力图 + 省级排序条形图」作为100%合规的空间对比可视化方案。",
            "earliest_year": min(all_years) if all_years else None,
            "latest_year": max(all_years) if all_years else None,
            "total_valid_observations": sum(len(v) for v in obs_by_ind.values()),
            "total_verified_observations": sum(
                sum(1 for r in v if r["verification_status"] == "verified") for v in obs_by_ind.values()
            ),
            "core_indicators_count": sum(1 for i in indicators_out if i["is_core"] and i["observation_count"] > 0),
            "total_sources": len(sources_raw),
        },
        "regions": regions_raw,
        "macro_regions": list(region_meta.values()),
        "sources": sources_raw,
        "indicators": indicators_out,
        "observations": {k: v for k, v in obs_by_ind.items()},
        "featured_insights": insights_out[:6],
    }

    APP_DATA_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(APP_DATA_JSON, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))

    # Also write split lightweight bundles so each Next.js route only ships the exact data slice it needs
    summary_bundle = {k: v for k, v in bundle.items() if k != "observations"}
    # Keep latest provincial year observations for homepage showcase tabs only (~200 rows)
    showcase_obs = {}
    for ind in indicators_out:
        iid = ind["indicator_id"]
        lpy = ind["latest_provincial_year"]
        if lpy is not None:
            showcase_obs[iid] = [r for r in obs_by_ind.get(iid, []) if r["year"] == lpy]
    summary_bundle["observations"] = showcase_obs
    with open(APP_DATA_JSON.parent / "atlas-summary.json", "w", encoding="utf-8") as f:
        json.dump(summary_bundle, f, ensure_ascii=False, separators=(",", ":"))

    # Per-indicator full observation slices
    ind_dir = APP_DATA_JSON.parent / "indicators"
    ind_dir.mkdir(parents=True, exist_ok=True)
    for iid, rows in obs_by_ind.items():
        with open(ind_dir / f"{iid}.json", "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))

    # Compact cross-indicator numeric matrix for /explore (only provincial geo_code, year, value)
    explore_obs = {}
    for iid, rows in obs_by_ind.items():
        explore_obs[iid] = [
            {"geo_code": r["geo_code"], "geo_level": r["geo_level"], "year": r["year"], "value": r["value"]}
            for r in rows
            if r["geo_level"] == "provincial"
        ]
    explore_bundle = {
        "generated_at": bundle["generated_at"],
        "platform": bundle["platform"],
        "regions": bundle["regions"],
        "macro_regions": bundle["macro_regions"],
        "sources": bundle["sources"],
        "indicators": indicators_out,
        "observations": explore_obs,
        "featured_insights": [],
    }
    with open(APP_DATA_JSON.parent / "atlas-explore.json", "w", encoding="utf-8") as f:
        json.dump(explore_bundle, f, ensure_ascii=False, separators=(",", ":"))

    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OBS_CSV, PUBLIC_DATA_DIR / "observations.csv")

    data_dict = {
        "schema_version": "1.0.0",
        "generated_at": bundle["generated_at"],
        "file": "observations.csv",
        "encoding": "UTF-8",
        "missing_value_representation": "empty string (never 0)",
        "columns": [
            {"name": "indicator_id", "type": "string", "description_zh": "统一指标唯一标识"},
            {"name": "indicator_name_zh", "type": "string", "description_zh": "指标中文标准名称"},
            {"name": "indicator_name_en", "type": "string", "description_zh": "指标英文名称"},
            {"name": "geo_code", "type": "string", "description_zh": "行政区划代码（000000为全国，110000-650000遵循GB/T 2260省级代码）"},
            {"name": "geo_name_zh", "type": "string", "description_zh": "地区中文全称"},
            {"name": "geo_name_en", "type": "string", "description_zh": "地区英文名称"},
            {"name": "geo_level", "type": "enum(national|provincial)", "description_zh": "行政层级：全国或省级"},
            {"name": "year", "type": "integer", "description_zh": "实际统计年份（非发布年份）"},
            {"name": "value", "type": "number|null", "description_zh": "机器可读统计数值；缺失保留为空"},
            {"name": "unit", "type": "string", "description_zh": "标准化基准单位"},
            {"name": "source_id", "type": "string", "description_zh": "数据来源编号（关联sources.csv）"},
            {"name": "source_agency", "type": "string", "description_zh": "官方发布机构"},
            {"name": "source_url", "type": "url", "description_zh": "官方原始来源链接"},
            {"name": "source_table", "type": "string", "description_zh": "原始统计表格或公报名称"},
            {"name": "source_locator", "type": "string", "description_zh": "原始表内定位信息（表号/行列/代码）"},
            {"name": "publication_date", "type": "ISO-8601 date", "description_zh": "官方发布日期"},
            {"name": "retrieved_at", "type": "ISO-8601 datetime", "description_zh": "数据获取时间（UTC）"},
            {"name": "data_status", "type": "enum(final|preliminary|revised|unknown)", "description_zh": "数据状态（终核/初步/修订/未知）"},
            {"name": "methodology_version", "type": "string", "description_zh": "统计口径与核算版本标识"},
            {"name": "transformation", "type": "string", "description_zh": "单位换算或处理规则说明"},
            {"name": "verification_status", "type": "enum(verified|partially_verified|unverified)", "description_zh": "核验状态"},
            {"name": "notes", "type": "string", "description_zh": "口径说明、修订注释与已知局限"},
        ],
    }
    with open(PUBLIC_DATA_DIR / "data-dictionary.json", "w", encoding="utf-8") as f:
        json.dump(data_dict, f, ensure_ascii=False, indent=2)

    print(f"Built DuckDB ({DUCKDB_PATH.name}), Parquet ({PARQUET_PATH.name}), and frontend bundle ({APP_DATA_JSON.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build_duckdb_and_parquet()
    build_frontend_bundle()
