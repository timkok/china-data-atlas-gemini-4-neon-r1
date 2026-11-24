#!/usr/bin/env python3
"""
Data Quality Gate & Coverage Matrix Generator for China Data Atlas.

Reads data/normalized/observations.csv, data/metadata/indicators.csv,
data/metadata/regions.csv, and data/metadata/sources.csv into DuckDB,
runs comprehensive quality checks per Section 6.1 & 6.3, and outputs:
  - reports/data_quality_report.json
  - reports/coverage_matrix.csv
"""
from __future__ import annotations

import csv
import json
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import duckdb

ROOT = Path(__file__).resolve().parents[2]
OBS_CSV = ROOT / "data" / "normalized" / "observations.csv"
IND_CSV = ROOT / "data" / "metadata" / "indicators.csv"
REG_CSV = ROOT / "data" / "metadata" / "regions.csv"
SRC_CSV = ROOT / "data" / "metadata" / "sources.csv"
QUALITY_REPORT = ROOT / "reports" / "data_quality_report.json"
COVERAGE_CSV = ROOT / "reports" / "coverage_matrix.csv"

REQUIRED_COLUMNS = [
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

VALID_DATA_STATUS = {"final", "preliminary", "revised", "unknown"}
VALID_VERIF_STATUS = {"verified", "partially_verified", "unverified"}
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$")

RANGE_BOUNDS = {
    "population": (100.0, 200000.0),          # 万人 (Tibet ~250 to National ~142000)
    "birth_rate": (1.0, 40.0),                # ‰
    "urbanization_rate": (10.0, 100.0),       # %
    "population_65plus": (2.0, 40.0),         # %
    "gdp": (50.0, 2000000.0),                 # 亿元
    "gdp_per_capita": (2000.0, 350000.0),     # 元
    "disposable_income": (1500.0, 150000.0),  # 元
    "retail_sales": (20.0, 700000.0),         # 亿元
    "higher_education_students": (5000.0, 60000000.0),  # 人
    "higher_education_institutions": (3.0, 5000.0),     # 所
    "physicians_per_1000": (0.5, 15.0),       # 人/千人
    "hospital_beds_per_1000": (1.0, 20.0),    # 张/千人
}


def load_csv_rows(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def run_quality_gate() -> dict:
    errors: list[dict] = []
    warnings: list[dict] = []

    indicators = {r["indicator_id"]: r for r in load_csv_rows(IND_CSV)}
    regions = {r["geo_code"]: r for r in load_csv_rows(REG_CSV)}
    valid_mainland_provinces = {
        r["geo_code"]
        for r in regions.values()
        if r["geo_level"] == "provincial" and r["in_mainland_nbs_scope"] == "true"
    }
    sources = {r["source_id"]: r for r in load_csv_rows(SRC_CSV)} if SRC_CSV.exists() else {}

    with open(OBS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        missing_cols = [c for c in REQUIRED_COLUMNS if c not in header]
        if missing_cols:
            errors.append({"check": "schema_columns", "message": f"Missing required columns: {missing_cols}"})
        rows = list(reader)

    seen_keys: dict[tuple, int] = {}
    valid_obs_count = 0
    verified_obs_count = 0
    by_ind_geo: dict[tuple[str, str], list[tuple[int, float, str]]] = defaultdict(list)
    by_ind_year_prov: dict[tuple[str, int], dict[str, dict]] = defaultdict(dict)
    by_ind_year_nat: dict[tuple[str, int], dict] = {}
    years_present: set[int] = set()
    active_sources: set[str] = set()

    for idx, row in enumerate(rows, start=2):
        ind_id = row["indicator_id"]
        geo_code = row["geo_code"]
        year_str = row["year"]
        val_str = row["value"].strip()

        # 1. Indicator & Region existence
        if ind_id not in indicators:
            errors.append({"check": "indicator_id", "line": idx, "message": f"Unknown indicator_id: {ind_id}"})
            continue
        ind_meta = indicators[ind_id]

        if geo_code not in regions or regions[geo_code]["in_mainland_nbs_scope"] != "true":
            errors.append({"check": "geo_code", "line": idx, "message": f"Invalid or out-of-scope geo_code: {geo_code}"})
            continue
        reg_meta = regions[geo_code]
        if row["geo_level"] != reg_meta["geo_level"]:
            errors.append({"check": "geo_level", "line": idx, "message": f"geo_level mismatch for {geo_code}"})

        # 2. Year validity
        try:
            year = int(year_str)
            if not (1990 <= year <= 2026):
                errors.append({"check": "year_range", "line": idx, "message": f"Year out of range: {year}"})
                continue
        except ValueError:
            errors.append({"check": "year_type", "line": idx, "message": f"Non-integer year: {year_str}"})
            continue

        # 3. Unique key check
        key = (ind_id, geo_code, year)
        if key in seen_keys:
            errors.append({
                "check": "duplicate_key",
                "line": idx,
                "message": f"Duplicate observation for {key} (first seen at line {seen_keys[key]})",
            })
        seen_keys[key] = idx

        # 4. Unit consistency
        if row["unit"] != ind_meta["unit"]:
            errors.append({
                "check": "unit_consistency",
                "line": idx,
                "message": f"Unit '{row['unit']}' != canonical '{ind_meta['unit']}' for {ind_id}",
            })

        # 5. Status & date checks
        if row["data_status"] not in VALID_DATA_STATUS:
            errors.append({"check": "data_status", "line": idx, "message": f"Invalid data_status: {row['data_status']}"})
        if row["verification_status"] not in VALID_VERIF_STATUS:
            errors.append({"check": "verification_status", "line": idx, "message": f"Invalid verification_status: {row['verification_status']}"})
        for date_col in ("publication_date", "retrieved_at"):
            if not ISO_DATE_RE.match(row[date_col].strip()):
                errors.append({"check": "iso_date", "line": idx, "message": f"Invalid ISO date in {date_col}: {row[date_col]}"})

        # 6. Source completeness
        for req_src in ("source_id", "source_agency", "source_url", "source_table", "source_locator"):
            if not row[req_src].strip():
                errors.append({"check": "source_completeness", "line": idx, "message": f"Empty {req_src}"})
        if not row["source_url"].startswith(("https://", "http://")):
            errors.append({"check": "source_url_scheme", "line": idx, "message": f"Invalid URL: {row['source_url']}"})
        if sources and row["source_id"] not in sources:
            warnings.append({"check": "source_registry", "line": idx, "message": f"source_id {row['source_id']} not in sources.csv"})

        # 7. Value parsing (missing value stays blank, never counted as valid)
        if val_str == "":
            continue
        try:
            val = float(val_str)
            if math.isnan(val) or math.isinf(val):
                raise ValueError("NaN/Inf")
        except ValueError:
            errors.append({"check": "value_type", "line": idx, "message": f"Non-numeric value: {val_str}"})
            continue

        # 8. Bounds & negative check
        if val <= 0 and ind_id in RANGE_BOUNDS:
            errors.append({"check": "non_positive_value", "line": idx, "message": f"Non-positive value {val} for {ind_id} {geo_code} {year}"})
        elif ind_id in RANGE_BOUNDS:
            lo, hi = RANGE_BOUNDS[ind_id]
            if not (lo <= val <= hi):
                warnings.append({
                    "check": "range_bound",
                    "line": idx,
                    "message": f"Value {val} outside typical range [{lo}, {hi}] for {ind_id} {geo_code} {year}",
                })

        valid_obs_count += 1
        if row["verification_status"] == "verified":
            verified_obs_count += 1
        years_present.add(year)
        active_sources.add(row["source_id"])
        by_ind_geo[(ind_id, geo_code)].append((year, val, row["methodology_version"]))
        if row["geo_level"] == "provincial":
            by_ind_year_prov[(ind_id, year)][geo_code] = row
        elif row["geo_level"] == "national":
            by_ind_year_nat[(ind_id, year)] = row

    # 9. YoY anomaly check (>35% jump on consecutive years with same methodology)
    for (ind_id, geo_code), series in by_ind_geo.items():
        series.sort(key=lambda x: x[0])
        for i in range(1, len(series)):
            y0, v0, m0 = series[i - 1]
            y1, v1, m1 = series[i]
            if y1 == y0 + 1 and v0 != 0:
                pct = abs(v1 - v0) / abs(v0)
                if pct > 0.35:
                    warnings.append({
                        "check": "yoy_anomaly",
                        "message": f"{ind_id} {geo_code} {y0}->{y1}: {v0} -> {v1} ({pct*100:.1f}% change; meth {m0}->{m1})",
                    })

    # 10. Additive consistency check (ONLY for indicators marked additive_to_national == true)
    additive_checks = []
    for ind_id, ind_meta in indicators.items():
        if ind_meta["additive_to_national"] != "true":
            continue
        for year in sorted(years_present):
            prov_map = by_ind_year_prov.get((ind_id, year), {})
            nat_row = by_ind_year_nat.get((ind_id, year))
            if len(prov_map) == 31 and nat_row is not None:
                prov_sum = sum(float(r["value"]) for r in prov_map.values())
                nat_val = float(nat_row["value"])
                diff_pct = abs(prov_sum - nat_val) / abs(nat_val) * 100 if nat_val else 0.0
                additive_checks.append({
                    "indicator_id": ind_id,
                    "year": year,
                    "provincial_sum": round(prov_sum, 2),
                    "national_value": round(nat_val, 2),
                    "diff_pct": round(diff_pct, 4),
                })
                if diff_pct > 2.5:
                    warnings.append({
                        "check": "additive_consistency",
                        "message": f"{ind_id} {year}: 31-province sum={prov_sum:.2f} vs national={nat_val:.2f} (diff={diff_pct:.2f}%)",
                    })

    # 11. DuckDB cross-check for SQL integrity
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE TABLE obs AS SELECT * FROM read_csv_auto('{OBS_CSV.as_posix()}', all_varchar=true)")
    duckdb_total = con.execute("SELECT COUNT(*) FROM obs WHERE trim(value) <> ''").fetchone()[0]
    duckdb_distinct_keys = con.execute(
        "SELECT COUNT(*) FROM (SELECT DISTINCT indicator_id, geo_code, year FROM obs WHERE trim(value) <> '')"
    ).fetchone()[0]
    if duckdb_total != valid_obs_count or duckdb_distinct_keys != valid_obs_count:
        errors.append({
            "check": "duckdb_key_integrity",
            "message": f"DuckDB count mismatch: total={duckdb_total}, distinct={duckdb_distinct_keys}, py={valid_obs_count}",
        })

    # 12. Generate reports/coverage_matrix.csv
    coverage_rows = []
    core_indicators = [ind_id for ind_id, meta in indicators.items() if meta["is_core"] == "true"]
    all_years = sorted(years_present) if years_present else []
    core_available = 0
    core_verified = 0
    latest_prov_coverages = []

    for ind_id in core_indicators:
        ind_years = sorted(
            {y for (i, y) in by_ind_year_prov.keys() if i == ind_id}
            | {y for (i, y) in by_ind_year_nat.keys() if i == ind_id}
        )
        if ind_years:
            core_available += 1
        ind_has_verified = False
        prov_years = sorted({y for (i, y) in by_ind_year_prov.keys() if i == ind_id})
        if prov_years:
            latest_py = prov_years[-1]
            latest_prov_coverages.append(len(by_ind_year_prov[(ind_id, latest_py)]) / 31.0)

        for y in all_years:
            prov_map = by_ind_year_prov.get((ind_id, y), {})
            nat_row = by_ind_year_nat.get((ind_id, y))
            actual_prov = len(prov_map)
            verified_prov = sum(1 for r in prov_map.values() if r["verification_status"] == "verified")
            if verified_prov > 0 or (nat_row and nat_row["verification_status"] == "verified"):
                ind_has_verified = True
            missing_codes = sorted(valid_mainland_provinces - set(prov_map.keys()))
            missing_names = [regions[c]["geo_name_short_zh"] for c in missing_codes]
            statuses = {r["data_status"] for r in prov_map.values()}
            if nat_row:
                statuses.add(nat_row["data_status"])
            data_status = ",".join(sorted(statuses)) if statuses else "missing"

            if actual_prov == 31:
                reason = ""
            elif actual_prov == 0 and nat_row is not None:
                reason = "national_communique_only_provincial_not_yet_published" if y >= 2025 else "national_series_only"
            elif actual_prov == 0:
                if ind_id == "disposable_income" and y < 2013:
                    reason = "pre_2013_unified_urban_rural_household_survey_not_implemented"
                else:
                    reason = "not_available_in_fetched_official_series"
            else:
                reason = "partial_provincial_publication"

            coverage_rows.append({
                "indicator_id": ind_id,
                "year": y,
                "expected_provinces": 31,
                "actual_provincial_non_null": actual_prov,
                "verified_provincial_count": verified_prov,
                "missing_regions": "|".join(missing_names),
                "provincial_coverage_rate": f"{actual_prov / 31.0:.4f}",
                "national_present": "true" if nat_row is not None else "false",
                "data_status": data_status,
                "primary_missing_reason": reason,
            })

        if ind_has_verified:
            core_verified += 1

    COVERAGE_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(COVERAGE_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "indicator_id",
                "year",
                "expected_provinces",
                "actual_provincial_non_null",
                "verified_provincial_count",
                "missing_regions",
                "provincial_coverage_rate",
                "national_present",
                "data_status",
                "primary_missing_reason",
            ],
        )
        writer.writeheader()
        writer.writerows(coverage_rows)

    report = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "observations_file": str(OBS_CSV.relative_to(ROOT)),
        "summary": {
            "core_indicators_target": len(core_indicators),
            "core_indicators_available": core_available,
            "core_indicators_verified": core_verified,
            "unique_valid_observations": valid_obs_count,
            "verified_observations": verified_obs_count,
            "distinct_sources": len(active_sources),
            "regions_covered_mainland": len(valid_mainland_provinces),
            "earliest_data_year": min(years_present) if years_present else None,
            "latest_data_year": max(years_present) if years_present else None,
            "mean_latest_provincial_coverage": round(sum(latest_prov_coverages) / len(latest_prov_coverages), 4)
            if latest_prov_coverages
            else 0.0,
            "errors_count": len(errors),
            "warnings_count": len(warnings),
            "gate_passed": len(errors) == 0,
        },
        "additive_consistency_checks": additive_checks,
        "errors": errors,
        "warnings": warnings[:100],
    }

    with open(QUALITY_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    return report


if __name__ == "__main__":
    rep = run_quality_gate()
    print(json.dumps(rep["summary"], ensure_ascii=False, indent=2))
    if not rep["summary"]["gate_passed"]:
        raise SystemExit(1)
