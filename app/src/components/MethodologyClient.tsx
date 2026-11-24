"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, FileText, Download, ExternalLink, AlertTriangle } from "lucide-react";
import { useLang } from "./LanguageContext";
import { aggregationLabelZh } from "@/lib/format";
import type { AtlasBundle } from "@/lib/types";

export function MethodologyClient({ bundle }: { bundle: AtlasBundle }) {
  const { lang, t } = useLang();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111827]">
          {t("数据方法论、许可边界与地图合规说明", "Methodology, Data Licensing & Map Compliance")}
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-[#4b5563]">
          {t(
            "中国数据地图（China Data Atlas）坚持「真实官方数据、逐条可追溯、统计口径透明、绝不编造补零」四大原则。以下公开本平台的数据流水线、官方来源、法律许可边界与地图合规决策。",
            "China Data Atlas adheres to strict provenance, methodological transparency, and zero fabrication. Below is our full documentation of data sources, statistical rules, licensing, and map compliance."
          )}
        </p>
      </section>

      {/* Pipeline & Open Data */}
      <section className="rounded-xl border border-[#e5e7eb] bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#1e3a5f]">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-bold">{t("1. 标准化数据管道与开放下载", "1. Reproducible Pipeline & Open Data")}</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#374151]">
          {t(
            "全站所有图表与 KPI 均由统一数据管道（Official NBS Sources → Raw Evidence → Extraction → DuckDB Quality Gate → Normalized CSV/Parquet → Precomputed Static JSON）自动构建。任何缺失年份均保持空值，绝不以 0 填补或通过插值伪装为官方观测值。",
            "All charts and summaries are generated deterministically from our DuckDB-validated observations.csv. Missing values remain strictly blank—never zero-filled or interpolated."
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/data/observations.csv"
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2b5282]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("下载全量 observations.csv", "Download observations.csv")}
          </a>
          <a
            href="/data/data-dictionary.json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-4 py-2 text-xs font-semibold text-[#374151] hover:border-[#1e3a5f]"
          >
            {t("查看数据字典 JSON", "View Data Dictionary JSON")}
          </a>
        </div>
      </section>

      {/* Map Compliance */}
      <section className="rounded-xl border border-[#0f766e]/30 bg-white p-6 space-y-3">
        <div className="flex items-center gap-2 text-[#0f766e]">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="text-lg font-bold text-[#111827]">
            {t("2. 地图合规与空间可视化决策", "2. Map Compliance Statement")}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-[#374151]">
          {bundle.platform.map_compliance_note_zh}
        </p>
        <p className="text-xs leading-relaxed text-[#6b7280]">
          {t(
            "覆盖范围说明：本平台核心序列覆盖国家统计局统一核算的中国大陆31个省级行政区（华北5省市、东北3省、华东7省市、华中3省、华南3省区、西南5省市区、西北5省区）。香港特别行政区、澳门特别行政区和台湾省实行独立统计体系，不在大陆31省年度统一核算表内；本说明仅反映统计数据覆盖边界，不构成地理归属判断。",
            "Geographic Scope: Mainland NBS annual series cover 31 mainland provincial-level divisions across 7 official regions. Hong Kong SAR, Macao SAR, and Taiwan operate independent statistical systems and are documented separately."
          )}
        </p>
      </section>

      {/* Aggregation Rules Table */}
      <section className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="border-b border-[#e5e7eb] bg-[#fafaf8] px-6 py-3.5">
          <h2 className="text-base font-bold text-[#111827]">
            {t("3. 12 个核心指标统计口径与区域聚合规则", "3. Core Indicator Definitions & Regional Aggregation Rules")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#e5e7eb] text-xs">
            <thead className="bg-[#fafaf8] text-[#4b5563] font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">{t("指标", "Indicator")}</th>
                <th className="px-4 py-3 text-left">{t("基准单位", "Unit")}</th>
                <th className="px-4 py-3 text-left">{t("七大区域聚合方法", "Regional Aggregation")}</th>
                <th className="px-4 py-3 text-left">{t("口径与修订要点", "Caveats")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {bundle.indicators.map((ind) => (
                <tr key={ind.indicator_id} className="align-top">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    <Link href={`/indicators/${ind.indicator_id}`} className="text-[#1e3a5f] hover:underline">
                      {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[#4b5563]">{ind.unit}</td>
                  <td className="px-4 py-3 text-[#111827]">{aggregationLabelZh(ind.aggregation_method)}</td>
                  <td className="px-4 py-3 text-[#4b5563] leading-relaxed">{ind.caveats_zh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Official Sources & Redistribution Licensing */}
      <section className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="border-b border-[#e5e7eb] bg-[#fafaf8] px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#111827]">
            {t("4. 官方来源、真实性核验与再发布许可边界", "4. Official Sources & Redistribution Status")}
          </h2>
        </div>
        <div className="p-5 bg-amber-50/50 border-b border-[#e5e7eb] text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
          <p className="leading-relaxed">
            {t(
              "合规提示：公开可访问不自动等同于无限制商业再发布许可。根据国家统计局《服务条款》（www.stats.gov.cn/wzgl/202302/t20230217_1912857.html），用户可依法使用并以公益资料性目的善意引用统计数据（须显著注明出处与网址），但不得曲解原意、不得复制官网特有编排，亦不得擅自授权第三方二次转载。本平台将原始再发布状态诚实标注为「attribution_required_noncommercial_review」。",
              "Legal Notice: Public availability does not imply unrestricted commercial redistribution. Per NBS Terms of Service, good-faith informational citation with prominent attribution is permitted while sublicensing is restricted."
            )}
          </p>
        </div>
        <div className="divide-y divide-[#f3f4f6]">
          {bundle.sources.map((src) => (
            <div key={src.source_id} className="p-5 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm text-[#111827]">
                  {src.source_title} <span className="font-normal text-[#6b7280]">({src.source_agency})</span>
                </div>
                <a
                  href={src.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#1e3a5f] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {src.source_url}
                </a>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-[#4b5563]">
                <span>{t("真实性已核实：", "Authenticity verified: ")}<strong>{src.authenticity_verified}</strong></span>
                <span>{t("合法公开访问：", "Lawful access: ")}<strong>{src.lawful_access_confirmed}</strong></span>
                <span>{t("再发布许可状态：", "Redistribution: ")}<strong>{src.redistribution_status}</strong></span>
              </div>
              <p className="text-[#4b5563] leading-relaxed">{src.terms_summary}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
