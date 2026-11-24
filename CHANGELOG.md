# Changelog — China Data Atlas (R1)

## [0.1.0-r1] - 2026-11-24

### Phase 1: Product Research
- Live browser audit of `themapsdaily.com`, `ourworldindata.org`, `data.stats.gov.cn`, and `www.stats.gov.cn` (including NBS Terms of Service `t20230217_1912857.html`).
- Authored `PRODUCT_RESEARCH.md` covering all 12 benchmark dimensions and differentiation roadmap.

### Phase 2 & 3: Official Data Acquisition & Data Engineering
- Discovered NBS upgraded `data.stats.gov.cn` public anonymous endpoints (`publicrelease/web/external/stream/esData`); logged legacy `easyquery.htm` HTTP 403 and UI download login+CAPTCHA gate without bypassing any control.
- Built reproducible Python ingestion (`fetch_nbs_publicrelease.py`, `parse_nbs_html.py`), standardization (`normalize_observations.py`), DuckDB/Parquet warehouse builder (`build_warehouse.py`), PostgreSQL DDL (`postgres_schema.sql`), and Data Quality Gate (`quality_gate.py`).
- Acquired and verified **9,110 unique valid observations** across **12/12 core benchmark indicators**, **31/31 mainland provinces + National**, spanning **2000–2025**, with **0 quality gate errors**.
- Fixed RFC-4180 CSV quoting bug in `data/metadata/indicators.csv` (`"per 1,000"` and English definitions containing commas) caught by `build_warehouse.py` and `quality_gate.py`.
- Split frontend data payload from a single 7.7 MB bundle into route-scoped JSON slices (`atlas-summary.json`, `indicators/<id>.json`, `atlas-explore.json`), bringing Homepage First Load JS down to **121 kB**.
- Generated 60 independent sampling verification records (`reports/data_validation_samples.csv`) cross-checked against 2025 National Statistical Communique, 2020 7th Population Census Bulletin No. 5, MOE 2024 Bulletin, and NHC 2024 Bulletin.

### Phase 4 & 5: Web Platform Development, QA & Visual Iteration
- Built Next.js 15 + TypeScript + Tailwind CSS v4 + Apache ECharts 5 platform with Homepage, config-driven Indicator Detail template (`/indicators/[id]`), Cross-Indicator Explorer (`/explore`), Methodology & Compliance Hub (`/methodology`), bilingual ZH/EN switcher, and SSR SEO metadata + sitemap.
- Implemented 100% compliant non-map spatial visualization (7-Region Provincial Matrix + Ranked Bar Chart) with explicit map compliance disclosure under《地图管理条例》.
- Ran full automated QA: 7/7 pytest data tests, 6/6 Vitest unit tests, and 12/12 Playwright E2E tests covering all 10 User Acceptance Tasks (Task A–J) across Desktop (1440px), Tablet (768px), and Mobile (390px).
- **Visual QA Iteration**:
  1. Inspected rendered Desktop/Mobile screenshots and identified that plotting additive National totals (~140,000) alongside Provincial series (~10,000) on one Y-axis compressed provincial trend lines; upgraded `IndicatorDetailClient.tsx` to automatic Dual Y-Axis for additive indicators and restricted ranking benchmark lines to non-additive rate/per-capita metrics.
  2. Identified slight legend-to-Y-axis-title overlap on `/explore` scatter plot; increased `grid.top` and Y-axis `nameGap` in `ExploreClient.tsx` and re-verified via fresh screenshots.
