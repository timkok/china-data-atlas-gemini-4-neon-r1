"use client";

import React, { useMemo, useState } from "react";
import { Download, Search, ArrowUpDown, FileCode, ExternalLink } from "lucide-react";
import { useLang } from "./LanguageContext";
import { buildSynchronizedCsv, formatValue, dataStatusLabelZh } from "@/lib/format";
import type { IndicatorSummary, MacroRegion, ObservationRecord, RegionRecord } from "@/lib/types";

interface DataExplorerTableProps {
  indicator: IndicatorSummary;
  observations: ObservationRecord[];
  regions: RegionRecord[];
  macroRegions: MacroRegion[];
  onTraceObservation: (obs: ObservationRecord) => void;
}

type SortField = "year" | "geo_code" | "value";

export function DataExplorerTable({
  indicator,
  observations,
  regions,
  macroRegions,
  onTraceObservation,
}: DataExplorerTableProps) {
  const { lang, t } = useLang();
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("year");
  const [sortAsc, setSortAsc] = useState(false);
  const [showDict, setShowDict] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 40;

  const regionsByCode = useMemo(() => {
    const m: Record<string, RegionRecord> = {};
    regions.forEach((r) => (m[r.geo_code] = r));
    return m;
  }, [regions]);

  // Offer full 2000-2025 year choices so users can explicitly inspect missing years (Task I)
  const selectableYears = useMemo(() => {
    const ys: number[] = [];
    for (let y = 2025; y >= 2000; y--) ys.push(y);
    return ys;
  }, []);

  const mainlandProvinces = useMemo(
    () =>
      regions.filter(
        (r) =>
          (r.geo_level === "national" || r.geo_level === "provincial") &&
          r.in_mainland_nbs_scope === "true"
      ),
    [regions]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = observations.filter((o) => {
      if (yearFilter !== "all" && String(o.year) !== yearFilter) return false;
      const reg = regionsByCode[o.geo_code];
      if (regionFilter !== "all") {
        if (regionFilter === "CN" && o.geo_level !== "national") return false;
        if (regionFilter !== "CN" && reg?.region_code !== regionFilter) return false;
      }
      if (provinceFilter !== "all" && o.geo_code !== provinceFilter) return false;
      if (q) {
        const hay = `${o.geo_code} ${reg?.geo_name_zh ?? ""} ${reg?.geo_name_en ?? ""} ${o.year} ${o.source_table}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "year") cmp = a.year - b.year || a.geo_code.localeCompare(b.geo_code);
      else if (sortField === "geo_code") cmp = a.geo_code.localeCompare(b.geo_code) || b.year - a.year;
      else cmp = a.value - b.value;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [observations, yearFilter, regionFilter, provinceFilter, searchTerm, sortField, sortAsc, regionsByCode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(field === "geo_code");
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = buildSynchronizedCsv(indicator, filtered, regionsByCode);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const suffix = [
      yearFilter !== "all" ? yearFilter : "all-years",
      regionFilter !== "all" ? regionFilter.toLowerCase() : null,
      provinceFilter !== "all" ? provinceFilter : null,
    ]
      .filter(Boolean)
      .join("_");
    a.href = url;
    a.download = `china-data-atlas_${indicator.indicator_id}_${suffix}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            data-testid="explorer-search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder={t("搜索省份、代码、年份或表格...", "Filter by province, year, table...")}
            className="w-full rounded-lg border border-[#d1d5db] bg-white py-2 pl-9 pr-3 text-sm text-[#111827] focus:border-[#1e3a5f] focus:outline-none"
          />
        </div>

        <select
          aria-label={t("按年份筛选", "Filter by year")}
          data-testid="explorer-year-select"
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="all">{t("全部年份", "All Years")}</option>
          {selectableYears.map((y) => {
            const hasData = indicator.all_years.includes(y);
            return (
              <option key={y} value={String(y)}>
                {y}{t("年", "")}{hasData ? "" : t(" (无数据)", " (no data)")}
              </option>
            );
          })}
        </select>

        <select
          aria-label={t("按七大区域筛选", "Filter by macro region")}
          data-testid="explorer-region-select"
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setProvinceFilter("all");
            setPage(1);
          }}
          className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="all">{t("全部地区（全国+31省）", "All Regions")}</option>
          <option value="CN">{t("仅全国统计值", "National Only")}</option>
          {macroRegions.map((mr) => (
            <option key={mr.region_code} value={mr.region_code}>
              {lang === "zh" ? mr.region_name_zh : mr.region_name_en}
            </option>
          ))}
        </select>

        <select
          aria-label={t("按省份筛选", "Filter by province")}
          data-testid="explorer-province-select"
          value={provinceFilter}
          onChange={(e) => {
            setProvinceFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="all">{t("全部省级行政区", "All Provinces")}</option>
          {mainlandProvinces.map((p) => (
            <option key={p.geo_code} value={p.geo_code}>
              {lang === "zh" ? p.geo_name_zh : p.geo_name_en}
            </option>
          ))}
        </select>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#fafaf8] border border-[#e5e7eb] px-4 py-2.5 text-xs">
        <div className="text-[#4b5563]">
          {t("当前筛选结果：", "Filtered observations: ")}
          <strong data-testid="explorer-row-count" className="text-[#111827] tabular-nums">
            {filtered.length.toLocaleString()}
          </strong>{" "}
          {t("条真实有效观测记录（缺失值不补零、不虚构）", "valid rows (missing values omitted, never zero-filled)")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDict((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 font-semibold text-[#374151] hover:border-[#1e3a5f]"
          >
            <FileCode className="h-3.5 w-3.5" />
            {showDict ? t("隐藏数据字典", "Hide Schema") : t("数据字典", "Data Dictionary")}
          </button>
          <button
            type="button"
            data-testid="explorer-download-csv"
            onClick={handleDownloadCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 py-1.5 font-semibold text-white hover:bg-[#2b5282] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            {t(`下载筛选后 CSV (${filtered.length}条)`, `Download Filtered CSV (${filtered.length})`)}
          </button>
        </div>
      </div>

      {showDict && (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-xs">
          <div className="font-semibold text-[#111827] mb-2">
            {t("标准化 CSV 字段说明（共 22 列，UTF-8 编码）", "Normalized CSV Schema (22 columns, UTF-8)")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[#4b5563]">
            <div><code className="font-mono text-[#1e3a5f]">indicator_id</code>: 统一指标标识</div>
            <div><code className="font-mono text-[#1e3a5f]">geo_code</code>: GB/T 2260 行政代码（全国 000000）</div>
            <div><code className="font-mono text-[#1e3a5f]">year</code>: 实际统计年份</div>
            <div><code className="font-mono text-[#1e3a5f]">value</code>: 数值（缺失为空，不填0）</div>
            <div><code className="font-mono text-[#1e3a5f]">unit</code>: 标准基准单位 ({indicator.unit})</div>
            <div><code className="font-mono text-[#1e3a5f]">source_url / source_locator</code>: 官方表链接与行列定位</div>
            <div><code className="font-mono text-[#1e3a5f]">data_status</code>: final / preliminary / revised</div>
            <div><code className="font-mono text-[#1e3a5f]">methodology_version</code>: 统计口径与普查版本</div>
            <div><code className="font-mono text-[#1e3a5f]">verification_status</code>: 核验状态</div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          data-testid="explorer-no-data"
          className="rounded-xl border border-dashed border-[#d1d5db] bg-[#fafaf8] p-10 text-center"
        >
          <div className="text-base font-semibold text-[#374151]">
            {t("当前筛选条件下暂无官方统计数据", "No official observations match current filters")}
          </div>
          <p className="mt-1.5 text-sm text-[#6b7280]">
            {yearFilter !== "all"
              ? t(
                  `${yearFilter} 年暂无符合条件的官方记录。本平台不插值、不补零、不生成虚假数值。`,
                  `No official record exists for ${yearFilter} under current filters. Missing data is never fabricated.`
                )
              : t("请调整搜索关键词、年份或地区筛选条件。", "Please adjust your search or filter selections.")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
          <table className="min-w-full divide-y divide-[#e5e7eb] text-sm">
            <thead className="bg-[#fafaf8] text-xs font-semibold text-[#4b5563]">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => handleSort("year")}
                    className="inline-flex items-center gap-1 hover:text-[#111827]"
                  >
                    {t("统计年份", "Year")}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => handleSort("geo_code")}
                    className="inline-flex items-center gap-1 hover:text-[#111827]"
                  >
                    {t("地区", "Region")}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">{t("七大区域", "Macro Region")}</th>
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("value")}
                    className="inline-flex items-center gap-1 hover:text-[#111827]"
                  >
                    {t("数值", "Value")} ({indicator.unit})
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">{t("数据状态 / 口径", "Status / Meth.")}</th>
                <th className="px-4 py-3 text-left">{t("官方出处", "Source")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6] text-xs sm:text-sm">
              {pageRows.map((row) => {
                const reg = regionsByCode[row.geo_code];
                return (
                  <tr key={`${row.geo_code}-${row.year}`} className="hover:bg-[#fafaf8]">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono font-medium text-[#111827]">
                      {row.year}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-[#111827]">
                      {reg ? (lang === "zh" ? reg.geo_name_zh : reg.geo_name_en) : row.geo_code}
                      <span className="ml-1.5 text-[11px] font-mono text-[#9ca3af]">{row.geo_code}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#4b5563]">
                      {reg ? (lang === "zh" ? reg.region_name_zh : reg.region_name_en) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[#1e3a5f]">
                      {formatValue(row.value, indicator.precision)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          row.data_status === "preliminary"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {dataStatusLabelZh(row.data_status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        data-testid={`trace-btn-${row.geo_code}-${row.year}`}
                        onClick={() => onTraceObservation(row)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#1e3a5f] hover:underline text-left"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="max-w-[220px] truncate">{row.source_table}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[#4b5563]">
          <span>
            {t(`第 ${safePage} / ${totalPages} 页`, `Page ${safePage} of ${totalPages}`)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-[#d1d5db] bg-white px-3 py-1 disabled:opacity-40"
            >
              {t("上一页", "Previous")}
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-[#d1d5db] bg-white px-3 py-1 disabled:opacity-40"
            >
              {t("下一页", "Next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
