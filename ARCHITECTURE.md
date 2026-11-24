# System & Data Architecture — China Data Atlas | 中国数据地图

## 1. 总体架构

```text
Official NBS Sources (data.stats.gov.cn JSON + www.stats.gov.cn HTML Bulletins)
        │
        ▼  pipeline/ingestion/fetch_nbs_publicrelease.py & parse_nbs_html.py
Raw Evidence Archive (data/raw/nbs_publicrelease/*.json, nbs_census2020/, nbs_communique/)
        │
        ▼  pipeline/transformations/normalize_observations.py
Canonical Observations (data/normalized/observations.csv — 22-column RFC-4180 UTF-8)
        │
        ▼  pipeline/validation/quality_gate.py & generate_validation_samples.py
Quality Gate & Reports (reports/data_quality_report.json, coverage_matrix.csv, data_validation_samples.csv)
        │
        ▼  pipeline/transformations/build_warehouse.py
Versioned Analytics Store (data/processed/china_data_atlas.duckdb + observations.parquet)
        │  └── PostgreSQL Migration DDL: pipeline/transformations/postgres_schema.sql
        ▼
Precomputed Static Slices (app/src/data/atlas-summary.json, atlas-explore.json, indicators/<id>.json)
        │  + Public Open Data (app/public/data/observations.csv, data-dictionary.json)
        ▼
Next.js 15 App Router (SSG/SSR) + TypeScript + Tailwind CSS v4 + Apache ECharts 5
        ├── /                       (Homepage, Instant Search, Interactive Matrix Showcase, 4 Domains)
        ├── /indicators/[id]        (Single Config-Driven Template for all 12 Core Indicators)
        ├── /explore                (V0.5 Cross-Indicator Provincial Scatter Explorer)
        ├── /methodology            (Methodology, Licensing, Map Compliance & Open Data Hub)
        └── /sitemap.xml & /robots.txt
```

---

## 2. 技术选型与工程决策

| 层级 | 采用技术 | 选型依据与可维护性说明 |
|---|---|---|
| **Frontend Framework** | Next.js 15.5 (App Router) + React 19 + TypeScript 5.8 | 原生 `generateStaticParams` 为全部 12 个指标生成静态直出 HTML（SSG），兼顾搜索引擎抓取、零冷启动速度与无需维护后端数据库的高可用性。 |
| **Styling System** | Tailwind CSS v4 + 自定义编辑部纸感色板 (`#fafaf8` / `#1e3a5f` / `#0f766e`) | 零冗余第三方 UI 重包，严格 `tabular-nums` 等宽数字对齐，桌面/平板/手机全响应式零溢出。 |
| **Visualization** | Apache ECharts 5.6 + 自研合规七大区域省级矩阵组件 | ECharts 支撑双轴多省趋势图、含全国基准线的水平排名条形图、七大区域柱状图、跨指标气泡散点图与高清 PNG 导出；矩阵组件严格无边界矢量。 |
| **Data Engineering** | Python 3.14 + DuckDB 2.0 + PyArrow Parquet + BeautifulSoup4 | 轻量化本地分析引擎，零外部数据库运维成本；提供 `postgres_schema.sql` 随时平滑迁移至 PostgreSQL。 |
| **Testing & CI** | pytest (数据质量) + Vitest (统计逻辑) + Playwright Chromium (端到端与视觉验收) + GitHub Actions | 覆盖数据模式、计算公式、页面交互、CSV 同步一致性、缺失年份与多端视口。 |

---

## 3. 核心工程设计亮点

### 3.1 配置驱动单模板架构（Zero Page Duplication）
- 所有 12 个核心指标均由 `data/metadata/indicators.csv` 驱动，共用单一动态路由 `app/src/app/indicators/[id]/page.tsx` 与 `IndicatorDetailClient.tsx`。
- 增量扩展新指标时，仅需在 `indicators.csv` 新增一行配置、在抓取管道加入对应官方源 ID 并运行构建脚本，无需修改任何前端页面代码。

### 3.2 分片静态数据包优化
- 原始全量前端 JSON 约 7.7 MB；为保障移动端与首屏性能，`build_warehouse.py` 自动切分为：
  - `atlas-summary.json`（625 KB，首页与导航元数据 + 最新省级切片，First Load JS 仅 **121 kB**）；
  - `indicators/<id>.json`（每指标约 485–744 KB，由 Server Component 按路由读取）；
  - `atlas-explore.json`（精简数值矩阵，专供 `/explore` 散点图）。

### 3.3 统计严谨性与版本隔离
- **绝不补零 / 绝不插值**：ECharts 折线强制 `connectNulls: false`；`observations.csv` 仅保留官方真实数值。
- **正确区域聚合**：总量指标求和；人均 GDP 按区域现价 GDP 总量 ÷ 区域年末常住人口计算；出生率、城镇化率、老龄化率、人均可支配收入、每千人医师及床位严格按同年省级常住人口加权平均；若某区域缺省或缺少人口权重则输出 `null` 而不展示误导值。
- **双轴趋势自适应**：总量类指标在叠加全国曲线时自动启用左右双 Y 轴，避免省级曲线被 11 倍量级的全国总量压缩。
- **版本与修订安全**：`observations` 主键含 `methodology_version`（PostgreSQL DDL 已预留 `is_current_release`），确保未来自动化增量抓取不会静默覆盖经人工核验的历史版本。

### 3.4 地图合规处理架构
- 依据《地图管理条例》（国务院令第 664 号）及自然资源部地图审核规定，动态交互着色地图须采用具备法定审图号或测绘资质的底图并履行送审程序。
- 本版本正式采用**七大区域省级矩阵热力图（`RegionalMatrix.tsx`）**作为合规空间替代方案，无任何未经核实的第三方 GeoJSON 边界数据，并在 UI 与 `/methodology` 透明说明。

### 3.5 面向 V1.0 AI Research Assistant 的预留边界
- 标准化 DuckDB / Parquet 与 22 列 `observations.csv` 天然作为未来自然语言研究助手的唯一可信数据层（Verified Fact Layer），所有回答必须通过 SQL/工具查询该层返回确切数值、统计年份、官方表号及计算公式，拒绝编造并严禁将相关系数解释为因果关系。本轮未启用任何付费 AI API。
