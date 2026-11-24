"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Download, Share2, Check, Info } from "lucide-react";
import type { EChartsOption } from "echarts";
import { useLang } from "./LanguageContext";
import { EChartBox, type EChartBoxHandle } from "./EChartBox";
import { formatValue, computePearsonR } from "@/lib/format";
import type { AtlasBundle, RegionRecord } from "@/lib/types";

const REGION_COLORS: Record<string, string> = {
  NORTH: "#1e3a5f",
  NORTHEAST: "#7c3aed",
  EAST: "#0f766e",
  CENTRAL: "#d97706",
  SOUTH: "#b91c1c",
  SOUTHWEST: "#0284c7",
  NORTHWEST: "#65a30d",
};

export function ExploreClient({ bundle }: { bundle: AtlasBundle }) {
  const { lang, t } = useLang();
  const searchParams = useSearchParams();
  const router = useRouter();
  const chartRef = useRef<EChartBoxHandle>(null);

  const [xId, setXId] = useState("gdp_per_capita");
  const [yId, setYId] = useState("population_65plus");
  const [year, setYear] = useState(2024);
  const [sizeByPop, setSizeByPop] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    const px = searchParams.get("x");
    const py = searchParams.get("y");
    const pyr = searchParams.get("year");
    if (px && bundle.indicators.some((i) => i.indicator_id === px)) setXId(px);
    if (py && bundle.indicators.some((i) => i.indicator_id === py)) setYId(py);
    if (pyr && /^\d{4}$/.test(pyr)) setYear(Number(pyr));
  }, [searchParams, bundle.indicators]);

  const xInd = useMemo(
    () => bundle.indicators.find((i) => i.indicator_id === xId) || bundle.indicators[0],
    [bundle.indicators, xId]
  );
  const yInd = useMemo(
    () => bundle.indicators.find((i) => i.indicator_id === yId) || bundle.indicators[1],
    [bundle.indicators, yId]
  );

  const regionsByCode = useMemo(() => {
    const m: Record<string, RegionRecord> = {};
    bundle.regions.forEach((r) => (m[r.geo_code] = r));
    return m;
  }, [bundle.regions]);

  const commonYears = useMemo(() => {
    const setY = new Set(yInd.provincial_years);
    return xInd.provincial_years.filter((yr) => setY.has(yr)).sort((a, b) => b - a);
  }, [xInd, yInd]);

  useEffect(() => {
    if (commonYears.length > 0 && !commonYears.includes(year)) {
      setYear(commonYears[0]);
    }
  }, [commonYears, year]);

  const points = useMemo(() => {
    const xMap: Record<string, number> = {};
    const yMap: Record<string, number> = {};
    const pMap: Record<string, number> = {};
    (bundle.observations[xInd.indicator_id] || []).forEach((o) => {
      if (o.geo_level === "provincial" && o.year === year) xMap[o.geo_code] = o.value;
    });
    (bundle.observations[yInd.indicator_id] || []).forEach((o) => {
      if (o.geo_level === "provincial" && o.year === year) yMap[o.geo_code] = o.value;
    });
    (bundle.observations["population"] || []).forEach((o) => {
      if (o.geo_level === "provincial" && o.year === year) pMap[o.geo_code] = o.value;
    });

    return bundle.regions
      .filter((r) => r.geo_level === "provincial" && r.in_mainland_nbs_scope === "true")
      .filter((r) => xMap[r.geo_code] !== undefined && yMap[r.geo_code] !== undefined)
      .map((r) => ({
        region: r,
        x: xMap[r.geo_code],
        y: yMap[r.geo_code],
        pop: pMap[r.geo_code] ?? 3000,
      }));
  }, [bundle, xInd, yInd, year]);

  const pearsonR = useMemo(
    () => computePearsonR(points.map((p) => [p.x, p.y])),
    [points]
  );

  const option: EChartsOption = useMemo(() => {
    const series = bundle.macro_regions.map((mr) => {
      const rPoints = points.filter((p) => p.region.region_code === mr.region_code);
      return {
        name: lang === "zh" ? mr.region_name_zh : mr.region_name_en,
        type: "scatter" as const,
        itemStyle: {
          color: REGION_COLORS[mr.region_code] || "#1e3a5f",
          opacity: 0.85,
          borderColor: "#ffffff",
          borderWidth: 1.5,
        },
        label: {
          show: true,
          position: "top" as const,
          fontSize: 10,
          color: "#374151",
          formatter: (p: unknown) => {
            const d = (p as { data: { shortName: string } }).data;
            return d.shortName;
          },
        },
        symbolSize: (val: number[]) => {
          if (!sizeByPop) return 14;
          const pop = val[2] || 3000;
          return Math.max(10, Math.min(34, Math.sqrt(pop) * 0.28));
        },
        data: rPoints.map((pt) => ({
          value: [pt.x, pt.y, pt.pop],
          name: lang === "zh" ? pt.region.geo_name_zh : pt.region.geo_name_en,
          shortName: lang === "zh" ? pt.region.geo_name_short_zh : pt.region.geo_name_en,
          geoCode: pt.region.geo_code,
        })),
      };
    });

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        textStyle: { color: "#111827", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as {
            data: { name: string; value: [number, number, number] };
            seriesName: string;
          };
          const [xv, yv, pv] = p.data.value;
          return `
            <div style="font-weight:700;margin-bottom:4px">${p.data.name} (${p.seriesName}) · ${year}年</div>
            <div>${xInd.indicator_name_zh}: <b>${formatValue(xv, xInd.precision)}</b> ${xInd.unit}</div>
            <div>${yInd.indicator_name_zh}: <b>${formatValue(yv, yInd.precision)}</b> ${yInd.unit}</div>
            <div style="color:#6b7280;margin-top:2px">年末常住人口参考: ${formatValue(pv, 0)} 万人</div>
          `;
        },
      },
      legend: { top: 0, left: 0, type: "scroll", textStyle: { fontSize: 12, color: "#374151" } },
      grid: { left: 20, right: 24, top: 72, bottom: 42, containLabel: true },
      xAxis: {
        type: "value",
        name: `${lang === "zh" ? xInd.indicator_name_zh : xInd.indicator_name_en} (${xInd.unit})`,
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: "#374151", fontWeight: "bold", fontSize: 12 },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        scale: true,
      },
      yAxis: {
        type: "value",
        name: `${lang === "zh" ? yInd.indicator_name_zh : yInd.indicator_name_en} (${yInd.unit})`,
        nameGap: 14,
        nameTextStyle: { color: "#374151", fontWeight: "bold", fontSize: 12, align: "left" },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        scale: true,
      },
      series,
    };
  }, [bundle.macro_regions, points, xInd, yInd, year, sizeByPop, lang]);

  const handleShare = () => {
    const url = `${window.location.origin}/explore?x=${xId}&y=${yId}&year=${year}`;
    router.replace(`/explore?x=${xId}&y=${yId}&year=${year}`, { scroll: false });
    navigator.clipboard?.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const presets = [
    { label: t("人均GDP vs 65岁+老龄化", "GDP/Capita vs Aged 65+"), x: "gdp_per_capita", y: "population_65plus", yr: 2024 },
    { label: t("可支配收入 vs 每千人医师", "Income vs Physicians/1k"), x: "disposable_income", y: "physicians_per_1000", yr: 2024 },
    { label: t("城镇化率 vs 人均GDP", "Urbanization vs GDP/Capita"), x: "urbanization_rate", y: "gdp_per_capita", yr: 2024 },
    { label: t("GDP总量 vs 社会消费品零售", "GDP vs Retail Sales"), x: "gdp", y: "retail_sales", yr: 2024 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827]">
            {t("跨指标省级探索器", "Cross-Indicator Provincial Explorer")}
          </h1>
          <p className="mt-1.5 text-sm text-[#4b5563]">
            {t("组合任意两个官方核心指标，按七大区域观察中国大陆31省的结构特征与统计关联。", "Compare any pair of official indicators across China's 31 mainland provinces colored by 7 regions.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
          >
            {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Share2 className="h-3.5 w-3.5" />}
            {copiedUrl ? t("已复制分享链接", "Link Copied") : t("复制分享链接", "Share Link")}
          </button>
          <button
            type="button"
            onClick={() => chartRef.current?.exportPng(`china-data-atlas_${xId}_vs_${yId}_${year}.png`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2b5282]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("导出 PNG", "Export PNG")}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-[#6b7280]">{t("推荐研究组合：", "Research Presets:")}</span>
        {presets.map((pr) => (
          <button
            key={pr.label}
            type="button"
            onClick={() => {
              setXId(pr.x);
              setYId(pr.y);
              setYear(pr.yr);
            }}
            className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 font-medium text-[#1e3a5f] hover:border-[#1e3a5f]"
          >
            {pr.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#e5e7eb] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs space-y-1">
          <span className="font-semibold text-[#4b5563]">{t("横轴 (X 指标)", "X-Axis Indicator")}</span>
          <select
            value={xId}
            onChange={(e) => setXId(e.target.value)}
            className="w-full rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-3 py-2 text-sm text-[#111827]"
          >
            {bundle.indicators.map((ind) => (
              <option key={ind.indicator_id} value={ind.indicator_id}>
                {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en} ({ind.unit})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs space-y-1">
          <span className="font-semibold text-[#4b5563]">{t("纵轴 (Y 指标)", "Y-Axis Indicator")}</span>
          <select
            value={yId}
            onChange={(e) => setYId(e.target.value)}
            className="w-full rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-3 py-2 text-sm text-[#111827]"
          >
            {bundle.indicators.map((ind) => (
              <option key={ind.indicator_id} value={ind.indicator_id}>
                {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en} ({ind.unit})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs space-y-1">
          <span className="font-semibold text-[#4b5563]">{t("统计年份", "Year")}</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-3 py-2 text-sm text-[#111827] tabular-nums"
          >
            {commonYears.map((yr) => (
              <option key={yr} value={yr}>{yr}{t("年", "")}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end pb-1.5">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#374151] cursor-pointer">
            <input
              type="checkbox"
              checked={sizeByPop}
              onChange={(e) => setSizeByPop(e.target.checked)}
              className="rounded border-gray-300 text-[#1e3a5f]"
            />
            {t("气泡大小映射常住人口规模", "Scale bubbles by population")}
          </label>
        </div>
      </div>

      {/* Chart + Correlation Stat */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] pb-3 text-xs">
          <div className="text-[#374151]">
            {t(`有效配对样本：${points.length} 个大陆省级行政区（${year}年）`, `Matched sample: ${points.length} mainland provinces (${year})`)}
          </div>
          {pearsonR !== null && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#fafaf8] border border-[#e5e7eb] px-3 py-1 tabular-nums">
              <span className="text-[#4b5563]">Pearson r =</span>
              <strong className="text-[#1e3a5f] text-sm">{pearsonR.toFixed(3)}</strong>
              <span className="text-[#6b7280]">({t("相关性 ≠ 因果性", "Correlation ≠ Causation")})</span>
            </div>
          )}
        </div>

        <EChartBox
          ref={chartRef}
          option={option}
          height={480}
          ariaLabel={`${year}年 ${xInd.indicator_name_zh} 与 ${yInd.indicator_name_zh} 省级散点图`}
        />

        <div className="flex items-start gap-2 rounded-lg bg-[#fafaf8] border border-[#e5e7eb] p-3 text-xs text-[#4b5563]">
          <Info className="h-4 w-4 shrink-0 text-[#1e3a5f] mt-0.5" />
          <p>
            {t(
              "统计提醒：横截面省级相关系数仅反映所选年份的统计关联，不能推断因果关系。点击下方链接可分别查看两项指标的完整原始出处与历史口径说明：",
              "Note: Cross-sectional correlation reflects statistical association only and does not imply causation. Inspect full indicator provenance:"
            )}{" "}
            <Link href={`/indicators/${xInd.indicator_id}`} className="font-semibold text-[#1e3a5f] hover:underline">
              {xInd.indicator_name_zh}
            </Link>{" "}
            /{" "}
            <Link href={`/indicators/${yInd.indicator_id}`} className="font-semibold text-[#1e3a5f] hover:underline">
              {yInd.indicator_name_zh}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
