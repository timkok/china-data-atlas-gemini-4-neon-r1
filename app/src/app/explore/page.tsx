import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreClient } from "@/components/ExploreClient";
import { getAtlasExploreBundle } from "@/lib/atlas";

export const metadata: Metadata = {
  title: "跨指标省级探索器",
  description:
    "自由组合中国大陆31省人口、经济、教育与医疗官方指标，生成七大区域着色散点图，探索省级发展结构与统计关联。",
};

export default function ExplorePage() {
  const bundle = getAtlasExploreBundle();
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-[#6b7280]">
          正在加载跨指标探索器...
        </div>
      }
    >
      <ExploreClient bundle={bundle} />
    </Suspense>
  );
}
