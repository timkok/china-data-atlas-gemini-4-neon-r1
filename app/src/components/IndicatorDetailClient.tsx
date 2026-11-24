"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  ArrowUpDown,
  TrendingUp,
  Info,
} from "lucide-react";
import type { EChartsOption } from "echarts";
import { useLang } from "./LanguageContext";
import { EChartBox, type EChartBoxHandle } from "./EChartBox";
import { RegionalMatrix } from "./RegionalMatrix";
import { DataExplorerTable } from "./DataExplorerTable";
import { ProvenanceModal } from "./ProvenanceModal";
import {
  formatValue,
  computeCompetitionRanking,
  computeCagr,
  aggregationLabelZh,
  dataStatusLabelZh,
} from "@/lib/format";
import type {
  IndicatorSummary,
  MacroRegion,
  ObservationRecord,
  RegionRecord,
  SourceRecord,
} from "@/lib/types";

const SERIES_COLORS = ["#1e3a5f", "#c2410c", "#0f766e", "#6d28d9", "#b45309", "#0369a1", "#be123c"];

interface IndicatorDetailClientProps {
  indicator: IndicatorSummary;
  observations: ObservationRecord[];
  regions: RegionRecord[];
  macroRegions: MacroRegion[];
  sources: SourceRecord[];
  relatedIndicators: IndicatorSummary[];
  mapComplianceNoteZh: string;
}

export function IndicatorDetailClient({
  indicator,
  observations,
  regions,
  macroRegions,
  sources,
  relatedIndicators,
  mapComplianceNoteZh,
}: IndicatorDetailClientProps) {
  const { lang, t } = useLang();
  const searchParams = useSearchParams();
  const trendChartRef = useRef<EChartBoxHandle>(null);
  const rankChartRef = useRef<EChartBoxHandle>(null);

  const defaultProvYear = indicator.latest_provincial_year ?? 2024;
  const minAvailYear = indicator.all_years[0] ?? 2000;
  const maxAvailYear = indicator.all_years[indicator.all_years.length - 1] ?? 2025;

  const [activeYear, setActiveYear] = useState<number>(defaultProvYear);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [comparedProvinces, setComparedProvinces] = useState<string[]>(["440000", "320000", "330000"]);
  const [showNationalLine, setShowNationalLine] = useState<boolean>(true);
  const [startYear, setStartYear] = useState<number>(Math.max(minAvailYear, 2010));
  const [endYear, setEndYear] = useState<number>(maxAvailYear);
  const [rankDescending, setRankDescending] = useState<boolean>(true);
  const [rankRegionFilter, setRankRegionFilter] = useState<string>("all");
  const [tracedObs, setTracedObs] = useState<ObservationRecord | null>(null);
  const [copiedCite, setCopiedCite] = useState<string | null>(null);

  useEffect(() => {
    const provParam = searchParams.get("province");
    if (provParam && /^\d{6}$/.test(provParam)) {
      setSelectedProvince(provParam);
      setComparedProvinces((prev) =>
        prev.includes(provParam) ? prev : [provParam, ...prev.slice(0, 4)]
      );
    }
    const yearParam = searchParams.get("year");
    if (yearParam && /^\d{4}$/.test(yearParam)) {
      setActiveYear(Number(yearParam));
    }
  }, [searchParams]);

  const regionsByCode = useMemo(() => {
    const m: Record<string, RegionRecord> = {};
    regions.forEach((r) => (m[r.geo_code] = r));
    return m;
  }, [regions]);

  const mainlandProvinces = useMemo(
    () =>
      regions.filter(
        (r) => r.geo_level === "provincial" && r.in_mainland_nbs_scope === "true"
      ),
    [regions]
  );

  // Full 2000-2025 year selector options (explicitly flags missing provincial years)
  const allYearChoices = useMemo(() => {
    const ys: number[] = [];
    for (let y = 2025; y >= 2000; y--) ys.push(y);
    return ys;
  }, []);

  const obsByGeoYear = useMemo(() => {
    const m: Record<string, ObservationRecord> = {};
    observations.forEach((o) => {
      m[`${o.geo_code}_${o.year}`] = o;
    });
    return m;
  }, [observations]);

  const activeYearProvObs = useMemo(
    () => observations.filter((o) => o.year === activeYear && o.geo_level === "provincial"),
    [observations, activeYear]
  );

  const activeYearNatObs = useMemo(
    () => observations.find((o) => o.year === activeYear && o.geo_level === "national") ?? null,
    [observations, activeYear]
  );

  const prevComparableProvYear = useMemo(() => {
    const earlier = indicator.provincial_years.filter((y) => y < activeYear);
    return earlier.length > 0 ? earlier[earlier.length - 1] : null;
  }, [indicator.provincial_years, activeYear]);

  const prevYearProvObs = useMemo(
    () =>
      prevComparableProvYear
        ? observations.filter((o) => o.year === prevComparableProvYear && o.geo_level === "provincial")
        : [],
    [observations, prevComparableProvYear]
  );

  const fullRanking = useMemo(
    () =>
      computeCompetitionRanking(
        activeYearProvObs,
        regionsByCode,
        rankDescending,
        prevYearProvObs
      ),
    [activeYearProvObs, regionsByCode, rankDescending, prevYearProvObs]
  );

  const filteredRanking = useMemo(() => {
    if (rankRegionFilter === "all") return fullRanking;
    return fullRanking.filter((r) => r.region_code === rankRegionFilter);
  }, [fullRanking, rankRegionFilter]);

  const missingProvincesForActiveYear = useMemo(() => {
    const present = new Set(activeYearProvObs.map((o) => o.geo_code));
    return mainlandProvinces.filter((p) => !present.has(p.geo_code));
  }, [activeYearProvObs, mainlandProvinces]);

  const toggleCompareProvince = (geoCode: string) => {
    setComparedProvinces((prev) => {
      if (prev.includes(geoCode)) return prev.filter((c) => c !== geoCode);
      if (prev.length >= 6) return [...prev.slice(1), geoCode];
      return [...prev, geoCode];
    });
  };

  // Historical Trend ECharts Option (connectNulls: false — NEVER interpolate missing years)
  const trendYears = useMemo(() => {
    const ys: number[] = [];
    const lo = Math.min(startYear, endYear);
    const hi = Math.max(startYear, endYear);
    for (let y = lo; y <= hi; y++) ys.push(y);
    return ys;
  }, [startYear, endYear]);

  const trendOption: EChartsOption = useMemo(() => {
    const isAdditive = indicator.aggregation_method === "sum";
    const useDualAxis = isAdditive && showNationalLine && comparedProvinces.length > 0;
    const series: EChartsOption["series"] = [];
    if (showNationalLine) {
      series.push({
        name: useDualAxis ? t("全国总计（右轴）", "National (Right)") : t("全国", "China (National)"),
        type: "line",
        yAxisIndex: useDualAxis ? 1 : 0,
        data: trendYears.map((y) => obsByGeoYear[`000000_${y}`]?.value ?? null),
        connectNulls: false,
        smooth: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, type: "dashed", color: "#374151" },
        itemStyle: { color: "#374151" },
        z: 10,
      });
    }
    comparedProvinces.forEach((code, idx) => {
      const reg = regionsByCode[code];
      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
      series.push({
        name: reg ? (lang === "zh" ? reg.geo_name_short_zh : reg.geo_name_en) : code,
        type: "line",
        yAxisIndex: 0,
        data: trendYears.map((y) => obsByGeoYear[`${code}_${y}`]?.value ?? null),
        connectNulls: false,
        smooth: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
      });
    });

    const yAxis: EChartsOption["yAxis"] = useDualAxis
      ? [
          {
            type: "value",
            name: `${t("省级", "Prov.")} (${indicator.unit})`,
            nameTextStyle: { color: "#1e3a5f", fontSize: 11, align: "left" },
            splitLine: { lineStyle: { color: "#f3f4f6" } },
            axisLabel: { color: "#4b5563", fontSize: 11 },
            scale: true,
          },
          {
            type: "value",
            name: `${t("全国总计", "National")} (${indicator.unit})`,
            nameTextStyle: { color: "#4b5563", fontSize: 11, align: "right" },
            splitLine: { show: false },
            axisLabel: { color: "#6b7280", fontSize: 11 },
            scale: true,
          },
        ]
      : {
          type: "value",
          name: indicator.unit,
          nameTextStyle: { color: "#6b7280", fontSize: 11, align: "left" },
          splitLine: { lineStyle: { color: "#f3f4f6" } },
          axisLabel: { color: "#4b5563", fontSize: 11 },
          scale: indicator.unit === "%" || indicator.unit === "‰",
        };

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        textStyle: { color: "#111827", fontSize: 12 },
        valueFormatter: (val) =>
          val === null || val === undefined
            ? t("暂无数据", "No data")
            : `${formatValue(Number(val), indicator.precision)} ${indicator.unit}`,
      },
      legend: {
        top: 2,
        left: 0,
        type: "scroll",
        textStyle: { color: "#374151", fontSize: 12 },
      },
      grid: { left: 16, right: useDualAxis ? 20 : 20, top: 56, bottom: 28, containLabel: true },
      xAxis: {
        type: "category",
        data: trendYears.map(String),
        axisLine: { lineStyle: { color: "#d1d5db" } },
        axisLabel: { color: "#4b5563", fontSize: 11 },
      },
      yAxis,
      series,
    };
  }, [trendYears, showNationalLine, comparedProvinces, obsByGeoYear, regionsByCode, indicator, lang, t]);

  // Ranking Horizontal Bar Chart Option
  const rankChartOption: EChartsOption = useMemo(() => {
    const items = [...filteredRanking].reverse();
    const showNatBenchmark = activeYearNatObs && indicator.aggregation_method !== "sum";
    const markLineData = showNatBenchmark
      ? [
          {
            xAxis: activeYearNatObs.value,
            name: t("全国基准", "National"),
            label: {
              formatter: `${t("全国", "CN")}: ${formatValue(activeYearNatObs.value, indicator.precision)}`,
              color: "#b91c1c",
              fontWeight: "bold" as const,
              fontSize: 11,
            },
            lineStyle: { color: "#b91c1c", type: "dashed" as const, width: 1.8 },
          },
        ]
      : [];

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        textStyle: { color: "#111827", fontSize: 12 },
      },
      grid: { left: 12, right: 54, top: 28, bottom: 20, containLabel: true },
      xAxis: {
        type: "value",
        name: indicator.unit,
        nameTextStyle: { color: "#6b7280", fontSize: 11 },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLabel: { color: "#4b5563", fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: items.map((r) => `#${r.rank} ${lang === "zh" ? r.geo_name_short_zh : r.geo_name_en}`),
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: { color: "#111827", fontSize: 11 },
      },
      series: [
        {
          name: lang === "zh" ? indicator.indicator_name_zh : indicator.indicator_name_en,
          type: "bar",
          data: items.map((r) => ({
            value: r.value,
            itemStyle: {
              color:
                selectedProvince === r.geo_code
                  ? "#b91c1c"
                  : comparedProvinces.includes(r.geo_code)
                    ? "#0f766e"
                    : "#1e3a5f",
              borderRadius: [0, 3, 3, 0],
            },
          })),
          barMaxWidth: 16,
          markLine: markLineData.length > 0 ? { symbol: "none", data: markLineData } : undefined,
        },
      ],
    };
  }, [filteredRanking, activeYearNatObs, indicator, selectedProvince, comparedProvinces, lang, t]);

  // 7-Region Bar Chart Option
  const regionalEntries = useMemo(() => {
    const raw = indicator.regional_aggregates[String(activeYear)] || [];
    return macroRegions.map((mr) => {
      const entry = raw.find((e) => e.region_code === mr.region_code);
      return {
        ...mr,
        value: entry?.value ?? null,
        complete: entry?.complete ?? false,
        provinces_present: entry?.provinces_present ?? 0,
        provinces_total: entry?.provinces_total ?? 0,
      };
    });
  }, [indicator.regional_aggregates, activeYear, macroRegions]);

  const regionalChartOption: EChartsOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        textStyle: { color: "#111827", fontSize: 12 },
      },
      grid: { left: 16, right: 20, top: 28, bottom: 24, containLabel: true },
      xAxis: {
        type: "category",
        data: regionalEntries.map((r) => (lang === "zh" ? r.region_name_zh : r.region_name_en)),
        axisLabel: { color: "#111827", fontSize: 12 },
        axisLine: { lineStyle: { color: "#d1d5db" } },
      },
      yAxis: {
        type: "value",
        name: indicator.unit,
        nameTextStyle: { color: "#6b7280", fontSize: 11 },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLabel: { color: "#4b5563", fontSize: 11 },
      },
      series: [
        {
          name: aggregationLabelZh(indicator.aggregation_method),
          type: "bar",
          barMaxWidth: 42,
          data: regionalEntries.map((r) => ({
            value: r.value,
            itemStyle: { color: "#1e3a5f", borderRadius: [4, 4, 0, 0] },
          })),
          label: {
            show: true,
            position: "top",
            fontSize: 11,
            color: "#374151",
            formatter: (p) =>
              p.value === null || p.value === undefined
                ? ""
                : formatValue(Number(p.value), indicator.precision),
          },
        },
      ],
    };
  }, [regionalEntries, indicator, lang]);

  // Multi-province comparison delta summary
  const comparisonRows = useMemo(() => {
    const lo = Math.min(startYear, endYear);
    const hi = Math.max(startYear, endYear);
    return comparedProvinces.map((code) => {
      const reg = regionsByCode[code];
      const vStart = obsByGeoYear[`${code}_${lo}`]?.value ?? null;
      const vEnd = obsByGeoYear[`${code}_${hi}`]?.value ?? null;
      const absDiff = vStart !== null && vEnd !== null ? vEnd - vStart : null;
      const relPct = vStart !== null && vEnd !== null && vStart !== 0 ? ((vEnd - vStart) / Math.abs(vStart)) * 100 : null;
      const cagr =
        indicator.unit !== "%" && indicator.unit !== "‰"
          ? computeCagr(vStart, vEnd, hi - lo)
          : null;
      return { code, reg, vStart, vEnd, absDiff, relPct, cagr, lo, hi };
    });
  }, [comparedProvinces, startYear, endYear, obsByGeoYear, regionsByCode, indicator.unit]);

  // Indicator-specific official sources
  const indicatorSources = useMemo(
    () => sources.filter((s) => indicator.source_ids.includes(s.source_id)),
    [sources, indicator.source_ids]
  );

  const citationGb = `国家统计局. ${indicator.indicator_name_zh}（${minAvailYear}—${maxAvailYear}）[DB/OL]. 中国数据地图（China Data Atlas）整理自国家数据（data.stats.gov.cn）及国家统计局网站（www.stats.gov.cn）, 2026.`;
  const citationApa = `National Bureau of Statistics of China. (${maxAvailYear}). ${indicator.indicator_name_en} (${minAvailYear}-${maxAvailYear}) [Dataset]. Compiled by China Data Atlas from data.stats.gov.cn & www.stats.gov.cn.`;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCite(key);
    setTimeout(() => setCopiedCite(null), 2000);
  };

  const sections = [
    { id: "summary", label: t("概览", "Summary") },
    { id: "spatial", label: t("区域矩阵", "Matrix") },
    { id: "trend", label: t("历史趋势", "Trend") },
    { id: "rankings", label: t("省级排名", "Rankings") },
    { id: "regions", label: t("七大区域对比", "Regions") },
    { id: "explorer", label: t("数据浏览器 & CSV", "Data Explorer") },
    { id: "methodology", label: t("方法与引用", "Methodology") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-10">
      {/* Breadcrumb & Header */}
      <section id="summary" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-[#1e3a5f]">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("首页", "Home")}
          </Link>
          <span>/</span>
          <span className="font-medium text-[#1e3a5f]">
            {lang === "zh" ? indicator.category_zh : indicator.category_en}
          </span>
          <span>/</span>
          <span className="font-mono text-[#6b7280]">{indicator.indicator_id}</span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="rounded-full bg-[#1e3a5f]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1e3a5f]">
                {lang === "zh" ? indicator.category_zh : indicator.category_en}
              </span>
              <span className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-0.5 text-xs text-[#4b5563]">
                {t("基准单位：", "Unit: ")}
                <strong>{lang === "zh" ? indicator.unit : indicator.unit_en}</strong>
              </span>
              {indicator.indicator_id === "gdp" || indicator.indicator_id === "gdp_per_capita" ? (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  {t("现价口径 (Current Prices)", "Current Prices")}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
              {lang === "zh" ? indicator.indicator_name_zh : indicator.indicator_name_en}
            </h1>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#4b5563]">
              {lang === "zh" ? indicator.definition_zh : indicator.definition_en}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="#explorer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2b5282]"
            >
              <Download className="h-3.5 w-3.5" />
              {t("浏览与下载 CSV", "Explore & CSV")}
            </a>
            <a
              href="#methodology"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
            >
              {t("口径与引用", "Cite & Methods")}
            </a>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Latest National */}
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-center justify-between text-xs text-[#6b7280]">
              <span>{t("最新全国统计值", "Latest National Value")}</span>
              {indicator.latest_national && (
                <span className="rounded bg-[#1e3a5f]/10 px-1.5 py-0.5 font-mono font-semibold text-[#1e3a5f]">
                  {indicator.latest_national.year}{t("年", "")}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
              <span data-testid="kpi-national-value" className="text-2xl font-bold text-[#111827]">
                {indicator.latest_national
                  ? formatValue(indicator.latest_national.value, indicator.precision)
                  : "暂无数据"}
              </span>
              <span className="text-xs text-[#6b7280]">{indicator.unit}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px]">
              {indicator.latest_national && (
                <span className="text-[#4b5563]">
                  {dataStatusLabelZh(indicator.latest_national.data_status)}
                </span>
              )}
              {indicator.latest_national_yoy && (
                <span
                  className="font-semibold text-[#0f766e] tabular-nums"
                  title={indicator.latest_national_yoy.note}
                >
                  {indicator.latest_national_yoy.is_rate_unit
                    ? `${indicator.latest_national_yoy.abs_change >= 0 ? "+" : ""}${indicator.latest_national_yoy.abs_change.toFixed(2)} (${indicator.latest_national_yoy.from_year}→${indicator.latest_national_yoy.to_year})`
                    : `${indicator.latest_national_yoy.pct_change >= 0 ? "+" : ""}${indicator.latest_national_yoy.pct_change.toFixed(2)}% (${indicator.latest_national_yoy.from_year}→${indicator.latest_national_yoy.to_year})`}
                </span>
              )}
            </div>
          </div>

          {/* KPI 2: Latest Provincial Year & Coverage */}
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-center justify-between text-xs text-[#6b7280]">
              <span>{t("最新完整省级年份", "Latest Provincial Year")}</span>
              <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-semibold text-emerald-800 tabular-nums">
                {Math.round(indicator.latest_provincial_coverage * 100)}% {t("覆盖", "Cov.")}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span data-testid="kpi-provincial-year" className="text-2xl font-bold text-[#111827]">
                {indicator.latest_provincial_year ?? "—"}{t("年", "")}
              </span>
              <span className="text-xs text-[#6b7280]">
                {t("31/31 大陆省级行政区", "31/31 Mainland Provinces")}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#6b7280]">
              {indicator.latest_national &&
              indicator.latest_provincial_year &&
              indicator.latest_national.year > indicator.latest_provincial_year
                ? t(
                    `注：${indicator.latest_national.year}年公报仅发布全国数，省级最新为${indicator.latest_provincial_year}年`,
                    `Note: ${indicator.latest_national.year} is national communique only`
                  )
                : t("全国与31省已同步至最新公开年度", "National & 31 provinces aligned")}
            </p>
          </div>

          {/* KPI 3: Top & Bottom Province */}
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
            <div className="text-xs text-[#6b7280]">
              {t(`${indicator.latest_provincial_year ?? ""}年省级极值`, `${indicator.latest_provincial_year ?? ""} Provincial Extremes`)}
            </div>
            {indicator.top3_latest[0] && indicator.bottom3_latest[0] ? (
              <div className="mt-2 space-y-1.5 text-xs tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-[#4b5563]">
                    {t("最高：", "Highest: ")}
                    <strong className="text-[#111827]">{indicator.top3_latest[0].geo_name_zh}</strong>
                  </span>
                  <span className="font-bold text-[#1e3a5f]">
                    {formatValue(indicator.top3_latest[0].value, indicator.precision)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4b5563]">
                    {t("最低：", "Lowest: ")}
                    <strong className="text-[#111827]">{indicator.bottom3_latest[0].geo_name_zh}</strong>
                  </span>
                  <span className="font-semibold text-[#6b7280]">
                    {formatValue(indicator.bottom3_latest[0].value, indicator.precision)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-[#6b7280]">—</div>
            )}
          </div>

          {/* KPI 4: Time Span & Provenance */}
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
            <div className="text-xs text-[#6b7280]">{t("数据跨度与核验", "Time Span & Verification")}</div>
            <div className="mt-2 text-2xl font-bold text-[#111827] tabular-nums">
              {minAvailYear}–{maxAvailYear}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#4b5563] tabular-nums">
              <span>{indicator.observation_count.toLocaleString()} {t("条有效记录", "valid rows")}</span>
              <span className="text-[#0f766e] font-medium">
                {indicator.latest_national && (
                  <button
                    type="button"
                    onClick={() => setTracedObs(indicator.latest_national)}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("溯源", "Trace")}
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Data-Driven Finding Banner */}
        {indicator.key_finding_zh && (
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 shrink-0 text-[#1e3a5f] mt-0.5" />
            <div className="text-sm leading-relaxed text-[#374151]">
              <span className="font-bold text-[#111827] mr-1.5">
                {t("基于真实数据的核心发现：", "Data-Driven Key Finding:")}
              </span>
              {indicator.key_finding_zh}
            </div>
          </div>
        )}
      </section>

      {/* Sticky Section Sub-Nav */}
      <nav
        aria-label={t("页面章节导航", "Section navigation")}
        className="sticky top-16 z-30 -mx-4 border-y border-[#e5e7eb] bg-[#fafaf8]/95 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-[#4b5563] hover:bg-white hover:text-[#1e3a5f] transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* B. Compliant 7-Region Provincial Matrix */}
      <section id="spatial" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#111827]">
              {t("省级空间分布矩阵", "Provincial Spatial Matrix")}
            </h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {t("点击任意省份查看详情、溯源或加入历史趋势对比；支持切换统计年份。", "Click any province to inspect details, trace provenance, or compare trends.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {indicator.indicator_id === "population_65plus" && (
              <button
                type="button"
                data-testid="jump-2020-census"
                onClick={() => setActiveYear(2020)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  activeYear === 2020
                    ? "bg-[#b91c1c] text-white border-[#b91c1c]"
                    : "bg-white text-[#b91c1c] border-[#b91c1c]/40 hover:bg-red-50"
                }`}
              >
                {t("2020年（七普全数口径）", "2020 (7th Census)")}
              </button>
            )}
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#374151]">
              <span>{t("统计年份：", "Year:")}</span>
              <select
                data-testid="active-year-select"
                value={activeYear}
                onChange={(e) => setActiveYear(Number(e.target.value))}
                className="rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-sm font-semibold text-[#111827] tabular-nums focus:border-[#1e3a5f] focus:outline-none"
              >
                {allYearChoices.map((y) => {
                  const hasProv = indicator.provincial_years.includes(y);
                  return (
                    <option key={y} value={y}>
                      {y}{t("年", "")}{hasProv ? "" : t("（无省级数据）", " (no prov. data)")}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </div>

        {/* Special Census Methodology Banner when viewing 2020 population_65plus */}
        {indicator.indicator_id === "population_65plus" && activeYear === 2020 && (
          <div
            data-testid="census-2020-banner"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950 flex items-start gap-2.5"
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
            <div>
              <strong>{t("2020年第七次全国人口普查全数登记口径：", "2020 Seventh National Population Census (Full Enumeration): ")}</strong>
              {t(
                "2020年数据直接采自国家统计局《第七次全国人口普查公报（第五号）》表5-2（标准时点：2020年11月1日零时，全国65岁及以上占比13.50%），为全数登记口径；其余非普查年份来自国家统计局年度人口变动情况抽样调查（约千分之一抽样），跨口径比较时请注意抽样误差与普查修订。",
                "2020 values come directly from NBS Seventh National Population Census Bulletin No. 5 (Nov 1, 2020 full enumeration; National 13.50%). Non-census years derive from annual 1‰ population sample surveys."
              )}
            </div>
          </div>
        )}

        <RegionalMatrix
          indicator={indicator}
          year={activeYear}
          observations={observations}
          regions={regions}
          macroRegions={macroRegions}
          selectedProvinceCode={selectedProvince}
          onSelectProvince={(code) => setSelectedProvince(code)}
          comparedProvinces={comparedProvinces}
          onToggleCompare={toggleCompareProvince}
          onTraceObservation={(obs) => setTracedObs(obs)}
          mapComplianceNoteZh={mapComplianceNoteZh}
        />
      </section>

      {/* C. Historical Trend */}
      <section id="trend" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#111827]">
              {t("历史趋势与多省对比", "Historical Trend & Multi-Province Comparison")}
            </h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {t("展示真实观测年份数值，缺失年份自动断开（绝不插值伪造）。最多同时对比 6 个省份。", "Displays actual observed years only; missing years break cleanly without interpolation.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              trendChartRef.current?.exportPng(`china-data-atlas_${indicator.indicator_id}_trend.png`)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("导出趋势图 PNG", "Export PNG")}
          </button>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5 space-y-4">
          {/* Trend Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] pb-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#4b5563]">{t("快捷组合：", "Presets:")}</span>
              <button
                type="button"
                data-testid="preset-js-zj-gd"
                onClick={() => {
                  setComparedProvinces(["320000", "330000", "440000"]);
                  setStartYear(Math.max(minAvailYear, 2015));
                  setEndYear(maxAvailYear);
                }}
                className="rounded-md border border-[#d1d5db] bg-[#fafaf8] px-2.5 py-1 font-medium text-[#1e3a5f] hover:border-[#1e3a5f]"
              >
                {t("苏浙粤 (2015至今)", "JS · ZJ · GD (2015+)")}
              </button>
              <button
                type="button"
                data-testid="preset-sd-ha-gd"
                onClick={() => {
                  setComparedProvinces(["370000", "410000", "440000"]);
                }}
                className="rounded-md border border-[#d1d5db] bg-[#fafaf8] px-2.5 py-1 font-medium text-[#1e3a5f] hover:border-[#1e3a5f]"
              >
                {t("鲁豫粤对比", "SD · HA · GD")}
              </button>
              <button
                type="button"
                onClick={() => setComparedProvinces(["110000", "310000", "120000", "500000"])}
                className="rounded-md border border-[#d1d5db] bg-[#fafaf8] px-2.5 py-1 font-medium text-[#1e3a5f] hover:border-[#1e3a5f]"
              >
                {t("四大直辖市", "4 Municipalities")}
              </button>
              <label className="inline-flex items-center gap-1.5 ml-2 cursor-pointer text-[#374151]">
                <input
                  type="checkbox"
                  checked={showNationalLine}
                  onChange={(e) => setShowNationalLine(e.target.checked)}
                  className="rounded border-gray-300 text-[#1e3a5f]"
                />
                {t("显示全国曲线", "Show National")}
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#6b7280]">{t("年份区间：", "Range:")}</span>
              <select
                aria-label={t("起始年份", "Start year")}
                data-testid="trend-start-year"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="rounded border border-[#d1d5db] bg-white px-2 py-1 text-xs tabular-nums"
              >
                {allYearChoices.slice().reverse().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span>—</span>
              <select
                aria-label={t("结束年份", "End year")}
                data-testid="trend-end-year"
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className="rounded border border-[#d1d5db] bg-white px-2 py-1 text-xs tabular-nums"
              >
                {allYearChoices.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Province Chip Picker */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[#6b7280] mr-1">
              {t("已选省份", "Selected")} ({comparedProvinces.length}/6):
            </span>
            {comparedProvinces.map((code, idx) => {
              const reg = regionsByCode[code];
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleCompareProvince(code)}
                  style={{ borderColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                  className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold text-[#111827] hover:bg-gray-50"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                  />
                  {reg ? (lang === "zh" ? reg.geo_name_short_zh : reg.geo_name_en) : code}
                  <span className="text-[#9ca3af] ml-0.5">×</span>
                </button>
              );
            })}
            <select
              aria-label={t("添加省份到趋势对比", "Add province to trend")}
              data-testid="trend-add-province"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleCompareProvince(e.target.value);
              }}
              className="rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-2.5 py-1 text-xs text-[#374151]"
            >
              <option value="">{t("+ 添加省份...", "+ Add province...")}</option>
              {mainlandProvinces
                .filter((p) => !comparedProvinces.includes(p.geo_code))
                .map((p) => (
                  <option key={p.geo_code} value={p.geo_code}>
                    {lang === "zh" ? p.geo_name_zh : p.geo_name_en} ({p.region_name_zh})
                  </option>
                ))}
            </select>
          </div>

          <EChartBox
            ref={trendChartRef}
            option={trendOption}
            height={380}
            ariaLabel={`${indicator.indicator_name_zh} 历史趋势折线图`}
          />

          {/* Side-by-side comparison delta table */}
          {comparisonRows.length > 0 && (
            <div className="overflow-x-auto border-t border-[#f3f4f6] pt-3">
              <table className="min-w-full text-xs">
                <thead className="text-[#6b7280] border-b border-[#f3f4f6]">
                  <tr>
                    <th className="py-2 pr-3 text-left font-semibold">{t("对比省份", "Province")}</th>
                    <th className="py-2 px-3 text-right font-semibold tabular-nums">{Math.min(startYear, endYear)}{t("年", "")}</th>
                    <th className="py-2 px-3 text-right font-semibold tabular-nums">{Math.max(startYear, endYear)}{t("年", "")}</th>
                    <th className="py-2 px-3 text-right font-semibold">{t("绝对变化", "Abs Change")}</th>
                    <th className="py-2 px-3 text-right font-semibold">{t("累计变动", "Rel Change")}</th>
                    {indicator.unit !== "%" && indicator.unit !== "‰" && (
                      <th className="py-2 pl-3 text-right font-semibold">CAGR</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f9fafb] tabular-nums">
                  {comparisonRows.map((row) => (
                    <tr key={row.code}>
                      <td className="py-2 pr-3 font-semibold text-[#111827]">
                        {row.reg ? (lang === "zh" ? row.reg.geo_name_zh : row.reg.geo_name_en) : row.code}
                      </td>
                      <td className="py-2 px-3 text-right text-[#4b5563]">
                        {formatValue(row.vStart, indicator.precision)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-[#1e3a5f]">
                        {formatValue(row.vEnd, indicator.precision)}
                      </td>
                      <td className="py-2 px-3 text-right text-[#374151]">
                        {row.absDiff !== null
                          ? `${row.absDiff >= 0 ? "+" : ""}${formatValue(row.absDiff, indicator.precision)}`
                          : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-[#374151]">
                        {row.relPct !== null
                          ? `${row.relPct >= 0 ? "+" : ""}${row.relPct.toFixed(2)}%`
                          : "—"}
                      </td>
                      {indicator.unit !== "%" && indicator.unit !== "‰" && (
                        <td className="py-2 pl-3 text-right font-medium text-[#0f766e]">
                          {row.cagr !== null ? `${row.cagr >= 0 ? "+" : ""}${row.cagr.toFixed(2)}%` : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* D. Rankings */}
      <section id="rankings" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#111827]">
              {activeYear}{t("年省级排名", " Provincial Rankings")}
            </h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {t("采用标准竞争并列名次（如 1, 2, 2, 4）；缺失数据不参与排名；红虚线为当年全国基准值。", "Standard competition ranking (1, 2, 2, 4); missing provinces excluded from rank; dashed red line indicates national benchmark.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="ranking-sort-toggle"
              onClick={() => setRankDescending((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:border-[#1e3a5f]"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {rankDescending ? t("当前：降序（高→低）", "Order: Desc (High→Low)") : t("当前：升序（低→高）", "Order: Asc (Low→High)")}
            </button>
            <button
              type="button"
              onClick={() =>
                rankChartRef.current?.exportPng(`china-data-atlas_${indicator.indicator_id}_${activeYear}_ranking.png`)
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
            >
              <Download className="h-3.5 w-3.5" />
              PNG
            </button>
          </div>
        </div>

        {/* 7-Region Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="rank-region-all"
            onClick={() => setRankRegionFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              rankRegionFilter === "all"
                ? "bg-[#1e3a5f] text-white"
                : "border border-[#e5e7eb] bg-white text-[#4b5563] hover:border-[#1e3a5f]"
            }`}
          >
            {t("全部地区", "All Regions")} ({fullRanking.length})
          </button>
          {macroRegions.map((mr) => (
            <button
              key={mr.region_code}
              type="button"
              data-testid={`rank-region-${mr.region_code}`}
              onClick={() => setRankRegionFilter(mr.region_code)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                rankRegionFilter === mr.region_code
                  ? "bg-[#1e3a5f] text-white"
                  : "border border-[#e5e7eb] bg-white text-[#4b5563] hover:border-[#1e3a5f]"
              }`}
            >
              {lang === "zh" ? mr.region_name_zh : mr.region_name_en}
            </button>
          ))}
        </div>

        {filteredRanking.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d1d5db] bg-[#fafaf8] p-8 text-center text-sm text-[#6b7280]">
            {activeYear}{t("年暂无可排名的省级数据。", " has no provincial data available for ranking.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-xl border border-[#e5e7eb] bg-white p-4">
              <EChartBox
                ref={rankChartRef}
                option={rankChartOption}
                height={Math.max(300, filteredRanking.length * 24 + 60)}
                ariaLabel={`${activeYear}年 ${indicator.indicator_name_zh} 省级排名条形图`}
              />
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
              <div className="max-h-[780px] overflow-y-auto">
                <table className="min-w-full divide-y divide-[#e5e7eb] text-xs">
                  <thead className="sticky top-0 bg-[#fafaf8] font-semibold text-[#4b5563]">
                    <tr>
                      <th className="px-3 py-2.5 text-left">{t("名次", "Rank")}</th>
                      <th className="px-3 py-2.5 text-left">{t("省份", "Province")}</th>
                      <th className="px-3 py-2.5 text-right">{t("数值", "Value")}</th>
                      <th className="px-3 py-2.5 text-right">
                        {prevComparableProvYear ? t(`较${prevComparableProvYear}`, `vs ${prevComparableProvYear}`) : t("变化", "Delta")}
                      </th>
                      <th className="px-3 py-2.5 text-right">{t("溯源", "Src")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6] tabular-nums">
                    {filteredRanking.map((item) => (
                      <tr
                        key={item.geo_code}
                        data-testid={`ranking-row-${item.geo_code}`}
                        className="hover:bg-[#fafaf8]"
                      >
                        <td className="px-3 py-2 font-bold text-[#1e3a5f]">#{item.rank}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold text-[#111827]">
                            {lang === "zh" ? item.geo_name_short_zh : item.geo_name_en}
                          </span>
                          <span className="ml-1 text-[10px] text-[#9ca3af]">{item.region_name_zh}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#111827]">
                          {formatValue(item.value, indicator.precision)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.rankDelta === null ? (
                            <span className="text-[#9ca3af]">—</span>
                          ) : item.rankDelta > 0 ? (
                            <span className="text-emerald-700 font-semibold">▲{item.rankDelta}</span>
                          ) : item.rankDelta < 0 ? (
                            <span className="text-rose-700 font-semibold">▼{Math.abs(item.rankDelta)}</span>
                          ) : (
                            <span className="text-[#9ca3af]">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setTracedObs(item.observation)}
                            className="text-[#1e3a5f] hover:underline"
                          >
                            {t("查看", "View")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {missingProvincesForActiveYear.length > 0 && rankRegionFilter === "all" && (
                <div className="border-t border-[#e5e7eb] bg-[#fafaf8] px-3 py-2 text-[11px] text-[#6b7280]">
                  {t("未参与排名（当年暂无数据）：", "Excluded (no data): ")}
                  {missingProvincesForActiveYear.map((p) => p.geo_name_short_zh).join("、")}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* E. Seven-Region Weighted Comparison */}
      <section id="regions" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#111827]">
              {activeYear}{t("年七大区域对比", " Seven-Region Comparison")}
            </h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {t("区域聚合规则：", "Aggregation rule: ")}
              <strong className="text-[#1e3a5f]">{aggregationLabelZh(indicator.aggregation_method)}</strong>
              {t("（严禁对比率/人均指标执行简单算术平均或求和）", " (strictly weighted; never naive mean/sum for rates)")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
          {regionalEntries.every((e) => e.value === null) ? (
            <div className="py-8 text-center text-sm text-[#6b7280]">
              {activeYear}{t("年缺少完整的省级指标或人口权重数据，故不展示可能产生误导的区域汇总值。", " lacks complete provincial/weight data for regional aggregation.")}
            </div>
          ) : (
            <EChartBox
              option={regionalChartOption}
              height={320}
              ariaLabel={`${activeYear}年七大区域${indicator.indicator_name_zh}对比柱状图`}
            />
          )}
        </div>
      </section>

      {/* F. Data Explorer & Synchronized CSV Download */}
      <section id="explorer" className="scroll-mt-32 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">
            {t("Data Explorer 数据浏览器与 CSV 下载", "Data Explorer & CSV Download")}
          </h2>
          <p className="text-xs text-[#6b7280] mt-0.5">
            {t("支持搜索、排序、年份与地区筛选；下载的 CSV 与当前页面筛选结果完全一致；点击任意行出处可追溯原始官方表格。", "Search, sort, and filter rows; downloaded CSV strictly matches your current filter state.")}
          </p>
        </div>

        <DataExplorerTable
          indicator={indicator}
          observations={observations}
          regions={regions}
          macroRegions={macroRegions}
          onTraceObservation={(obs) => setTracedObs(obs)}
        />
      </section>

      {/* G. Methodology, Caveats, Sources & Citation */}
      <section id="methodology" className="scroll-mt-32 space-y-5">
        <h2 className="text-xl font-bold text-[#111827]">
          {t("统计口径、数据来源与推荐引用", "Methodology, Sources & Citation")}
        </h2>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#111827]">
              {t("指标定义与口径注意事项", "Definition & Statistical Caveats")}
            </h3>
            <p className="text-xs leading-relaxed text-[#374151]">{indicator.definition_zh}</p>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-950 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <div className="font-semibold mb-0.5">{t("口径与修订提醒", "Methodology & Revision Notes")}</div>
                <p>{indicator.caveats_zh}</p>
              </div>
            </div>
            <div className="text-xs text-[#4b5563]">
              <strong>{t("聚合方法：", "Aggregation: ")}</strong>
              {aggregationLabelZh(indicator.aggregation_method)}
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#111827]">
              {t("推荐引用格式（Citation）", "Recommended Citation")}
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafaf8] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[#4b5563]">GB/T 7714 中文格式</span>
                  <button
                    type="button"
                    onClick={() => copyText("gb", citationGb)}
                    className="inline-flex items-center gap-1 text-[#1e3a5f] hover:underline"
                  >
                    {copiedCite === "gb" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCite === "gb" ? t("已复制", "Copied") : t("复制", "Copy")}
                  </button>
                </div>
                <p className="text-[#111827] leading-relaxed select-all">{citationGb}</p>
              </div>

              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafaf8] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[#4b5563]">APA Format</span>
                  <button
                    type="button"
                    onClick={() => copyText("apa", citationApa)}
                    className="inline-flex items-center gap-1 text-[#1e3a5f] hover:underline"
                  >
                    {copiedCite === "apa" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCite === "apa" ? t("已复制", "Copied") : t("复制", "Copy")}
                  </button>
                </div>
                <p className="text-[#111827] leading-relaxed select-all">{citationApa}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Official Sources Table */}
        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
          <div className="border-b border-[#e5e7eb] bg-[#fafaf8] px-5 py-3 text-xs font-bold text-[#111827]">
            {t("本指标关联的官方数据来源清单", "Official Data Sources for This Indicator")}
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {indicatorSources.map((src) => (
              <div key={src.source_id} className="p-4 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[#111827]">
                    {src.source_title}
                    <span className="ml-2 font-normal text-[#6b7280]">({src.source_agency})</span>
                  </div>
                  <a
                    href={src.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#1e3a5f] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("官方来源链接", "Official URL")}
                  </a>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-[#4b5563]">
                  <span>{t("真实性核验：", "Authenticity: ")}<strong>{src.authenticity_verified}</strong></span>
                  <span>{t("合法访问：", "Lawful access: ")}<strong>{src.lawful_access_confirmed}</strong></span>
                  <span>{t("再发布许可状态：", "Redistribution: ")}<strong>{src.redistribution_status}</strong></span>
                </div>
                <p className="text-[#6b7280]">{src.terms_summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related Indicators */}
        {relatedIndicators.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-[#111827]">
              {t("相关统计指标", "Related Indicators")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {relatedIndicators.map((rel) => (
                <Link
                  key={rel.indicator_id}
                  href={`/indicators/${rel.indicator_id}`}
                  className="rounded-xl border border-[#e5e7eb] bg-white p-4 hover:border-[#1e3a5f] transition-colors"
                >
                  <div className="text-xs text-[#6b7280]">
                    {lang === "zh" ? rel.category_zh : rel.category_en}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[#111827]">
                    {lang === "zh" ? rel.indicator_name_zh : rel.indicator_name_en}
                  </div>
                  {rel.latest_national && (
                    <div className="mt-2 text-xs text-[#1e3a5f] font-semibold tabular-nums">
                      {t("全国", "CN")} ({rel.latest_national.year}):{" "}
                      {formatValue(rel.latest_national.value, rel.precision)} {rel.unit}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <ProvenanceModal
        observation={tracedObs}
        indicator={indicator}
        region={tracedObs ? regionsByCode[tracedObs.geo_code] : undefined}
        onClose={() => setTracedObs(null)}
      />
    </div>
  );
}
