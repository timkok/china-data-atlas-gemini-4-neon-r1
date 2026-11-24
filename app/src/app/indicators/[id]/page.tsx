import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IndicatorDetailClient } from "@/components/IndicatorDetailClient";
import {
  getAtlasSummary,
  getIndicatorById,
  getIndicatorObservationsServer,
} from "@/lib/atlas";
import { formatValue } from "@/lib/format";

export async function generateStaticParams() {
  const summary = getAtlasSummary();
  return summary.indicators.map((ind) => ({ id: ind.indicator_id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ind = getIndicatorById(id);
  if (!ind) return { title: "未找到指标" };
  const latestStr = ind.latest_national
    ? `最新全国数据(${ind.latest_national.year}年)：${formatValue(ind.latest_national.value, ind.precision)} ${ind.unit}；`
    : "";
  const description = `${ind.indicator_name_zh}（${ind.indicator_name_en}）官方统计数据。${latestStr}覆盖中国大陆31省${ind.all_years[0]}—${ind.all_years[ind.all_years.length - 1]}年历史序列，支持省级排名、七大区域加权对比与CSV下载。`;
  return {
    title: `${ind.indicator_name_zh} (${ind.unit})`,
    description,
    alternates: {
      canonical: `/indicators/${ind.indicator_id}`,
    },
    openGraph: {
      title: `${ind.indicator_name_zh} | 中国数据地图 China Data Atlas`,
      description,
      type: "article",
    },
  };
}

export default async function IndicatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const summary = getAtlasSummary();
  const ind = getIndicatorById(id);
  if (!ind) notFound();

  const observations = getIndicatorObservationsServer(id);
  const relatedIndicators = summary.indicators
    .filter((i) => i.indicator_id !== id && i.category_id === ind.category_id)
    .slice(0, 3);

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-[#6b7280]">
          正在加载 {ind.indicator_name_zh} 官方统计数据...
        </div>
      }
    >
      <IndicatorDetailClient
        indicator={ind}
        observations={observations}
        regions={summary.regions}
        macroRegions={summary.macro_regions}
        sources={summary.sources}
        relatedIndicators={relatedIndicators}
        mapComplianceNoteZh={summary.platform.map_compliance_note_zh}
      />
    </Suspense>
  );
}
