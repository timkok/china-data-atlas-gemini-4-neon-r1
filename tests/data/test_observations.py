"""
Automated Data Quality & Integrity Tests for China Data Atlas.
Runs against data/normalized/observations.csv, data/metadata/*.csv,
and data/processed/china_data_atlas.duckdb.
"""
from __future__ import annotations

import csv
import json
import math
from pathlib import Path
import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]
OBS_CSV = ROOT / "data" / "normalized" / "observations.csv"
IND_CSV = ROOT / "data" / "metadata" / "indicators.csv"
REG_CSV = ROOT / "data" / "metadata" / "regions.csv"
SRC_CSV = ROOT / "data" / "metadata" / "sources.csv"
QUALITY_JSON = ROOT / "reports" / "data_quality_report.json"
COVERAGE_CSV = ROOT / "reports" / "coverage_matrix.csv"
DUCKDB_FILE = ROOT / "data" / "processed" / "china_data_atlas.duckdb"
APP_BUNDLE = ROOT / "app" / "src" / "data" / "atlas-data.json"
PUBLIC_CSV = ROOT / "app" / "public" / "data" / "observations.csv"


def load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_required_files_exist():
    for fp in [OBS_CSV, IND_CSV, REG_CSV, SRC_CSV, QUALITY_JSON, COVERAGE_CSV, DUCKDB_FILE, APP_BUNDLE, PUBLIC_CSV]:
        assert fp.exists(), f"Missing required pipeline artifact: {fp}"


def test_quality_gate_passed_zero_errors():
    report = json.loads(QUALITY_JSON.read_text(encoding="utf-8"))
    assert report["summary"]["gate_passed"] is True, f"Quality gate failed: {report['errors'][:5]}"
    assert report["summary"]["errors_count"] == 0
    assert report["summary"]["core_indicators_available"] >= 10
    assert report["summary"]["unique_valid_observations"] > 0


def test_schema_and_no_zero_for_missing():
    rows = load_csv(OBS_CSV)
    assert len(rows) > 0
    required = {
        "indicator_id", "indicator_name_zh", "indicator_name_en",
        "geo_code", "geo_name_zh", "geo_name_en", "geo_level",
        "year", "value", "unit", "source_id", "source_agency",
        "source_url", "source_table", "source_locator",
        "publication_date", "retrieved_at", "data_status",
        "methodology_version", "transformation", "verification_status", "notes",
    }
    assert required.issubset(set(rows[0].keys()))
    seen = set()
    for r in rows:
        key = (r["indicator_id"], r["geo_code"], r["year"])
        assert key not in seen, f"Duplicate key: {key}"
        seen.add(key)
        if r["value"].strip() != "":
            val = float(r["value"])
            assert not math.isnan(val) and not math.isinf(val)
            assert val > 0, f"Unexpected non-positive value for {key}: {val}"


def test_all_12_core_indicators_have_31_provinces_in_latest_provincial_year():
    rows = load_csv(OBS_CSV)
    inds = [r["indicator_id"] for r in load_csv(IND_CSV) if r["is_core"] == "true"]
    by_ind_year = {}
    for r in rows:
        if r["geo_level"] == "provincial" and r["value"].strip() != "":
            by_ind_year.setdefault(r["indicator_id"], {}).setdefault(int(r["year"]), set()).add(r["geo_code"])

    complete_count = 0
    for ind_id in inds:
        yr_map = by_ind_year.get(ind_id, {})
        assert yr_map, f"Core indicator {ind_id} has no provincial observations"
        latest_full = [y for y, geos in yr_map.items() if len(geos) == 31]
        if latest_full:
            complete_count += 1
    assert complete_count >= 10, f"Only {complete_count}/12 core indicators have full 31-province coverage"


def test_public_csv_identical_to_normalized_csv():
    assert PUBLIC_CSV.read_bytes() == OBS_CSV.read_bytes()


def test_frontend_bundle_matches_normalized_csv_counts():
    bundle = json.loads(APP_BUNDLE.read_text(encoding="utf-8"))
    obs_rows = [r for r in load_csv(OBS_CSV) if r["value"].strip() != ""]
    bundle_count = sum(len(v) for v in bundle["observations"].values())
    assert bundle_count == len(obs_rows), f"Bundle count {bundle_count} != CSV count {len(obs_rows)}"


def test_duckdb_warehouse_queryable():
    con = duckdb.connect(str(DUCKDB_FILE), read_only=True)
    cnt = con.execute("SELECT COUNT(*) FROM observations WHERE value IS NOT NULL").fetchone()[0]
    ind_cnt = con.execute("SELECT COUNT(DISTINCT indicator_id) FROM observations WHERE value IS NOT NULL").fetchone()[0]
    prov_cnt = con.execute("SELECT COUNT(DISTINCT geo_code) FROM observations WHERE geo_level = 'provincial' AND value IS NOT NULL").fetchone()[0]
    con.close()
    assert cnt > 0
    assert ind_cnt >= 10
    assert prov_cnt == 31
