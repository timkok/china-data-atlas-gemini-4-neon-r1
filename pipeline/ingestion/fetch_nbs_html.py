#!/usr/bin/env python3
"""
Polite helper to re-fetch the two official NBS HTML documents referenced by
pipeline/ingestion/parse_nbs_html.py:
  1. 2025 National Statistical Communique (t20260228_1962662.html)
  2. 7th National Population Census Bulletin No. 5 (t20230206_1902005.html)

Raw NBS HTML webpage markup is excluded from public Git redistribution to respect
NBS website layout/template copyright terms; reviewers can run this script to
re-download directly from www.stats.gov.cn.
"""
from __future__ import annotations

import time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}

TARGETS = [
    (
        ROOT / "data/raw/nbs_communique/communique_2025.html",
        "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
    ),
    (
        ROOT / "data/raw/nbs_census2020/bulletin5_age.html",
        "https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902005.html",
    ),
]


def main() -> None:
    for out_path, url in TARGETS:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        out_path.write_bytes(r.content)
        print(f"Downloaded {url} -> {out_path.relative_to(ROOT)} ({len(r.content)} bytes)")
        time.sleep(2)


if __name__ == "__main__":
    main()
