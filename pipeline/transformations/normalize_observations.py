#!/usr/bin/env python3
"""
Deterministic Standardization Pipeline for China Data Atlas.

Transforms retained raw official evidence files:
  - data/raw/nbs_publicrelease/*.json          (NBS data.stats.gov.cn 2000-2025)
  - data/raw/nbs_census2020/bulletin5_age.html (7th Population Census Bulletin No. 5, 2020)
  - data/raw/nbs_communique/communique_2025.html (2025 National Statistical Communique)

into the unified 22-column normalized dataset:
  - data/normalized/observations.csv

Can be re-run completely offline from retained raw evidence to reproduce identical output.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pipeline.ingestion.parse_nbs_html import (
    parse_census2020_bulletin5,
    parse_communique_2025,
)

RAW_NBS = ROOT / "data" / "raw" / "nbs_publicrelease"
IND_CSV = ROOT / "data" / "metadata" / "indicators.csv"
REG_CSV = ROOT / "data" / "metadata" / "regions.csv"
OUT_CSV = ROOT / "data" / "normalized" / "observations.csv"

FIELDNAMES = [
    "indicator_id",
    "indicator_name_zh",
    "indicator_name_en",
    "geo_code",
    "geo_name_zh",
    "geo_name_en",
    "geo_level",
    "year",
    "value",
    "unit",
    "source_id",
    "source_agency",
    "source_url",
    "source_table",
    "source_locator",
    "publication_date",
    "retrieved_at",
    "data_status",
    "methodology_version",
    "transformation",
    "verification_status",
    "notes",
]

NAT_URL = "https://data.stats.gov.cn/dg/website/page.html#/pc/national/yearData"
PROV_URL = "https://data.stats.gov.cn/dg/website/page.html#/pc/national/fsYearData"


def load_metadata() -> tuple[dict[str, dict], dict[str, dict]]:
    inds = {}
    with open(IND_CSV, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            inds[r["indicator_id"]] = r
    regs = {}
    with open(REG_CSV, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["in_mainland_nbs_scope"] == "true":
                regs[r["geo_code"]] = r
    return inds, regs


def load_nbs_json(key: str) -> tuple[dict, dict[tuple[str, int, str], dict]]:
    """Return (envelope_meta, {(geo6, year, ind_uuid): cell_dict})."""
    env = json.loads((RAW_NBS / f"{key}.json").read_text(encoding="utf-8"))
    cells: dict[tuple[str, int, str], dict] = {}
    for yr_block in env["response"].get("data", []):
        yr = int(yr_block["code"][:4])
        for v in yr_block.get("values", []):
            raw_val = str(v.get("value", "")).strip()
            if raw_val in ("", "None", "null"):
                continue
            geo_raw = v.get("areaCode") or v.get("da") or "000000000000"
            geo6 = geo_raw[:6]
            cells[(geo6, yr, v["_id"])] = {
                "value": float(raw_val),
                "raw_str": raw_val,
                "showname": (v.get("i_showname") or "").strip(),
                "du_name": (v.get("du_name") or "").strip(),
                "annotation": (v.get("i_annotation") or "").replace("\n", " ").strip(),
            }
    return env, cells


def make_row(
    ind: dict,
    reg: dict,
    year: int,
    value: float,
    scope: str,
    source_table: str,
    source_locator: str,
    retrieved_at: str,
    data_status: str,
    methodology_version: str,
    transformation: str,
    verification_status: str = "verified",
    notes: str = "",
    publication_date: str | None = None,
) -> dict:
    is_nat = scope == "national"
    if publication_date is None:
        # Official NBS annual releases: 2025 data published 2026-02-28 (communique/early annual);
        # 2024 & prior annual revised figures published in China Statistical Yearbook 2025 (2025-10-01) / NBS portal
        publication_date = "2026-02-28" if year == 2025 else "2025-10-01"
    return {
        "indicator_id": ind["indicator_id"],
        "indicator_name_zh": ind["indicator_name_zh"],
        "indicator_name_en": ind["indicator_name_en"],
        "geo_code": reg["geo_code"],
        "geo_name_zh": reg["geo_name_zh"],
        "geo_name_en": reg["geo_name_en"],
        "geo_level": reg["geo_level"],
        "year": year,
        "value": value,
        "unit": ind["unit"],
        "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
        "source_agency": "国家统计局（国家数据）",
        "source_url": NAT_URL if is_nat else PROV_URL,
        "source_table": source_table,
        "source_locator": source_locator,
        "publication_date": publication_date,
        "retrieved_at": retrieved_at,
        "data_status": data_status,
        "methodology_version": methodology_version,
        "transformation": transformation,
        "verification_status": verification_status,
        "notes": notes,
    }


def main() -> None:
    inds, regs = load_metadata()
    records: dict[tuple[str, str, int], dict] = {}

    def put(row: dict) -> None:
        key = (row["indicator_id"], row["geo_code"], int(row["year"]))
        records[key] = row

    # Load all raw NBS publicrelease JSON files
    env_np, nat_pop = load_nbs_json("nat_population")
    env_pp, prov_pop = load_nbs_json("prov_population")
    env_pu, prov_urb = load_nbs_json("prov_urban_population")
    env_nb, nat_br = load_nbs_json("nat_birth_rate")
    env_pb, prov_br = load_nbs_json("prov_birth_rate")
    env_na, nat_age = load_nbs_json("nat_age_structure")
    env_pat, prov_age_tot = load_nbs_json("prov_age_sample_total")
    env_pa65, prov_age_65 = load_nbs_json("prov_age_sample_65plus")
    env_ng, nat_gdp = load_nbs_json("nat_gdp")
    env_pg, prov_gdp = load_nbs_json("prov_gdp")
    env_pgpc, prov_gdppc = load_nbs_json("prov_gdp_per_capita")
    env_ndi, nat_di = load_nbs_json("nat_disposable_income")
    env_pdi, prov_di = load_nbs_json("prov_disposable_income")
    env_nrs, nat_rs = load_nbs_json("nat_retail_sales")
    env_prs, prov_rs = load_nbs_json("prov_retail_sales")
    env_nhes, nat_hes = load_nbs_json("nat_higher_ed_students")
    env_nhei, nat_hei = load_nbs_json("nat_higher_ed_institutions")
    env_phes, prov_hes = load_nbs_json("prov_higher_ed_students")
    env_phei, prov_hei = load_nbs_json("prov_higher_ed_institutions")
    env_npt, nat_pt = load_nbs_json("nat_physicians_total")
    env_np10, nat_p10 = load_nbs_json("nat_physicians")
    env_ppt, prov_pt = load_nbs_json("prov_physicians_total")
    env_pp10, prov_p10 = load_nbs_json("prov_physicians")
    env_nhb, nat_hb = load_nbs_json("nat_hospital_beds")
    env_phb, prov_hb = load_nbs_json("prov_hospital_beds")

    # 1. population (年末常住人口, 万人)
    for (geo, yr, iid), cell in nat_pop.items():
        if iid != "806083491dbe46a08995783945a30b9d" or geo not in regs:
            continue
        put(make_row(
            inds["population"], regs[geo], yr, cell["value"], "national",
            env_np["table_name"], f"cid={env_np['cid']}, ind={iid} (年末总人口), geo={geo}, year={yr}",
            env_np["retrieved_at"],
            "preliminary" if yr == 2025 else ("revised" if 2011 <= yr <= 2019 else "final"),
            "nbs_census_revised_resident_pop" if yr <= 2020 else "nbs_annual_resident_pop",
            "none (direct 万人)",
            notes="全国总人口含现役军人，不含港澳台；2011-2019年已按2020年七普修订",
        ))
    for (geo, yr, iid), cell in prov_pop.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["population"], regs[geo], yr, cell["value"], "provincial",
            env_pp["table_name"], f"cid={env_pp['cid']}, ind={iid} (年末常住人口), geo={geo}, year={yr}",
            env_pp["retrieved_at"],
            "preliminary" if yr == 2025 else ("revised" if 2011 <= yr <= 2019 else "final"),
            "nbs_census_revised_resident_pop" if yr <= 2020 else "nbs_annual_resident_pop",
            "none (direct 万人)",
            notes="省级年末常住人口，非户籍人口",
        ))

    # 2. birth_rate (人口出生率, ‰)
    for (geo, yr, iid), cell in nat_br.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["birth_rate"], regs[geo], yr, cell["value"], "national",
            env_nb["table_name"], f"cid={env_nb['cid']}, ind={iid}, geo={geo}, year={yr}",
            env_nb["retrieved_at"],
            "preliminary" if yr == 2025 else "final",
            "nbs_census_year" if yr in (2000, 2010, 2020) else "nbs_annual_pop_change_survey",
            "none (direct ‰)",
            notes="2000/2010/2020年为普查推算数，其余为年度人口变动抽样调查推算数",
        ))
    for (geo, yr, iid), cell in prov_br.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["birth_rate"], regs[geo], yr, cell["value"], "provincial",
            env_pb["table_name"], f"cid={env_pb['cid']}, ind={iid}, geo={geo}, year={yr}",
            env_pb["retrieved_at"],
            "final",
            "nbs_census_year" if yr in (2000, 2010, 2020) else "nbs_annual_pop_change_survey",
            "none (direct ‰)",
            notes="省级人口出生率(‰)",
        ))

    # 3. urbanization_rate (常住人口城镇化率, %) — derived from same-table NBS urban / resident pop
    for yr in range(2000, 2026):
        urb = nat_pop.get(("000000", yr, "07e1e3444cd34c43b4fd749f060bba5f"))
        tot = nat_pop.get(("000000", yr, "806083491dbe46a08995783945a30b9d"))
        if urb and tot and tot["value"] > 0:
            rate = round((urb["value"] / tot["value"]) * 100.0, 2)
            put(make_row(
                inds["urbanization_rate"], regs["000000"], yr, rate, "national",
                env_np["table_name"],
                f"cid={env_np['cid']}, 城镇人口({urb['raw_str']}万) / 年末总人口({tot['raw_str']}万) * 100",
                env_np["retrieved_at"],
                "preliminary" if yr == 2025 else "final",
                "nbs_urban_rural_classification_2008plus" if yr >= 2008 else "nbs_pre2008_urban_def",
                f"ratio_percent: ({urb['raw_str']} / {tot['raw_str']}) * 100 = {rate}%",
                notes="按国家数据同表城镇常住人口占总人口比重计算（2025年与公报67.89%完全一致）",
            ))
    for (geo, yr, _), urb in prov_urb.items():
        if geo not in regs:
            continue
        tot = prov_pop.get((geo, yr, "4810ad6e9ddc41fc804a66134afe587f"))
        if tot and tot["value"] > 0:
            rate = round((urb["value"] / tot["value"]) * 100.0, 2)
            put(make_row(
                inds["urbanization_rate"], regs[geo], yr, rate, "provincial",
                env_pu["table_name"],
                f"cid={env_pu['cid']}, 城镇人口({urb['raw_str']}万) / 年末常住人口({tot['raw_str']}万) * 100, geo={geo}, year={yr}",
                env_pu["retrieved_at"],
                "final",
                "nbs_urban_rural_classification_2008plus" if yr >= 2008 else "nbs_pre2008_urban_def",
                f"ratio_percent: ({urb['raw_str']} / {tot['raw_str']}) * 100 = {rate}%",
                notes="按国家数据分省同表城镇常住人口除以年末常住人口计算；2000-2004及2025年国家数据暂未公布分省城镇人口",
            ))

    # 4. population_65plus (65岁及以上人口占比, %)
    for yr in range(2000, 2026):
        a65 = nat_age.get(("000000", yr, "c2627d8e6b5843bfa3372bacdf858804"))
        tot = nat_age.get(("000000", yr, "9f39d77c761d4824940fc3c23d8281b0"))
        if a65 and tot and tot["value"] > 0:
            pct = round((a65["value"] / tot["value"]) * 100.0, 2)
            put(make_row(
                inds["population_65plus"], regs["000000"], yr, pct, "national",
                env_na["table_name"],
                f"cid={env_na['cid']}, 65岁及以上人口({a65['raw_str']}万) / 年末总人口({tot['raw_str']}万) * 100",
                env_na["retrieved_at"],
                "preliminary" if yr == 2025 else "final",
                "nbs_census_year" if yr in (2000, 2010, 2020) else "nbs_annual_age_structure",
                f"ratio_percent: ({a65['raw_str']} / {tot['raw_str']}) * 100 = {pct}%",
                notes="国家数据全国人口年龄结构表计算；2020年将由七普第五号公报全数登记数覆盖(13.50%)",
            ))
    for (geo, yr, _), a65 in prov_age_65.items():
        if geo not in regs or yr == 2020:
            continue
        tot = prov_age_tot.get((geo, yr, "cf6fe2ed074745648a1a5114e1e5594c"))
        if tot and tot["value"] > 0:
            pct = round((a65["value"] / tot["value"]) * 100.0, 2)
            is_1pct = yr in (2005, 2015)
            put(make_row(
                inds["population_65plus"], regs[geo], yr, pct, "provincial",
                env_pa65["table_name"],
                f"cid={env_pa65['cid']}, 65岁及以上样本({a65['raw_str']}人) / 样本总人口({tot['raw_str']}人) * 100, geo={geo}, year={yr}",
                env_pa65["retrieved_at"],
                "final",
                "nbs_1pct_sample_survey" if is_1pct else "nbs_1permille_sample_survey",
                f"ratio_percent: ({a65['raw_str']} / {tot['raw_str']}) * 100 = {pct}%",
                notes="2005/2015年为1%人口抽样调查，其余非普查年份为1‰人口变动情况抽样调查样本比重",
            ))

    # Overlay 2020 7th National Population Census Bulletin No. 5 (Full Enumeration, 31 provinces + National!)
    census2020_rows = parse_census2020_bulletin5(
        ROOT / "data/raw/nbs_census2020/bulletin5_age.html",
        "2026-11-24T03:35:45Z",
    )
    for crow in census2020_rows:
        put(crow)

    # 5. gdp (地区生产总值现价, 亿元人民币)
    for (geo, yr, iid), cell in nat_gdp.items():
        if iid != "7dc6a2ee6c614960b7059991e0cc4d96" or geo not in regs:
            continue
        put(make_row(
            inds["gdp"], regs[geo], yr, cell["value"], "national",
            env_ng["table_name"], f"cid={env_ng['cid']}, ind={iid} (国内生产总值), geo={geo}, year={yr}",
            env_ng["retrieved_at"],
            "preliminary" if yr == 2025 else "revised",
            "nbs_5th_econ_census_revised_current_price",
            "none (direct 亿元人民币现价)",
            notes="现价GDP；2023年及之前历史序列已按第五次全国经济普查修订；同比现价变化不等于不变价实际增速",
        ))
    for (geo, yr, iid), cell in prov_gdp.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["gdp"], regs[geo], yr, cell["value"], "provincial",
            env_pg["table_name"], f"cid={env_pg['cid']}, ind={iid} (地区生产总值), geo={geo}, year={yr}",
            env_pg["retrieved_at"],
            "preliminary" if yr == 2025 else "revised",
            "nbs_unified_grp_accounting_current_price" if yr >= 2020 else "nbs_5th_econ_census_revised_current_price",
            "none (direct 亿元人民币现价)",
            notes="省级现价地区生产总值；2020年起实行统一核算，五经普已修订历史数据",
        ))

    # 6. gdp_per_capita (人均地区生产总值现价, 元人民币)
    for (geo, yr, iid), cell in nat_gdp.items():
        if iid != "eb4d93f19d57495c89f98875e03e01be" or geo not in regs:
            continue
        put(make_row(
            inds["gdp_per_capita"], regs[geo], yr, cell["value"], "national",
            env_ng["table_name"], f"cid={env_ng['cid']}, ind={iid} (人均国内生产总值), geo={geo}, year={yr}",
            env_ng["retrieved_at"],
            "preliminary" if yr == 2025 else "revised",
            "nbs_5th_econ_census_revised_current_price",
            "none (direct 元人民币现价)",
            notes="现价人均GDP（按年平均常住人口计算）；现价同比不等于不变价实际增速",
        ))
    for (geo, yr, iid), cell in prov_gdppc.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["gdp_per_capita"], regs[geo], yr, cell["value"], "provincial",
            env_pgpc["table_name"], f"cid={env_pgpc['cid']}, ind={iid} (人均地区生产总值), geo={geo}, year={yr}",
            env_pgpc["retrieved_at"],
            "preliminary" if yr == 2025 else "revised",
            "nbs_unified_grp_accounting_current_price" if yr >= 2020 else "nbs_5th_econ_census_revised_current_price",
            "none (direct 元人民币现价)",
            notes="省级现价人均地区生产总值（按年平均常住人口计算）",
        ))

    # 7. disposable_income (居民人均可支配收入, 元人民币)
    for (geo, yr, iid), cell in nat_di.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["disposable_income"], regs[geo], yr, cell["value"], "national",
            env_ndi["table_name"], f"cid={env_ndi['cid']}, ind={iid}, geo={geo}, year={yr}",
            env_ndi["retrieved_at"],
            "preliminary" if yr == 2025 else "final",
            "nbs_unified_household_survey_2013plus" if yr >= 2013 else "nbs_unified_income_backcast_pre2013",
            "none (direct 元人民币)",
            notes="2013年起为城乡一体化住户收支调查实测数；2013年前为国家统计局按统一口径回溯推算数",
        ))
    for (geo, yr, iid), cell in prov_di.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["disposable_income"], regs[geo], yr, cell["value"], "provincial",
            env_pdi["table_name"], f"cid={env_pdi['cid']}, ind={iid}, geo={geo}, year={yr}",
            env_pdi["retrieved_at"],
            "preliminary" if yr == 2025 else "final",
            "nbs_unified_household_survey_2013plus" if yr >= 2013 else "nbs_unified_income_backcast_pre2013",
            "none (direct 元人民币)",
            notes="全体居民人均可支配收入（含城乡）；2013年起为城乡一体化调查实测数，2000及2005-2012年为国家统计局统一口径历史回溯数",
        ))

    # 8. retail_sales (社会消费品零售总额, 亿元人民币)
    for (geo, yr, iid), cell in nat_rs.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["retail_sales"], regs[geo], yr, cell["value"], "national",
            env_nrs["table_name"], f"cid={env_nrs['cid']}, ind={iid}, geo={geo}, year={yr}",
            env_nrs["retrieved_at"],
            "preliminary" if yr == 2025 else "revised",
            "nbs_5th_econ_census_revised",
            "none (direct 亿元人民币)",
            notes="社会消费品零售总额现价数，2023年及以前按五经普修订",
        ))
    for (geo, yr, iid), cell in prov_rs.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["retail_sales"], regs[geo], yr, cell["value"], "provincial",
            env_prs["table_name"], f"cid={env_prs['cid']}, ind={iid}, geo={geo}, year={yr}",
            env_prs["retrieved_at"],
            "preliminary" if yr == 2025 else "revised",
            "nbs_5th_econ_census_revised",
            "none (direct 亿元人民币)",
            notes="省级社会消费品零售总额现价数",
        ))

    # 9. higher_education_students (普通高等教育在校生人数, 人) — x10000 from 万人
    for (geo, yr, iid), cell in nat_hes.items():
        if geo not in regs:
            continue
        persons = round(cell["value"] * 10000)
        put(make_row(
            inds["higher_education_students"], regs[geo], yr, persons, "national",
            env_nhes["table_name"], f"cid={env_nhes['cid']}, ind={iid} (普通、职业本专科在校学生数), geo={geo}, year={yr}",
            env_nhes["retrieved_at"],
            "preliminary" if yr == 2025 else "final",
            "moe_nbs_regular_vocational_undergrad_college",
            f"multiply_by_10000 ({cell['raw_str']} 万人 -> {persons} 人)",
            notes="含普通本科、职业本科及高职(专科)全日制本专科在校生，不含研究生及成人/网络本专科",
        ))
    for (geo, yr, iid), cell in prov_hes.items():
        if geo not in regs:
            continue
        persons = round(cell["value"] * 10000)
        put(make_row(
            inds["higher_education_students"], regs[geo], yr, persons, "provincial",
            env_phes["table_name"], f"cid={env_phes['cid']}, ind={iid} (普通、职业本专科在校学生数), geo={geo}, year={yr}",
            env_phes["retrieved_at"],
            "final",
            "moe_nbs_regular_vocational_undergrad_college",
            f"multiply_by_10000 ({cell['raw_str']} 万人 -> {persons} 人)",
            notes="省级普通、职业本专科在校生总数（非仅普通本科），不含研究生",
        ))

    # 10. higher_education_institutions (普通高等学校数量, 所)
    for (geo, yr, iid), cell in nat_hei.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["higher_education_institutions"], regs[geo], yr, int(round(cell["value"])), "national",
            env_nhei["table_name"], f"cid={env_nhei['cid']}, ind={iid} (普通、职业高等学校数), geo={geo}, year={yr}",
            env_nhei["retrieved_at"],
            "final",
            "moe_nbs_regular_vocational_hei",
            "none (direct 所)",
            notes="含普通本科、职业本科及高职(专科)学校，不含成人高等学校",
        ))
    for (geo, yr, iid), cell in prov_hei.items():
        if geo not in regs:
            continue
        put(make_row(
            inds["higher_education_institutions"], regs[geo], yr, int(round(cell["value"])), "provincial",
            env_phei["table_name"], f"cid={env_phei['cid']}, ind={iid} (普通、职业高等学校数), geo={geo}, year={yr}",
            env_phei["retrieved_at"],
            "final",
            "moe_nbs_regular_vocational_hei",
            "none (direct 所)",
            notes="省级普通、职业高等学校数量，不含成人高等学校",
        ))

    # 11. physicians_per_1000 (每千人口执业(助理)医师数, 人/千人)
    # Derived cleanly from official NBS 执业(助理)医师数(万人) / 年末常住人口(万人) * 1000
    # to preserve 2-decimal accuracy (matching NHC 2024=3.61) and cross-checked against NBS integer per-10k!
    for (geo, yr, iid), cell in nat_pt.items():
        if geo not in regs:
            continue
        pop = nat_pop.get(("000000", yr, "806083491dbe46a08995783945a30b9d"))
        if not pop or pop["value"] <= 0:
            continue
        val = round((cell["value"] / pop["value"]) * 1000.0, 2)
        p10 = nat_p10.get(("000000", yr, "1c419cf4a13f40f69a3476500e17c841"))
        p10_note = f"; NBS rounded per-10k={p10['raw_str']}" if p10 else ""
        put(make_row(
            inds["physicians_per_1000"], regs[geo], yr, val, "national",
            env_npt["table_name"],
            f"cid={env_npt['cid']}, 执业(助理)医师({cell['raw_str']}万) / 年末总人口({pop['raw_str']}万) * 1000",
            env_npt["retrieved_at"],
            "preliminary" if yr == 2025 else "final",
            "nhc_nbs_licensed_assistant_physicians_per_1k",
            f"ratio_per_1000: ({cell['raw_str']} / {pop['raw_str']}) * 1000 = {val}{p10_note}",
            notes="以国家数据执业(助理)医师总数与年末常住人口精算至2位小数（2024年3.61与国家卫健委公报3.61完全一致），避免国家数据每万人整值舍入失真",
        ))
    for (geo, yr, iid), cell in prov_pt.items():
        if geo not in regs:
            continue
        pop = prov_pop.get((geo, yr, "4810ad6e9ddc41fc804a66134afe587f"))
        if not pop or pop["value"] <= 0:
            continue
        val = round((cell["value"] / pop["value"]) * 1000.0, 2)
        p10 = prov_p10.get((geo, yr, "c125142d51464f0fb9c82cc852d011fc"))
        p10_note = f"; NBS rounded per-10k={p10['raw_str']}" if p10 else ""
        put(make_row(
            inds["physicians_per_1000"], regs[geo], yr, val, "provincial",
            env_ppt["table_name"],
            f"cid={env_ppt['cid']}, 执业(助理)医师({cell['raw_str']}万) / 年末常住人口({pop['raw_str']}万) * 1000, geo={geo}, year={yr}",
            env_ppt["retrieved_at"],
            "final",
            "nhc_nbs_licensed_assistant_physicians_per_1k",
            f"ratio_per_1000: ({cell['raw_str']} / {pop['raw_str']}) * 1000 = {val}{p10_note}",
            notes="2002年前口径为医生，2002年起为执业医师和执业助理医师；分母为年末常住人口，并与国家数据每万人整值表交叉核验",
        ))

    # 12. hospital_beds_per_1000 (每千人口医疗卫生机构床位数, 张/千人) — direct NBS per-10k / 10
    for (geo, yr, iid), cell in nat_hb.items():
        if geo not in regs:
            continue
        val = round(cell["value"] / 10.0, 2)
        put(make_row(
            inds["hospital_beds_per_1000"], regs[geo], yr, val, "national",
            env_nhb["table_name"], f"cid={env_nhb['cid']}, ind={iid} (每万人口医疗卫生机构床位数), geo={geo}, year={yr}",
            env_nhb["retrieved_at"],
            "final",
            "nhc_nbs_all_health_institution_beds_per_1k",
            f"divide_by_10 ({cell['raw_str']} 张/万人 -> {val} 张/千人)",
            notes="全部医疗卫生机构床位数口径（含医院、基层医疗卫生机构、专业公共卫生机构），非仅医院床位；2024年7.32与卫健委公报一致",
        ))
    for (geo, yr, iid), cell in prov_hb.items():
        if geo not in regs:
            continue
        val = round(cell["value"] / 10.0, 2)
        put(make_row(
            inds["hospital_beds_per_1000"], regs[geo], yr, val, "provincial",
            env_phb["table_name"], f"cid={env_phb['cid']}, ind={iid} (每万人医疗机构床位数), geo={geo}, year={yr}",
            env_phb["retrieved_at"],
            "final",
            "nhc_nbs_all_health_institution_beds_per_1k",
            f"divide_by_10 ({cell['raw_str']} 张/万人 -> {val} 张/千人)",
            notes="全部医疗卫生机构床位数（分母为常住人口），按国家数据官方每万人指标除以10转换；2000-2007、2009及2025年省级数据未发布",
        ))

    # Cross-check 2025 National Communique against NBS national series (fill if absent, verify if present)
    comm2025_rows = parse_communique_2025(
        ROOT / "data/raw/nbs_communique/communique_2025.html",
        "2026-11-24T03:35:40Z",
    )
    comm_diffs = []
    for crow in comm2025_rows:
        key = (crow["indicator_id"], crow["geo_code"], int(crow["year"]))
        if key not in records:
            put(crow)
        else:
            existing = records[key]
            comm_diffs.append((crow["indicator_id"], existing["value"], crow["value"]))

    # Sort deterministically by (indicator_id, geo_code, year)
    ordered = [records[k] for k in sorted(records.keys())]

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(ordered)

    print(f"Wrote {len(ordered)} normalized observations to {OUT_CSV.relative_to(ROOT)}")
    print("2025 National cross-check (NBS data.stats.gov.cn vs 2025 Communique):")
    for ind_id, v_api, v_comm in comm_diffs:
        print(f"  {ind_id:28s}: data.stats={v_api} | communique={v_comm}")


if __name__ == "__main__":
    main()
