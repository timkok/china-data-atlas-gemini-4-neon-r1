# China Data Atlas | 中国数据地图

> **Make China's Data Accessible, Understandable, Traceable and Explorable.**

中国数据地图是一个基于国家统计局官方公开数据构建的现代化、免费、零登录、可追溯的中国统计数据可视化与研究平台。覆盖中国大陆 31 个省级行政区及全国层面 **2000—2025 年**共 **12 个核心基准指标**、**9,110 条有效官方观测记录**，提供七大区域省级矩阵热力图（100% 地图合规替代方案）、历史趋势多省对比、标准竞争并列排名、统计学严谨的区域加权比较、同步筛选 CSV 下载与跨指标省级散点探索器。

---

## 核心特性

- **12/12 核心基准指标全覆盖**：人口（年末常住人口、人口出生率、常住人口城镇化率、65岁及以上人口占比）、经济（现价地区生产总值、现价人均地区生产总值、居民人均可支配收入、社会消费品零售总额）、教育（普通高等教育本专科在校生、普通高等学校数量）、医疗（每千人口执业（助理）医师数、每千人口医疗卫生机构床位数）。
- **100% 官方可追溯**：全部数值直接采自国家统计局「国家数据」（`data.stats.gov.cn`）、《第七次全国人口普查公报（第五号）》与《2025年国民经济和社会发展统计公报》，并经教育部、国家卫健委 2024 年官方统计公报交叉核验（60 条独立抽样记录见 [`reports/data_validation_samples.csv`](reports/data_validation_samples.csv)）。
- **严格统计口径与合规设计**：
  - 缺失值保持空值，绝不补 0、绝不插值伪造；
  - 严格区分最新全国统计公报年份（2025 初步核算）与最新完整省级年份（2024/2025）；
  - 七大区域聚合严禁对人均/比率指标执行简单求和或算术平均（采用常住人口加权平均或区域 GDP ÷ 区域人口）；
  - 严守《地图管理条例》，暂缓未获审图号的交互式中国行政边界 GeoJSON，正式采用合规的**七大区域省级矩阵热力图 + 省级排序条形图**。
- **可复现数据管道**：Python + DuckDB + Parquet 管道支持离线从保留原始证据 100% 重建标准化数据集 `data/normalized/observations.csv` 及前端静态数据包。

---

## 目录结构

```text
.
├── data/
│   ├── raw/                  # 保留的官方原始 JSON/HTML 证据快照
│   ├── normalized/           # 统一 22 列标准化观测表 observations.csv
│   ├── metadata/             # indicators.csv, regions.csv, sources.csv
│   └── processed/            # china_data_atlas.duckdb & observations.parquet
├── pipeline/
│   ├── ingestion/            # 官方 NBS 数据抓取与 HTML 解析脚本
│   ├── transformations/      # 标准化转换、DuckDB/Parquet 构建与 PostgreSQL DDL
│   └── validation/           # Data Quality Gate、覆盖率矩阵与独立抽样核验脚本
├── app/                      # Next.js 15 + TypeScript + Tailwind CSS + Apache ECharts 网站源码
├── tests/
│   ├── data/                 # Python pytest 数据质量与一致性测试
│   └── e2e/                  # Playwright 端到端浏览器与 10 项用户验收测试 (Task A–J)
├── reports/                  # 覆盖率矩阵、质量门禁、抽样复核、浏览器与验收测试报告
├── screenshots/              # Desktop (1440px) 与 Mobile (390px) 实际渲染截图
└── deployment/               # 独立部署说明与验证记录
```

---

## 快速安装与复现运行

### 1. 环境要求
- Python 3.11+（本项目已于 Python 3.14.4 验证）
- Node.js 20+ 与 npm（本项目已于 Node.js v25.9.0 / npm 11.12.1 验证）

### 2. 复现数据管道与运行数据质量测试

```bash
# 创建 Python 虚拟环境并安装依赖
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# （可选）重新从国家统计局公开数据接口抓取原始证据（带缓存，加 --force 强制刷新）
.venv/bin/python pipeline/ingestion/fetch_nbs_publicrelease.py

# 从保留的原始证据离线重建标准化 observations.csv
.venv/bin/python pipeline/transformations/normalize_observations.py

# 运行 Data Quality Gate 并生成 coverage_matrix.csv 与 data_quality_report.json
.venv/bin/python pipeline/validation/quality_gate.py

# 构建 DuckDB 仓库、Parquet 文件与前端分片 JSON 数据包
.venv/bin/python pipeline/transformations/build_warehouse.py

# 重新生成独立抽样核验报告 reports/data_validation_samples.csv
.venv/bin/python pipeline/validation/generate_validation_samples.py

# 运行 Python 数据质量自动化测试
.venv/bin/pytest -v tests/data/test_observations.py
```

### 3. 本地构建、运行网站与执行全部测试

```bash
cd app
npm install

# TypeScript 类型检查 + Vitest 单元测试 + Next.js 生产构建
npm run typecheck
npm run test:unit
npm run build

# 启动生产服务（默认 http://localhost:3000）
npm run start
```

### 4. 运行 Playwright 端到端与用户验收测试（Task A–J）

```bash
cd app
npx playwright install chromium

# 启动服务后在另一终端运行，或设置 E2E_BASE_URL 指向已启动地址
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

---

## 数据来源与引用声明

主要统计数据引自**国家统计局网站**（`https://www.stats.gov.cn/`）及**国家数据**（`https://data.stats.gov.cn/`）。使用、引用或分发本仓库数据时，须遵循国家统计局网站《服务条款》：显著注明数据来源于国家统计局网站，不得曲解统计原意，不得擅自向第三方转授权商业再发布。详情见 [`LIMITATIONS.md`](LIMITATIONS.md) 与 [`data/metadata/sources.csv`](data/metadata/sources.csv)。
