"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  Users,
  TrendingUp,
  GraduationCap,
  HeartPulse,
  ShieldCheck,
  Database,
  CheckCircle2,
  Compass,
  Download,
} from "lucide-react";
import { useLang } from "./LanguageContext";
import { RegionalMatrix } from "./RegionalMatrix";
import { ProvenanceModal } from "./ProvenanceModal";
import { INDICATOR_ALIASES, formatValue, dataStatusLabelZh } from "@/lib/format";
import type { AtlasBundle, ObservationRecord, RegionRecord } from "@/lib/types";

const CATEGORY_META = [
  { id: "all", zh: "全部核心指标", en: "All Core", icon: Database },
  { id: "demographics", zh: "人口", en: "Demographics", icon: Users },
  { id: "economy", zh: "经济", en: "Economy", icon: TrendingUp },
  { id: "education", zh: "教育", en: "Education", icon: GraduationCap },
  { id: "health", zh: "医疗", en: "Healthcare", icon: HeartPulse },
] as const;

export function HomeClient({ bundle }: { bundle: AtlasBundle }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [heroQuery, setHeroQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showcaseId, setShowcaseId] = useState<string>("population");
  const [selectedProv, setSelectedProv] = useState<string | null>("440000");
  const [tracedObs, setTracedObs] = useState<ObservationRecord | null>(null);

  const regionsByCode = useMemo(() => {
    const m: Record<string, RegionRecord> = {};
    bundle.regions.forEach((r) => (m[r.geo_code] = r));
    return m;
  }, [bundle.regions]);

  const showcaseIndicator = useMemo(
    () => bundle.indicators.find((i) => i.indicator_id === showcaseId) || bundle.indicators[0],
    [bundle.indicators, showcaseId]
  );

  const showcaseObs = useMemo(
    () => bundle.observations[showcaseIndicator.indicator_id] || [],
    [bundle.observations, showcaseIndicator.indicator_id]
  );

  const heroMatches = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    if (!q) return { indicators: [], provinces: [] as RegionRecord[] };
    const matchedInds = bundle.indicators.filter((ind) => {
      const aliases = INDICATOR_ALIASES[ind.indicator_id] || [];
      return (
        ind.indicator_name_zh.toLowerCase().includes(q) ||
        ind.indicator_name_en.toLowerCase().includes(q) ||
        ind.category_zh.toLowerCase().includes(q) ||
        ind.indicator_id.toLowerCase().includes(q) ||
        aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
    const matchedProvs = bundle.regions.filter(
      (r) =>
        r.geo_level === "provincial" &&
        r.in_mainland_nbs_scope === "true" &&
        (r.geo_name_zh.toLowerCase().includes(q) ||
          r.geo_name_short_zh.toLowerCase().includes(q) ||
          r.geo_name_en.toLowerCase().includes(q))
    );
    return { indicators: matchedInds.slice(0, 6), provinces: matchedProvs.slice(0, 5) };
  }, [heroQuery, bundle.indicators, bundle.regions]);

  const filteredIndicators = useMemo(() => {
    if (activeCategory === "all") return bundle.indicators;
    return bundle.indicators.filter((i) => i.category_id === activeCategory);
  }, [bundle.indicators, activeCategory]);

  const showcaseTabs = [
    "population",
    "gdp",
    "gdp_per_capita",
    "population_65plus",
    "disposable_income",
    "physicians_per_1000",
  ].filter((id) => bundle.indicators.some((i) => i.indicator_id === id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-14">
      {/* 1. Editorial Hero + Instant Search */}
      <section className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-3 py-1 text-xs font-semibold text-[#1e3a5f]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("全部基于国家统计局官方公开数据 · 逐条可追溯", "100% Official NBS Data · Row-Level Traceable")}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] leading-tight">
            {t("中国数据地图", "China Data Atlas")}
            <span className="block mt-1 text-lg sm:text-xl font-medium text-[#4b5563]">
              {t(
                "让中国官方统计数据可查询、可理解、可追溯、可探索",
                "Make China's Data Accessible, Understandable, Traceable and Explorable."
              )}
            </span>
          </h1>

          <p className="text-sm sm:text-base leading-relaxed text-[#4b5563]">
            {t(
              "汇聚国家数据（data.stats.gov.cn）、全国人口普查公报与年度国民经济统计公报，将分散的中国大陆31省市26年（2000—2025）权威统计资料转化为标准化、可比较、可下载的研究级数据平台。",
              "Transforming official National Bureau of Statistics of China records across 31 mainland provinces (2000–2025) into a clean, verifiable, downloadable research platform."
            )}
          </p>

          {/* Hero Instant Search */}
          <div className="relative pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6b7280]" />
              <input
                type="text"
                data-testid="hero-search-input"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder={t(
                  "搜索指标或省份，如：常住人口、人均GDP、老龄化、医师、广东、浙江...",
                  "Search indicator or province: population, GDP per capita, aging, Guangdong..."
                )}
                className="w-full rounded-xl border border-[#cbd5e1] bg-[#fafaf8] py-3 pl-11 pr-4 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#1e3a5f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15"
              />
            </div>

            {heroQuery.trim().length > 0 && (
              <div
                data-testid="hero-search-results"
                className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-xl space-y-3"
              >
                {heroMatches.indicators.length > 0 && (
                  <div>
                    <div className="px-2 pb-1 text-[11px] font-semibold text-[#6b7280]">
                      {t("匹配指标", "Matching Indicators")}
                    </div>
                    {heroMatches.indicators.map((ind) => (
                      <Link
                        key={ind.indicator_id}
                        href={`/indicators/${ind.indicator_id}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#fafaf8] text-sm"
                      >
                        <span className="font-semibold text-[#111827]">
                          {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en}
                        </span>
                        <span className="text-xs text-[#6b7280]">
                          {lang === "zh" ? ind.category_zh : ind.category_en} · {ind.unit}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {heroMatches.provinces.length > 0 && (
                  <div>
                    <div className="px-2 pb-1 text-[11px] font-semibold text-[#6b7280]">
                      {t("快速查看省份最新人口与经济", "Jump to Province")}
                    </div>
                    <div className="flex flex-wrap gap-2 px-2">
                      {heroMatches.provinces.map((p) => (
                        <button
                          key={p.geo_code}
                          type="button"
                          onClick={() => router.push(`/indicators/population?province=${p.geo_code}`)}
                          className="rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:border-[#1e3a5f]"
                        >
                          {p.geo_name_zh}（{p.region_name_zh}）→
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {heroMatches.indicators.length === 0 && heroMatches.provinces.length === 0 && (
                  <div className="py-3 text-center text-xs text-[#6b7280]">
                    {t(`未找到与「${heroQuery}」相关的指标或省份`, `No results for "${heroQuery}"`)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Topic Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-[#6b7280]">{t("高频查询：", "Popular:")}</span>
            {[
              { id: "population", label: t("常住人口", "Population") },
              { id: "gdp_per_capita", label: t("人均GDP（现价）", "GDP per Capita") },
              { id: "population_65plus", label: t("65岁+老龄化（含2020七普）", "Aged 65+ (2020 Census)") },
              { id: "disposable_income", label: t("人均可支配收入", "Disposable Income") },
              { id: "physicians_per_1000", label: t("每千人口医师数", "Physicians / 1k") },
            ].map((q) => (
              <Link
                key={q.id}
                href={`/indicators/${q.id}`}
                className="rounded-full border border-[#e5e7eb] bg-[#fafaf8] px-3 py-1 font-medium text-[#374151] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Live Coverage & Provenance Ribbon */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[#f3f4f6] pt-6 sm:grid-cols-4">
          <div>
            <div className="text-2xl font-bold text-[#1e3a5f] tabular-nums">
              {bundle.platform.core_indicators_count} / 12
            </div>
            <div className="text-xs text-[#6b7280] mt-0.5">{t("核心基准指标已上线", "Core Benchmark Indicators")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1e3a5f] tabular-nums">
              31 + {t("全国", "CN")}
            </div>
            <div className="text-xs text-[#6b7280] mt-0.5">{t("大陆省级行政区 + 七大区域", "Mainland Provinces + 7 Regions")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1e3a5f] tabular-nums">
              {bundle.platform.earliest_year}–{bundle.platform.latest_year}
            </div>
            <div className="text-xs text-[#6b7280] mt-0.5">{t("官方年度历史时间跨度", "Official Annual Time Span")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1e3a5f] tabular-nums">
              {bundle.platform.total_valid_observations.toLocaleString()}
            </div>
            <div className="text-xs text-[#6b7280] mt-0.5">
              {t(`条有效观测 · ${bundle.platform.total_sources} 个官方源`, `valid observations · ${bundle.platform.total_sources} official sources`)}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Featured Showcase */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">
              {t("省级统计分布交互预览", "Interactive Provincial Overview")}
            </h2>
            <p className="text-xs sm:text-sm text-[#6b7280] mt-1">
              {t("切换核心指标，即刻按七大区域浏览中国大陆31省最新公开统计表现，点击任意省份可溯源或进入完整专题页。", "Switch core indicators to inspect 31 mainland provinces across 7 official regions.")}
            </p>
          </div>
          <Link
            href={`/indicators/${showcaseIndicator.indicator_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] hover:underline"
          >
            {t("进入完整详情页（趋势、排名、CSV）", "Open full indicator page")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {showcaseTabs.map((id) => {
            const ind = bundle.indicators.find((i) => i.indicator_id === id)!;
            const active = showcaseId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setShowcaseId(id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#1e3a5f] text-white"
                    : "border border-[#e5e7eb] bg-white text-[#374151] hover:border-[#1e3a5f]"
                }`}
              >
                {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en}
                <span className={`ml-1.5 text-[10px] ${active ? "text-blue-200" : "text-[#9ca3af]"}`}>
                  ({ind.latest_provincial_year})
                </span>
              </button>
            );
          })}
        </div>

        <RegionalMatrix
          indicator={showcaseIndicator}
          year={showcaseIndicator.latest_provincial_year ?? 2024}
          observations={showcaseObs}
          regions={bundle.regions}
          macroRegions={bundle.macro_regions}
          selectedProvinceCode={selectedProv}
          onSelectProvince={(code) => setSelectedProv(code)}
          comparedProvinces={[]}
          onToggleCompare={(code) =>
            router.push(`/indicators/${showcaseIndicator.indicator_id}?province=${code}#trend`)
          }
          onTraceObservation={(obs) => setTracedObs(obs)}
          mapComplianceNoteZh={bundle.platform.map_compliance_note_zh}
        />
      </section>

      {/* 3. Data-Driven Key Findings */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">
            {t("基于真实数据的关键发现", "Data-Driven Key Findings")}
          </h2>
          <p className="text-xs sm:text-sm text-[#6b7280] mt-1">
            {t("以下所有数值均由标准化观测库自动计算生成，点击卡片直达对应指标专题与官方原始表。", "Automatically computed from normalized official observations; click any card to inspect full provenance.")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundle.featured_insights.map((ins) => (
            <Link
              key={ins.indicator_id}
              href={`/indicators/${ins.indicator_id}`}
              className="group rounded-xl border border-[#e5e7eb] bg-white p-5 hover:border-[#1e3a5f] transition-all flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1e3a5f]">{ins.title_zh}</span>
                  <span className="rounded bg-[#fafaf8] border border-[#e5e7eb] px-1.5 py-0.5 font-mono text-[11px] text-[#4b5563]">
                    {t("省级", "Prov")} {ins.year}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#374151]">{ins.summary_zh}</p>
              </div>
              <div className="flex items-center justify-between border-t border-[#f3f4f6] pt-2.5 text-xs font-semibold text-[#1e3a5f]">
                <span className="tabular-nums">
                  {t("首位：", "Top: ")}
                  {ins.top_province.geo_name_zh} ({formatValue(ins.top_province.value, ins.precision)} {ins.unit})
                </span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Complete Core Indicators Directory by 4 Categories */}
      <section id="indicators" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">
              {t("四大领域 · 12 个核心统计指标", "Core Indicators Across 4 Domains")}
            </h2>
            <p className="text-xs sm:text-sm text-[#6b7280] mt-1">
              {t("明确区分「最新全国统计年份」与「最新完整省级年份」，并标注数据状态与官方单位。", "Explicitly distinguishes latest national year vs. latest complete provincial year.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_META.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`cat-tab-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#1e3a5f] text-white"
                      : "border border-[#e5e7eb] bg-white text-[#4b5563] hover:border-[#1e3a5f]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {lang === "zh" ? cat.zh : cat.en}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredIndicators.map((ind) => (
            <Link
              key={ind.indicator_id}
              href={`/indicators/${ind.indicator_id}`}
              data-testid={`indicator-card-${ind.indicator_id}`}
              className="group rounded-xl border border-[#e5e7eb] bg-white p-5 hover:border-[#1e3a5f] hover:shadow-sm transition-all flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="rounded bg-[#1e3a5f]/8 px-2 py-0.5 font-semibold text-[#1e3a5f]">
                    {lang === "zh" ? ind.category_zh : ind.category_en}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#0f766e] font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    {Math.round(ind.latest_provincial_coverage * 100)}% · {ind.latest_provincial_year}{t("省", "")}
                  </span>
                </div>
                <h3 className="mt-2.5 text-base font-bold text-[#111827] group-hover:text-[#1e3a5f]">
                  {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en}
                </h3>
                <p className="mt-1 text-xs text-[#6b7280] line-clamp-2 leading-relaxed">
                  {lang === "zh" ? ind.definition_zh : ind.definition_en}
                </p>
              </div>

              <div className="border-t border-[#f3f4f6] pt-3 flex items-end justify-between gap-2">
                <div>
                  <div className="text-[11px] text-[#6b7280]">
                    {t("最新全国", "National")} ({ind.latest_national?.year ?? "—"} ·{" "}
                    {ind.latest_national ? dataStatusLabelZh(ind.latest_national.data_status) : "—"})
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-[#111827] tabular-nums">
                    {ind.latest_national
                      ? formatValue(ind.latest_national.value, ind.precision)
                      : "暂无数据"}{" "}
                    <span className="text-xs font-normal text-[#6b7280]">{ind.unit}</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e3a5f]">
                  {t("详情", "Open")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Cross-Indicator Explorer & Open Data CTA */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#1e3a5f]/20 bg-[#1e3a5f] p-6 text-white flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200">
              <Compass className="h-4 w-4" />
              {t("跨指标组合研究 · V0.5 功能", "Cross-Indicator Research · V0.5")}
            </div>
            <h2 className="text-xl font-bold">
              {t("省级跨指标散点探索器", "Cross-Indicator Provincial Explorer")}
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-blue-100">
              {t(
                "自由组合人口、经济、教育与医疗指标（例如：人均GDP与65岁及以上老龄化率、人均可支配收入与每千人口医师数），按七大区域着色并支持年份切换、PNG导出与分享链接。",
                "Compare any two indicators across 31 provinces (e.g., GDP per Capita vs. 65+ Share) with regional coloring, Pearson r, PNG export, and shareable URLs."
              )}
            </p>
          </div>
          <div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#1e3a5f] hover:bg-blue-50"
            >
              {t("打开跨指标探索器", "Launch Explorer")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f766e]">
              <ShieldCheck className="h-4 w-4" />
              {t("可信度、合规性与开放数据", "Credibility, Compliance & Open Data")}
            </div>
            <h2 className="text-xl font-bold text-[#111827]">
              {t("零登录获取全量标准化数据集", "No-Login Standardized Dataset & Methods")}
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-[#4b5563]">
              {t(
                "针对国家数据下载需登录验证码的痛点，本平台开放完整标准化 CSV、数据字典、独立抽样复核说明、地图合规声明与引用规范，支持一键下载与复现。",
                "Download the full normalized observations CSV and JSON data dictionary without logins, alongside full provenance, NBS terms summary, and map compliance documentation."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/data/observations.csv"
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2b5282]"
            >
              <Download className="h-3.5 w-3.5" />
              {t("下载 observations.csv", "Download observations.csv")}
            </a>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-4 py-2 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
            >
              {t("阅读方法与合规文档", "Read Methodology & Licensing")}
            </Link>
          </div>
        </div>
      </section>

      <ProvenanceModal
        observation={tracedObs}
        indicator={showcaseIndicator}
        region={tracedObs ? regionsByCode[tracedObs.geo_code] : undefined}
        onClose={() => setTracedObs(null)}
      />
    </div>
  );
}
