"use client";

import React from "react";
import Link from "next/link";
import { useLang } from "./LanguageContext";

export function Footer({ generatedAt }: { generatedAt: string }) {
  const { t } = useLang();
  return (
    <footer className="mt-16 border-t border-[#e5e7eb] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="text-base font-bold text-[#1e3a5f]">
              {t("中国数据地图 · China Data Atlas", "China Data Atlas · 中国数据地图")}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#4b5563]">
              {t(
                "Make China's Data Accessible, Understandable, Traceable and Explorable. 所有核心统计数值均来源于国家统计局等官方公开统计资料，每条记录保留原始表格与来源链接。",
                "Make China's Data Accessible, Understandable, Traceable and Explorable. All benchmark indicators are sourced from official National Bureau of Statistics of China publications with row-level provenance."
              )}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              {t("开放数据与文档", "Open Data & Docs")}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[#374151]">
              <li>
                <Link href="/explore" className="hover:text-[#1e3a5f] hover:underline">
                  {t("跨指标省级探索器", "Cross-Indicator Explorer")}
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="hover:text-[#1e3a5f] hover:underline">
                  {t("数据方法、许可与地图合规说明", "Methodology, Licensing & Map Compliance")}
                </Link>
              </li>
              <li>
                <a
                  href="/data/observations.csv"
                  download
                  className="hover:text-[#1e3a5f] hover:underline"
                >
                  {t("下载全量标准化 CSV (observations.csv)", "Download Full Normalized CSV")}
                </a>
              </li>
              <li>
                <a
                  href="/data/data-dictionary.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1e3a5f] hover:underline"
                >
                  {t("查看数据字典 (JSON)", "View Data Dictionary (JSON)")}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              {t("官方出处与统计范围声明", "Official Provenance & Scope")}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#4b5563]">
              {t(
                "主要数据引自国家统计局网站（www.stats.gov.cn）及国家数据（data.stats.gov.cn）。全国及分省年度序列覆盖中国大陆31个省、自治区、直辖市，不含香港特别行政区、澳门特别行政区和台湾省统计数据（系统计覆盖范围差异，不构成地理归属判断）。",
                "Primary statistics are cited from the National Bureau of Statistics of China (www.stats.gov.cn / data.stats.gov.cn). Provincial annual series cover China's 31 mainland provinces, autonomous regions, and municipalities (excluding Hong Kong SAR, Macao SAR, and Taiwan statistical systems)."
              )}
            </p>
            <p className="mt-2 text-[11px] text-[#6b7280]">
              {t("数据管道构建时间 (UTC)：", "Pipeline build (UTC): ")}
              <span className="font-mono">{generatedAt}</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
