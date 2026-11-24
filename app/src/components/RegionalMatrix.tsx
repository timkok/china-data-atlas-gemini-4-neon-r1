"use client";

import React, { useMemo, useState } from "react";
import { ShieldCheck, Info, PlusCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { useLang } from "./LanguageContext";
import { formatValue, computeCompetitionRanking } from "@/lib/format";
import type { IndicatorSummary, MacroRegion, ObservationRecord, RegionRecord } from "@/lib/types";

const PALETTES: Record<string, string[]> = {
  demographics: ["#e6f4f1", "#b2dfdb", "#66bab7", "#268e8a", "#0f6865", "#0a4745"],
  economy: ["#e8f0fe", "#bdd4fb", "#7ca9f5", "#3b76d6", "#1e4fa0", "#14316b"],
  education: ["#fef3c7", "#fde08a", "#f5b841", "#d97706", "#b45309", "#78350f"],
  health: ["#e6f7ee", "#b2e5ca", "#68c798", "#229a65", "#0f7148", "#064e31"],
};

interface RegionalMatrixProps {
  indicator: IndicatorSummary;
  year: number;
  observations: ObservationRecord[];
  regions: RegionRecord[];
  macroRegions: MacroRegion[];
  selectedProvinceCode: string | null;
  onSelectProvince: (geoCode: string) => void;
  comparedProvinces: string[];
  onToggleCompare: (geoCode: string) => void;
  onTraceObservation: (obs: ObservationRecord) => void;
  mapComplianceNoteZh: string;
}

export function RegionalMatrix({
  indicator,
  year,
  observations,
  regions,
  macroRegions,
  selectedProvinceCode,
  onSelectProvince,
  comparedProvinces,
  onToggleCompare,
  onTraceObservation,
  mapComplianceNoteZh,
}: RegionalMatrixProps) {
  const { lang, t } = useLang();
  const [showCompliance, setShowCompliance] = useState(false);

  const regionsByCode = useMemo(() => {
    const m: Record<string, RegionRecord> = {};
    regions.forEach((r) => (m[r.geo_code] = r));
    return m;
  }, [regions]);

  const yearObs = useMemo(
    () => observations.filter((o) => o.year === year && o.geo_level === "provincial"),
    [observations, year]
  );

  const obsByGeo = useMemo(() => {
    const m: Record<string, ObservationRecord> = {};
    yearObs.forEach((o) => (m[o.geo_code] = o));
    return m;
  }, [yearObs]);

  const ranked = useMemo(
    () => computeCompetitionRanking(yearObs, regionsByCode, true),
    [yearObs, regionsByCode]
  );

  const rankByGeo = useMemo(() => {
    const m: Record<string, number> = {};
    ranked.forEach((r) => (m[r.geo_code] = r.rank));
    return m;
  }, [ranked]);

  const palette = PALETTES[indicator.category_id] || PALETTES.economy;

  const { minVal, maxVal, breaks } = useMemo(() => {
    const vals = yearObs.map((o) => o.value).sort((a, b) => a - b);
    if (vals.length === 0) return { minVal: 0, maxVal: 0, breaks: [] as number[] };
    const min = vals[0];
    const max = vals[vals.length - 1];
    // Quantile-based breaks for well-balanced color differentiation
    const br: number[] = [];
    for (let i = 1; i < palette.length; i++) {
      const idx = Math.min(vals.length - 1, Math.floor((i / palette.length) * vals.length));
      br.push(vals[idx]);
    }
    return { minVal: min, maxVal: max, breaks: br };
  }, [yearObs, palette.length]);

  const getBucketIndex = (val: number): number => {
    if (breaks.length === 0 || maxVal === minVal) return 2;
    for (let i = 0; i < breaks.length; i++) {
      if (val <= breaks[i]) return i;
    }
    return palette.length - 1;
  };

  const mainlandProvincesByRegion = useMemo(() => {
    const grouped: Record<string, RegionRecord[]> = {};
    macroRegions.forEach((mr) => (grouped[mr.region_code] = []));
    regions
      .filter((r) => r.geo_level === "provincial" && r.in_mainland_nbs_scope === "true")
      .forEach((r) => {
        if (!grouped[r.region_code]) grouped[r.region_code] = [];
        grouped[r.region_code].push(r);
      });
    return grouped;
  }, [regions, macroRegions]);

  const selectedObs = selectedProvinceCode ? obsByGeo[selectedProvinceCode] : null;
  const selectedRegion = selectedProvinceCode ? regionsByCode[selectedProvinceCode] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafaf8] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-[#1e3a5f]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#0f766e]" />
          <span className="font-semibold">
            {t("合规空间视图：七大区域省级矩阵热力图", "Compliant Spatial View: 7-Region Provincial Matrix")}
          </span>
          <span className="hidden sm:inline text-[#4b5563]">
            {t("（无未经审图边界矢量，100% 符合《地图管理条例》）", "(No unverified boundary GeoJSON)")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowCompliance((v) => !v)}
          className="inline-flex items-center gap-1 font-medium text-[#1e3a5f] hover:underline"
        >
          <Info className="h-3.5 w-3.5" />
          {showCompliance ? t("收起合规说明", "Hide compliance note") : t("为何暂缓行政边界地图？", "Why non-map alternative?")}
        </button>
      </div>

      {showCompliance && (
        <div className="rounded-lg border border-[#cbd5e1] bg-white p-4 text-xs leading-relaxed text-[#374151]">
          <p className="font-semibold text-[#111827] mb-1">
            {t("地图合规处理说明（Map Compliance Statement）", "Map Compliance Statement")}
          </p>
          <p>{mapComplianceNoteZh}</p>
        </div>
      )}

      {yearObs.length === 0 ? (
        <div
          data-testid="matrix-no-data"
          className="rounded-xl border border-dashed border-[#d1d5db] bg-[#fafaf8] p-10 text-center"
        >
          <div className="text-base font-semibold text-[#374151]">
            {t(`${year} 年暂无省级公开数据`, `No provincial observations published for ${year}`)}
          </div>
          <p className="mt-1.5 text-sm text-[#6b7280] max-w-xl mx-auto">
            {t(
              "本平台严格遵循「不插值、不补零、不编造」原则。若当年仅发布全国统计公报初步数，或历史调查口径尚未实施（如2013年前全体居民可支配收入），省级矩阵将如实显示为空缺。",
              "China Data Atlas never fabricates, zero-fills, or interpolates missing official statistics. Please switch to an available provincial year."
            )}
          </p>
        </div>
      ) : (
        <>
          {/* Quantized Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4b5563]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[#111827]">
                {t("数值分档（分位数着色）", "Quantile Scale")} ({indicator.unit}):
              </span>
              <span className="tabular-nums">{formatValue(minVal, indicator.precision)}</span>
              <div className="flex items-center gap-0.5">
                {palette.map((hex, i) => (
                  <span
                    key={hex}
                    title={`Tier ${i + 1}`}
                    style={{ backgroundColor: hex }}
                    className="h-3.5 w-7 first:rounded-l last:rounded-r border border-black/10"
                  />
                ))}
              </div>
              <span className="tabular-nums">{formatValue(maxVal, indicator.precision)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-5 rounded border border-gray-300 hatch-missing" />
                {t("暂无数据", "No data")}
              </span>
              <span className="tabular-nums font-medium text-[#1e3a5f]">
                {t(`已覆盖 ${yearObs.length}/31 省`, `${yearObs.length}/31 provinces`)}
              </span>
            </div>
          </div>

          {/* 7-Region Matrix Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {macroRegions.map((mr) => {
              const provs = mainlandProvincesByRegion[mr.region_code] || [];
              const agg = (indicator.regional_aggregates[String(year)] || []).find(
                (a) => a.region_code === mr.region_code
              );
              return (
                <div
                  key={mr.region_code}
                  className="rounded-xl border border-[#e5e7eb] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                >
                  <div className="mb-2.5 flex items-baseline justify-between border-b border-[#f3f4f6] pb-2">
                    <div>
                      <span className="text-sm font-bold text-[#111827]">
                        {lang === "zh" ? mr.region_name_zh : mr.region_name_en}
                      </span>
                      <span className="ml-1.5 text-[11px] text-[#6b7280]">
                        ({provs.length}{t("省", "")})
                      </span>
                    </div>
                    {agg && agg.value !== null && (
                      <div className="text-right tabular-nums">
                        <span className="text-[11px] text-[#6b7280]">
                          {indicator.aggregation_method === "sum"
                            ? t("区域合计 ", "Sum ")
                            : t("人口加权 ", "Weighted ")}
                        </span>
                        <span className="text-xs font-semibold text-[#1e3a5f]">
                          {formatValue(agg.value, indicator.precision)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
                    {provs.map((prov) => {
                      const obs = obsByGeo[prov.geo_code];
                      const isSelected = selectedProvinceCode === prov.geo_code;
                      if (!obs) {
                        return (
                          <button
                            key={prov.geo_code}
                            type="button"
                            onClick={() => onSelectProvince(prov.geo_code)}
                            className={`rounded-lg border p-2.5 text-left hatch-missing transition-all ${
                              isSelected ? "ring-2 ring-[#1e3a5f] border-[#1e3a5f]" : "border-[#d1d5db]"
                            }`}
                          >
                            <div className="text-xs font-semibold text-[#374151]">
                              {lang === "zh" ? prov.geo_name_short_zh : prov.geo_name_en}
                            </div>
                            <div className="mt-1 text-[11px] text-[#6b7280]">
                              {t("暂无数据", "No data")}
                            </div>
                          </button>
                        );
                      }

                      const bucket = getBucketIndex(obs.value);
                      const bg = palette[bucket];
                      const darkText = bucket < 3;
                      const rank = rankByGeo[prov.geo_code];

                      return (
                        <button
                          key={prov.geo_code}
                          type="button"
                          data-testid={`matrix-cell-${prov.geo_code}`}
                          onClick={() => onSelectProvince(prov.geo_code)}
                          style={{ backgroundColor: bg }}
                          title={`${prov.geo_name_zh} (${year}): ${formatValue(obs.value, indicator.precision)} ${indicator.unit} · 第${rank}名`}
                          className={`group rounded-lg border p-2.5 text-left transition-all hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] ${
                            isSelected
                              ? "ring-2 ring-[#b91c1c] border-[#b91c1c]"
                              : "border-black/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-bold truncate ${
                                darkText ? "text-[#111827]" : "text-white"
                              }`}
                            >
                              {lang === "zh" ? prov.geo_name_short_zh : prov.geo_name_en}
                            </span>
                            <span
                              className={`rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                                darkText
                                  ? "bg-black/10 text-[#111827]"
                                  : "bg-white/20 text-white"
                              }`}
                            >
                              #{rank}
                            </span>
                          </div>
                          <div
                            className={`mt-1.5 text-sm font-bold tabular-nums tracking-tight ${
                              darkText ? "text-[#111827]" : "text-white"
                            }`}
                          >
                            {formatValue(obs.value, indicator.precision)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Selected Province Detail Drawer / Bar */}
      {selectedRegion && (
        <div
          data-testid="selected-province-panel"
          className="rounded-xl border border-[#1e3a5f]/30 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#111827]">
                  {lang === "zh" ? selectedRegion.geo_name_zh : selectedRegion.geo_name_en}
                </span>
                <span className="rounded bg-[#f3f4f6] px-2 py-0.5 text-xs text-[#4b5563]">
                  {lang === "zh" ? selectedRegion.region_name_zh : selectedRegion.region_name_en} · {selectedRegion.geo_code}
                </span>
              </div>
              {selectedObs ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-3 text-sm">
                  <span className="font-bold text-lg text-[#1e3a5f] tabular-nums">
                    {formatValue(selectedObs.value, indicator.precision)} {indicator.unit}
                  </span>
                  <span className="text-xs text-[#4b5563]">
                    {year}{t("年", "")} · {t("全国第", "Rank #")}{rankByGeo[selectedRegion.geo_code]}{t("位", "")}
                  </span>
                  <span className="text-xs text-[#6b7280]">
                    {t("出处：", "Source: ")}{selectedObs.source_table}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-sm text-[#6b7280]">
                  {year}{t("年该省暂无此指标公开数值。", " has no published value for this province.")}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleCompare(selectedRegion.geo_code)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  comparedProvinces.includes(selectedRegion.geo_code)
                    ? "bg-[#0f766e] text-white"
                    : "border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                }`}
              >
                {comparedProvinces.includes(selectedRegion.geo_code) ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("已在趋势对比中", "In Trend Comparison")}
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-3.5 w-3.5" />
                    {t("加入历史趋势对比", "Add to Trend Chart")}
                  </>
                )}
              </button>
              {selectedObs && (
                <button
                  type="button"
                  onClick={() => onTraceObservation(selectedObs)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("追溯原始官方表格", "Trace Official Source")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HK / Macao / Taiwan Statistical Scope Notice */}
      <p className="text-[11px] leading-relaxed text-[#6b7280]">
        {t(
          "统计覆盖说明：上述七大区域矩阵覆盖国家统计局统一核算的中国大陆31个省、自治区、直辖市。香港特别行政区、澳门特别行政区和台湾省实行独立统计核算体系，不包含在本序列省级比较中；此处仅表示统计数据覆盖范围，不涉及任何地理归属判断。",
          "Statistical Scope Note: This 7-region matrix covers China's 31 mainland provincial-level divisions under the unified NBS statistical system. Hong Kong SAR, Macao SAR, and Taiwan maintain separate statistical systems and are not included in this mainland comparative series."
        )}
      </p>
    </div>
  );
}
