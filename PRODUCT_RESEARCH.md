# Product Research Report — China Data Atlas | 中国数据地图

- **研究日期（Visit Date）**：2026-11-24（UTC）
- **研究方式**：使用内置真实浏览器逐站访问并记录实际页面架构、交互、控制台状态与条款文本（严格未绕过登录、验证码或访问控制）。
- **实际访问 URL 清单（全部返回 HTTP 200）**：
  1. The Maps Daily
     - `https://themapsdaily.com/`
     - `https://themapsdaily.com/posts/in-infant-mortality-rate`
  2. Our World in Data
     - `https://ourworldindata.org/`
     - `https://ourworldindata.org/population-growth`
     - `https://ourworldindata.org/grapher/population`
  3. 国家统计局 / 国家数据（National Bureau of Statistics of China）
     - `https://data.stats.gov.cn/dg/website/page.html#/pc/national/home`
     - `https://data.stats.gov.cn/dg/website/page.html#/pc/national/yearData`
     - `https://data.stats.gov.cn/dg/website/page.html#/pc/national/fsYearData`
     - `https://data.stats.gov.cn/dg/website/page.html#/pc/national/publication`
     - `https://data.stats.gov.cn/dg/website/page.html#/pc/national/search?s=GDP`
     - `https://data.stats.gov.cn/dg/website/page.html#/pc/national/help`
     - `https://www.stats.gov.cn/`
     - `https://www.stats.gov.cn/sj/`
     - `https://www.stats.gov.cn/sj/ndsj/`
     - `https://www.stats.gov.cn/sj/tjgb/ndtjgb/`
     - `https://www.stats.gov.cn/wzgl/202302/t20230217_1912857.html`（国家统计局网站《服务条款》）

---

## 1. 十二维度深度对标研究

### 1.1 首页设计与信息架构
- **The Maps Daily**：极简编辑部风格，顶栏仅保留 Logo、`Home`、`Categories`、`Extras`；首屏明确提出价值主张（*"Making India's Data Accessible"*），紧跟全站搜索框、6 个核心主题入口与规模指标（462 datasets / 20 topics / 57 official sources / 1.8M datapoints），下方以精选交互地图预览、官方来源条带、最新数据集网格与方法论摘要承接。
- **Our World in Data (OWID)**：研究机构门户形态，顶栏包含 `Browse by topic` 巨型菜单、`Data`、`Latest`、`Resources`、`About`；首屏通过高频专题条（Popular pages）与带多实体示例提示的搜索框（如 `"Poverty Nigeria Vietnam"`）引导直达，随后展示 `14,037 charts / 126 topic pages / 38 data explorers / 508 articles` 规模与 *Data Insights* 动态研究卡片。
- **国家数据 (`data.stats.gov.cn`) & 国家统计局 (`www.stats.gov.cn`)**：典型政务门户与传统多维报表库架构。`data.stats.gov.cn` 首页入口按时间频率与维度划分（月度、季度、年度、普查、分省、城市、部门、国际、出版物），信息密度极高，但首次打开即弹出浮动公告遮挡导航，且在 `1280×800` 桌面视口下已发生水平溢出裁切（右侧“下载/打印/登录”被截断）。

### 1.2 数据分类体系
- **The Maps Daily**：20 个面向公众的一级主题（Population、Health、Economy 等），扁平直观。
- **OWID**：10 大核心研究领域（Population & Demographic Change、Health、Poverty & Economic Development、Education & Knowledge 等）二级展开为 126 个专题页，兼顾学术严谨性与公众可读性。
- **国家数据**：25+ 个官方国民经济统计大类（综合、国民经济核算、人口、就业与工资、人民生活、国内贸易、教育、卫生等），口径最权威，但普通用户难以区分“国内贸易”与“消费”或“国民经济核算”与“GDP”。
- **对 China Data Atlas 的启示**：首版采用公众一眼可懂的四大一级领域——**人口（Demographics）、经济（Economy）、教育（Education）、医疗（Healthcare）**，同时在每个指标元数据中完整保留国家统计局原属统计目录与表号映射。

### 1.3 数据发现方式
- **The Maps Daily**：实时搜索弹窗体验流畅，但缺少同义词与缩写映射（搜索 `"Population"` 命中多条，但搜索 `"GDP"` 返回 0 结果，因库内使用 GSDP/NSDP）。
- **OWID**：搜索支持多关键词组合（指标 + 国家），配合热门专题条与领域导航，发现效率最高。
- **国家数据**：`查数 ChaShu` 搜索 `"GDP"` 返回约 571 条按月/季/年混排的结果，且附加 5 条严格语法说明（须输入完整指标+地区+时间关键词），学习门槛高。
- **超越点**：China Data Atlas 须内置**中英文别名与通俗词检索**（如搜 `GDP`、`老龄化`、`房价` 以外的 `人均可支配收入`、`大学`、`床位`、`广东`、`长三角` 均可即时匹配指标或省份，确保 3 次点击内定位任一省最新数据）。

### 1.4 地图可视化
- **The Maps Daily**：省级热力着色地图居中，搭配年份下拉与左右最高/最低邦排名，但未见独立审图/合规元数据需求（印度场景与我国《地图管理条例》不同）。
- **OWID**：Grapher `Map` 视图提供分级色阶、`No data` 明确置灰、时间滑块与 `Play` 播放按钮。
- **中国场景合规约束（核心结论）**：根据国务院令第 664 号《地图管理条例》与自然资源部地图审核规范，公开网站发布含动态业务数据叠加与交互着色的中国省级行政区地图，须采用具备合法审图号/测绘资质的合规底图并依法送审；使用来源不明的第三方开源 GeoJSON 属于高合规风险。
- **China Data Atlas 决策**：本轮严格不采用未经审图核验的第三方中国 GeoJSON，正式实现**100% 合规的非地图空间替代方案**——**「七大区域省级矩阵热力图（华北/东北/华东/华中/华南/西南/西北）+ 省级排序条形图（含全国基准线）+ 区域加权对比」**，并在页面显著位置提供透明的《地图合规与空间可视化说明》。

### 1.5 数据专题详情页
- **The Maps Daily (`/posts/in-infant-mortality-rate`)**：以“问题导向”组织结构（*Overview → Data → Methodology → Cite → Related*），顶部吸顶锚点栏体验极佳，配有 KPI 卡片、排名、对比、完整数据表与内嵌数据质量评分。但我们实测发现其**编辑文案与动态数据不同步**（标题/导语写 `27 per 1,000`，而下方 2023 KPI 卡片显示 `25 / 1K`）。
- **OWID (`/population-growth` & `/grapher/population`)**：长篇研究叙事与 Grapher 多视图组件无缝融合，支持 `Table / Map / Line / Bar` 一键切换，但不同标签下实体选择控件名称不统一（`Edit countries` vs `Select countries` vs `Filter by`）。
- **超越点**：China Data Atlas 的所有摘要数字、重要发现与排名文案均**由标准化数据层自动计算生成**，从机制上杜绝文案与图表数值割裂的隐患。

### 1.6 历史趋势分析
- **The Maps Daily**：支持单指标折线与单选对比邦（`Compare with: Choose a state`），并列出 *Most Improved / Most Worsened* 区间变化。
- **OWID**：双滑块自由截断年份区间，支持相对变化（Relative change）、对数坐标轴（Logarithmic）与多实体并发对比。
- **国家数据**：`简单查询` 默认仅展示最近 5/10/15 年，切换长周期需额外配置，且图形交互老旧。
- **China Data Atlas 方案**：支持**全国曲线 + 多省（最多 6 省）同图对比**、自定义起止年份、明确标注**缺失年份断点（绝不插值伪造）**、以及**口径变化与普查修订标记**（如 2020 七普、2013 城乡一体化住户调查、五经普修订）。

### 1.7 地区排名与比较
- **The Maps Daily**：支持最高/最低排榜、区域（Zone）分组以及可排序 35 邦数据表（含微条形图）。
- **China Data Atlas 方案**：提供完整 31 省升降序排名、**标准并列名次（1, 2, 2, 4）**、缺失值不参与排名、全国基准线参考、七大区域筛选与**统计学正确的区域聚合**（总量类求和；人均 GDP 用区域 GDP 总量 ÷ 区域人口总量；出生率/老龄化率/城镇化率/人均可支配收入/每千人医师及床位采用**同年份常住人口加权平均**，拒绝错误简单平均）。

### 1.8 CSV 下载与 Data Explorer
- **The Maps Daily**：零登录一键下载规范 CSV，并提供列级统计（unique / missing / min / median / max）预览。
- **OWID**：提供 `full data` 与 `displayed data`（筛选后）双模式下载、直接 API URL 以及可复制的 Excel/Python 代码片段、PNG/SVG 图表导出。
- **国家数据**：**严重痛点**——点击 `下载` 强制弹出登录 + 图形验证码弹窗，阻断了研究人员与公众的匿名开放获取。
- **China Data Atlas 方案**：零登录开放 Data Explorer，支持按年份、省份、七大区域、关键字实时筛选，**下载的 CSV 与当前页面筛选结果 100% 一致**，并附带完整 `data-dictionary.json`、PNG 图表导出与 Python/Excel 引用提示。

### 1.9 数据来源、Methodology 与引用
- **OWID**：行业标杆——每个图表清晰展示来源机构、更新时间、单位、处理说明与标准引用格式。
- **国家统计局 (`www.stats.gov.cn/wzgl/202302/t20230217_1912857.html`)**：官方《服务条款》明确允许用户在网站下载和依法使用发布的统计数据，允许以新闻性/资料性公共免费信息为目的善意引用并**显著注明“国家统计局网站 / www.stats.gov.cn”**，但禁止歪曲原意、禁止抄袭网站特有图形/编排、且**不得擅自授权第三方继续转载引用**。
- **China Data Atlas 方案**：每条观测值均保留 `source_id / source_agency / source_url / source_table / source_locator / publication_date / retrieved_at / data_status / methodology_version / transformation / verification_status`，页面底部自动生成中文/学术引用格式，并明确区分**数据真实性核验、合法访问状态与再发布许可边界**。

### 1.10 SEO 与移动端体验
- **The Maps Daily**：`375×812` 移动端零横向溢出，语义化独立 URL。
- **国家数据 & 国家统计局**：传统固定宽页在 `1280px` 桌面端即出现水平溢出，页面仍挂有 IE7/IE9 兼容模式提示且依赖超时外部脚本（`dcs.conac.cn`），移动端体验极差。
- **China Data Atlas 方案**：Next.js 静态/服务端直出（SSR/SSG）每个核心指标独立 URL（`/indicators/[id]`），完整中文 `<title>` / `description` / Open Graph / `sitemap.xml` / 真实可读统计解读正文，针对 `1440px` / `768px` / `390px` 全面响应式适配且零横向溢出。

### 1.11 数据更新机制
- **OWID**：自动化 ETL 流水线驱动，页面展示 `Last updated` 与 `Next expected update`。
- **国家数据**：年度统计公报通常于次年 2 月底发布（含全国初步核算数），而完整 31 省《中国统计年鉴》与分省年度数据通常于当年秋季陆续齐备，两者存在明显时间差。
- **China Data Atlas 方案**：明确分离展示**最新全国数据年份（如 2025 公报初步数）**与**最新完整省级数据年份（如 2024 年鉴/国家数据）**，并通过配置驱动的 Python + DuckDB 流水线实现增量更新与版本隔离（自动更新不覆盖人工抽样核验标记）。

### 1.12 统计解释与数据故事
- **The Maps Daily & OWID**：均通过“关键发现 + 指标定义 + 口径注意事项”帮助非专业读者读懂统计数字。
- **China Data Atlas 方案**：面向中国国情专门加入**统计口径防踩坑提示**（例如：现价 GDP 同比≠不变价实际增速；2013 年起才有城乡一体化全体居民可支配收入；普通本专科在校生≠仅普通本科亦不含研究生；医疗卫生机构床位数≠仅医院床位数；2020 七普全数登记 vs 抽样调查年份）。

---

## 2. 综合研判：借鉴、不足与超越路线

| 维度 | 值得借鉴的设计 | 竞品/官站存在的不足 | China Data Atlas 应该超越的地方 |
|---|---|---|---|
| **内容与信任** | OWID 级溯源卡片与 The Maps Daily 级列统计预览 | The Maps Daily 出现导语与 KPI 数值不一致；国家数据无结构化开放 API | 所有摘要数字由标准化数据自动生成；观测级官方表格定位（表号+行列）与独立抽样核验报告 |
| **检索与发现** | OWID 多维引导 + The Maps Daily 即时搜索弹窗 | The Maps Daily 搜 `GDP` 无结果；国家数据查数语法严苛 | 中英文同义词、拼音/简称与省份直达搜索，3 次点击内定位任意省最新指标 |
| **统计严谨性** | OWID 明确区分 `No data` 与 `0`、显式标注单位 | 多数第三方平台误对人均/比率指标做简单算术平均或混拼口径 | 严格按指标数学属性执行区域加权（人口加权/GDP÷人口），缺失绝不补 0 或插值 |
| **开放与体验** | The Maps Daily 零登录 CSV + 移动端友好布局 | 国家数据下载需登录+验证码、桌面端 1280px 即溢出、老旧 IE 提示 | 零登录筛选同步 CSV 下载、数据字典、桌面/平板/手机全适配、中文优先+英文切换 |
| **地图合规** | 清晰空间分层与缺失置灰 | 很多开源 Demo 随意引入无审图号中国 GeoJSON | 严守《地图管理条例》，正式采用合规的七大区域省级矩阵热力图与排序条形图，不冒险违法 |

### 功能演进分层
- **本轮（R1 / V0.1–V0.5）快速实现的核心功能**：
  1. 12 个核心基准指标的官方数据管道、DuckDB 仓库与统一 `observations.csv`。
  2. 首页（价值主张、智能搜索、四大分类、真实数据核心发现、覆盖率统计、跨指标探索入口）。
  3. 统一配置驱动指标详情页（Summary、合规七大区域省级矩阵热力图、历史趋势多省对比、省级排名与并列处理、七大区域加权比较、同步 CSV 下载的 Data Explorer、Methodology & 推荐引用）。
  4. 跨指标探索器（V0.5 预览：双指标省级散点图与相关性探索、自定义年份、PNG 导出）。
  5. 中英文界面切换、SSR SEO 元数据与 Sitemap、Playwright 自动化验证。
- **后续版本（V1.0+）需持续投入的能力**：
  1. 接入自然资源部审图合规底图或天地图官方 API，上线依法合规的省级交互式专题地图。
  2. 基于校验数据层构建 AI Research Assistant（自然语言问答 + 公式透明展示 + 拒答防幻觉机制）。
  3. 扩展地级市年度数据、季度高频数据及自动化的 GitHub Actions 定时增量监测（带人工审核门禁）。
