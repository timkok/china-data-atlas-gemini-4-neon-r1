"use client";

import React from "react";
import { X, ExternalLink, CheckCircle2, FileText } from "lucide-react";
import { useLang } from "./LanguageContext";
import { formatValue, dataStatusLabelZh } from "@/lib/format";
import type { IndicatorSummary, ObservationRecord, RegionRecord } from "@/lib/types";

interface ProvenanceModalProps {
  observation: ObservationRecord | null;
  indicator: IndicatorSummary;
  region?: RegionRecord;
  onClose: () => void;
}

export function ProvenanceModal({
  observation,
  indicator,
  region,
  onClose,
}: ProvenanceModalProps) {
  const { lang, t } = useLang();
  if (!observation) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="provenance-modal"
        aria-label={t("数据溯源详情", "Observation Provenance Details")}
        className="w-full max-w-xl rounded-xl border border-[#e5e7eb] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#fafaf8] px-5 py-3.5">
          <div className="flex items-center gap-2 text-[#1e3a5f]">
            <FileText className="h-4 w-4" />
            <h3 className="text-sm font-bold">
              {t("单条统计数值官方溯源", "Official Provenance Trace")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("关闭", "Close")}
            className="rounded p-1 text-[#6b7280] hover:bg-gray-200/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="rounded-lg border border-[#e5e7eb] bg-[#fafaf8] p-3.5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xs text-[#6b7280]">
                {lang === "zh" ? indicator.indicator_name_zh : indicator.indicator_name_en}
              </div>
              <div className="text-base font-bold text-[#111827]">
                {region ? (lang === "zh" ? region.geo_name_zh : region.geo_name_en) : observation.geo_code} · {observation.year}{t("年", "")}
              </div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-xl font-bold text-[#1e3a5f]">
                {formatValue(observation.value, indicator.precision)}{" "}
                <span className="text-xs font-medium text-[#4b5563]">{indicator.unit}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0f766e]">
                <CheckCircle2 className="h-3 w-3" />
                {observation.verification_status}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[#6b7280]">{t("官方发布机构", "Source Agency")}</dt>
              <dd className="mt-0.5 font-semibold text-[#111827]">{observation.source_agency}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">{t("数据状态", "Data Status")}</dt>
              <dd className="mt-0.5 font-semibold text-[#111827]">
                {dataStatusLabelZh(observation.data_status)} ({observation.data_status})
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#6b7280]">{t("原始统计表格 / 公报", "Official Table / Bulletin")}</dt>
              <dd className="mt-0.5 font-medium text-[#111827]">{observation.source_table}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#6b7280]">{t("表内定位信息", "Source Locator")}</dt>
              <dd className="mt-0.5 font-mono text-[11px] bg-[#f3f4f6] rounded px-2 py-1 text-[#1f2937] break-all">
                {observation.source_locator}
              </dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">{t("官方发布日期", "Publication Date")}</dt>
              <dd className="mt-0.5 font-mono text-[#111827]">{observation.publication_date}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">{t("数据获取时间 (UTC)", "Retrieved At (UTC)")}</dt>
              <dd className="mt-0.5 font-mono text-[#111827]">{observation.retrieved_at}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">{t("统计口径版本", "Methodology Version")}</dt>
              <dd className="mt-0.5 font-mono text-[#111827]">{observation.methodology_version}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">{t("单位换算 / 处理规则", "Transformation")}</dt>
              <dd className="mt-0.5 text-[#111827]">{observation.transformation}</dd>
            </div>
            {observation.notes && (
              <div className="sm:col-span-2">
                <dt className="text-[#6b7280]">{t("口径注释", "Notes")}</dt>
                <dd className="mt-0.5 text-[#374151] leading-relaxed">{observation.notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex items-center justify-between border-t border-[#e5e7eb] pt-3">
            <a
              href={observation.source_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="provenance-source-link"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] hover:underline break-all"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {t("打开官方原始页面", "Open Official Source URL")}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#1e3a5f] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2b5282]"
            >
              {t("关闭", "Close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
