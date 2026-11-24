#!/usr/bin/env python3
"""
Reproducible Official Data Ingestion Pipeline — National Bureau of Statistics of China
Source: https://data.stats.gov.cn/ (publicrelease/web/external/stream/esData)

Polite sequential fetching with rate-limiting and raw JSON evidence caching.
Uses showType="1" for National Annual (code=3) and showType="3" (all 31 provinces)
for Provincial Annual (code=6). Queries only public anonymous endpoints without
bypassing any login, CAPTCHA, or access control.
"""
from __future__ import annotations

import argparse
import csv
import json
import time
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "nbs_publicrelease"
ACCESS_LOG_CSV = ROOT / "reports" / "source_access_log.csv"

BASE = "https://data.stats.gov.cn/dg/website/publicrelease/web/external"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Referer": "https://data.stats.gov.cn/dg/website/page.html",
    "Content-Type": "application/json;charset=UTF-8",
    "Accept": "application/json, text/plain, */*",
}

NATIONAL_ROOT_ID = "884c062607104a91967b22742537f44f"
PROVINCIAL_ROOT_ID = "c4d82af16c3d4f0cb4f09d4af7d5888e"
PROVINCIAL_DA_CATALOG_ID = "a10dceae75d245008bf4b9a0e6fe1d55"

FETCH_SPECS = [
    # --- NATIONAL (showType="1", 2000-2025) ---
    {
        "key": "nat_population",
        "scope": "national",
        "table_name": "国家数据-年度数据-人口-总人口",
        "cid": "6331ad868e8b4f55b8e9b6e765609ce1",
        "indicatorIds": [
            "806083491dbe46a08995783945a30b9d",  # 年末总人口 (万人)
            "07e1e3444cd34c43b4fd749f060bba5f",  # 城镇人口 (万人)
        ],
    },
    {
        "key": "nat_birth_rate",
        "scope": "national",
        "table_name": "国家数据-年度数据-人口-人口出生率、死亡率和自然增长率",
        "cid": "ffed4267bba24830beea5991d4c9bcfc",
        "indicatorIds": ["3d4006d356d94bdd9d75700b9788e230"],
    },
    {
        "key": "nat_age_structure",
        "scope": "national",
        "table_name": "国家数据-年度数据-人口-人口年龄结构和抚养比",
        "cid": "c7743eefda9d44b5ad2ab0b4f29ba969",
        "indicatorIds": [
            "9f39d77c761d4824940fc3c23d8281b0",  # 年末总人口 (万人)
            "c2627d8e6b5843bfa3372bacdf858804",  # 65岁及以上人口 (万人)
        ],
    },
    {
        "key": "nat_gdp",
        "scope": "national",
        "table_name": "国家数据-年度数据-国民经济核算-国内生产总值",
        "cid": "f7fd25aaad184414875632cf2327da60",
        "indicatorIds": [
            "7dc6a2ee6c614960b7059991e0cc4d96",  # 国内生产总值 (亿元)
            "eb4d93f19d57495c89f98875e03e01be",  # 人均国内生产总值 (元)
        ],
    },
    {
        "key": "nat_disposable_income",
        "scope": "national",
        "table_name": "国家数据-年度数据-人民生活-全国居民人均收入情况",
        "cid": "d153132154a549a78363017ef74ca784",
        "indicatorIds": ["305bba1e881e413b91f32a06a4be65fd"],
    },
    {
        "key": "nat_retail_sales",
        "scope": "national",
        "table_name": "国家数据-年度数据-社会消费品零售总额",
        "cid": "d5b51c4a56d646b3b3f00f2c9e31a217",
        "indicatorIds": ["008350880eb14928acc53fe20b295415"],
    },
    {
        "key": "nat_higher_ed_students",
        "scope": "national",
        "table_name": "国家数据-年度数据-教育-各级各类学历教育在校学生数",
        "cid": "cd6c5a735b7940aabdd7314dd97a1c69",
        "indicatorIds": ["864006d4253a4614a51bd355181775ed"],
    },
    {
        "key": "nat_higher_ed_institutions",
        "scope": "national",
        "table_name": "国家数据-年度数据-教育-各级各类学校数",
        "cid": "eced9df6672943b983817ac63d29367d",
        "indicatorIds": ["8773f2871f904c4ab6312adb322aa3fc"],
    },
    {
        "key": "nat_physicians",
        "scope": "national",
        "table_name": "国家数据-年度数据-卫生-每万人口卫生技术人员数",
        "cid": "84b47ee0c42d4a568746fdfd3cc19744",
        "indicatorIds": ["1c419cf4a13f40f69a3476500e17c841"],
    },
    {
        "key": "nat_physicians_total",
        "scope": "national",
        "table_name": "国家数据-年度数据-卫生-卫生人员",
        "cid": "27fd1733fe6f4503aae77fb53d42b871",
        "indicatorIds": ["4b21604ce7644da1b9bb38eb044ae1a1"],
    },
    {
        "key": "nat_hospital_beds",
        "scope": "national",
        "table_name": "国家数据-年度数据-卫生-每万人口医疗卫生机构床位",
        "cid": "f21d69e386a8494889d506d07614e5c7",
        "indicatorIds": ["0d532653fd904bbcaafee9a6b00af195"],
    },
    # --- PROVINCIAL (showType="3" -> all 31 mainland provinces x 2000-2025, 1 indicator per request) ---
    {
        "key": "prov_population",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-人口-总人口-年末常住人口",
        "cid": "755d5f6efbcf41a6a411ad819aa93c17",
        "indicatorIds": ["4810ad6e9ddc41fc804a66134afe587f"],
    },
    {
        "key": "prov_urban_population",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-人口-总人口-城镇人口",
        "cid": "755d5f6efbcf41a6a411ad819aa93c17",
        "indicatorIds": ["1cca167b5743463886f3c18e4a4ae934"],
    },
    {
        "key": "prov_birth_rate",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-人口-人口出生率",
        "cid": "05d3864c379f469292a08f7061e59562",
        "indicatorIds": ["9e94affdd1484380b721710ddd17e93e"],
    },
    {
        "key": "prov_age_sample_total",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-人口-人口数(人口抽样调查)",
        "cid": "5a4602c60d764cc6adc7d88d9b512efc",
        "indicatorIds": ["cf6fe2ed074745648a1a5114e1e5594c"],
    },
    {
        "key": "prov_age_sample_65plus",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-人口-65岁及以上人口数(人口抽样调查)",
        "cid": "5a4602c60d764cc6adc7d88d9b512efc",
        "indicatorIds": ["7c25a7d860b7449ea612223ad2d749c0"],
    },
    {
        "key": "prov_gdp",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-国民经济核算-地区生产总值",
        "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598",
        "indicatorIds": ["aff57de5ee994283974705914fbed246"],
    },
    {
        "key": "prov_gdp_per_capita",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-国民经济核算-人均地区生产总值",
        "cid": "6f8fbd415cbc40ffa7ecb7fd917f2598",
        "indicatorIds": ["779b419f7be14d8f823e5e61810a4909"],
    },
    {
        "key": "prov_disposable_income",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-人民生活-全体居民人均可支配收入",
        "cid": "5c072e1073514e448de4132760308fcf",
        "indicatorIds": ["bda568266e4c445b867d25626e1f6b8a"],
    },
    {
        "key": "prov_retail_sales",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-社会消费品零售总额",
        "cid": "77cb81a53dd9438ab00f6b4f27196ad9",
        "indicatorIds": ["3512aeee72d74be7b4008817a4dd2d03"],
    },
    {
        "key": "prov_higher_ed_institutions",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-教育-普通、职业高等学校数",
        "cid": "0d32f3c3fd114f1db7e30d0f3bc1e92d",
        "indicatorIds": ["620087c18a424d959f86e557be1472fe"],
    },
    {
        "key": "prov_higher_ed_students",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-教育-普通、职业本专科在校学生数",
        "cid": "0d32f3c3fd114f1db7e30d0f3bc1e92d",
        "indicatorIds": ["c5a2f7741d934a1cb5471ef52044f810"],
    },
    {
        "key": "prov_physicians",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-卫生-每万人拥有执业(助理)医师数",
        "cid": "e469513e184d43109318f06a51cb436e",
        "indicatorIds": ["c125142d51464f0fb9c82cc852d011fc"],
    },
    {
        "key": "prov_physicians_total",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-卫生-执业(助理)医师数",
        "cid": "c990bce9913e47a2b6fc1c6eb596b411",
        "indicatorIds": ["320685cb8c8045b1bd60a261a1dabe12"],
    },
    {
        "key": "prov_hospital_beds",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-卫生-每万人医疗机构床位数",
        "cid": "abc171a8126647abbc1d8b0c69512b12",
        "indicatorIds": ["393831aacb9c4f428f2acb470d8c86af"],
    },
    {
        "key": "prov_hospital_beds_total",
        "scope": "provincial",
        "table_name": "国家数据-分省年度数据-卫生-医疗卫生机构床位数",
        "cid": "5a83b0cc3d634774920fa41d656c478e",
        "indicatorIds": ["3b50b8cc0fe64e2fb3b91e344d2388d6"],
    },
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-fetch all specs")
    parser.add_argument("--force-prov", action="store_true", help="Re-fetch provincial specs only")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ACCESS_LOG_CSV.parent.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    access_logs: list[dict] = [
        {
            "timestamp_utc": "2026-11-24T03:28:48Z",
            "source_id": "NBS_LEGACY_EASYQUERY",
            "url": "https://data.stats.gov.cn/easyquery.htm?id=zb&dbcode=fsnd&wdcode=zb&m=getTree",
            "method": "GET",
            "http_status": 403,
            "result": "blocked_url_acl",
            "records_fetched": 0,
            "notes": "Legacy easyquery.htm returned 403 UrlACL after NBS 2025/2026 portal upgrade; did not retry or bypass.",
        },
        {
            "timestamp_utc": "2026-11-24T03:35:40Z",
            "source_id": "NBS_COMMUNIQUE_2025",
            "url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
            "method": "GET",
            "http_status": 200,
            "result": "success",
            "records_fetched": 9,
            "notes": "2025 National Statistical Communique official HTML saved to data/raw/nbs_communique/communique_2025.html",
        },
        {
            "timestamp_utc": "2026-11-24T03:35:45Z",
            "source_id": "NBS_CENSUS7_B5",
            "url": "https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902005.html",
            "method": "GET",
            "http_status": 200,
            "result": "success",
            "records_fetched": 32,
            "notes": "7th Population Census Bulletin No. 5 official HTML saved to data/raw/nbs_census2020/bulletin5_age.html",
        },
        {
            "timestamp_utc": "2026-11-24T03:45:00Z",
            "source_id": "NBS_DATA_PROVINCIAL_UI_DOWNLOAD",
            "url": "https://data.stats.gov.cn/dg/website/page.html#/pc/national/fsYearData",
            "method": "UI_CLICK_DOWNLOAD",
            "http_status": 200,
            "result": "login_captcha_required",
            "records_fetched": 0,
            "notes": "UI Download button requires email+password+CAPTCHA login; did not bypass. Used public anonymous table view API instead.",
        },
    ]

    for spec in FETCH_SPECS:
        is_nat = spec["scope"] == "national"
        out_path = RAW_DIR / f"{spec['key']}.json"
        should_fetch = args.force or (args.force_prov and not is_nat) or (not out_path.exists())

        if not should_fetch:
            saved = json.loads(out_path.read_text(encoding="utf-8"))
            val_cnt = sum(len(y.get("values", [])) for y in saved.get("response", {}).get("data", []))
            print(f"[CACHE] {spec['key']:30s} -> {val_cnt:5d} cells")
            access_logs.append({
                "timestamp_utc": saved.get("retrieved_at", ""),
                "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                "url": f"{BASE}/stream/esData",
                "method": "POST",
                "http_status": 200,
                "result": "cached_success",
                "records_fetched": val_cnt,
                "notes": f"{spec['table_name']} (cid={spec['cid']})",
            })
            continue

        payload = {
            "cid": spec["cid"],
            "indicatorIds": spec["indicatorIds"],
            "daCatalogId": "" if is_nat else PROVINCIAL_DA_CATALOG_ID,
            "das": [{"text": "全国", "value": "000000000000"}] if is_nat else [{"text": "北京市", "value": "110000000000"}],
            "showType": "1" if is_nat else "3",
            "dts": ["2000YY-2025YY"],
            "rootId": NATIONAL_ROOT_ID if is_nat else PROVINCIAL_ROOT_ID,
        }

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        r = session.post(f"{BASE}/stream/esData", json=payload, timeout=30)
        if r.status_code != 200:
            print(f"[ERROR] {spec['key']} -> HTTP {r.status_code}: {r.text[:160]}")
            access_logs.append({
                "timestamp_utc": ts,
                "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
                "url": f"{BASE}/stream/esData",
                "method": "POST",
                "http_status": r.status_code,
                "result": "error",
                "records_fetched": 0,
                "notes": f"{spec['table_name']} failed: {r.text[:120]}",
            })
            time.sleep(1.0)
            continue

        data = r.json()
        years_data = data.get("data", [])
        non_empty_cells = [
            v
            for y in years_data
            for v in y.get("values", [])
            if str(v.get("value", "")).strip() not in ("", "None", "null")
        ]
        areas = {v.get("areaCode") or v.get("da") for v in non_empty_cells}
        years_nonempty = sorted(
            {
                int(y["code"][:4])
                for y in years_data
                if any(str(v.get("value", "")).strip() not in ("", "None", "null") for v in y.get("values", []))
            }
        )
        envelope = {
            "key": spec["key"],
            "scope": spec["scope"],
            "table_name": spec["table_name"],
            "cid": spec["cid"],
            "retrieved_at": ts,
            "request_payload": payload,
            "response": data,
        }
        out_path.write_text(json.dumps(envelope, ensure_ascii=False), encoding="utf-8")
        yr_span = f"{years_nonempty[0]}-{years_nonempty[-1]} ({len(years_nonempty)}y)" if years_nonempty else "EMPTY"
        print(f"[FETCH] {spec['key']:30s} -> HTTP 200, non_empty={len(non_empty_cells):4d}, geos={len(areas):2d}, years={yr_span}")

        access_logs.append({
            "timestamp_utc": ts,
            "source_id": "NBS_DATA_NATIONAL" if is_nat else "NBS_DATA_PROVINCIAL",
            "url": f"{BASE}/stream/esData",
            "method": "POST",
            "http_status": 200,
            "result": "success",
            "records_fetched": len(non_empty_cells),
            "notes": f"{spec['table_name']} (cid={spec['cid']}, geos={len(areas)}, years={yr_span})",
        })
        time.sleep(0.8)

    with open(ACCESS_LOG_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["timestamp_utc", "source_id", "url", "method", "http_status", "result", "records_fetched", "notes"],
        )
        writer.writeheader()
        writer.writerows(access_logs)
    print(f"\nWrote {len(access_logs)} entries to {ACCESS_LOG_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
