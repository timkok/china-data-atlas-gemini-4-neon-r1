import React from "react";
import type { Metadata } from "next";
import { MethodologyClient } from "@/components/MethodologyClient";
import { getAtlasSummary } from "@/lib/atlas";

export const metadata: Metadata = {
  title: "数据方法论、许可与地图合规说明",
  description:
    "中国数据地图（China Data Atlas）数据工程管道、国家统计局官方来源清单、服务条款与再发布许可说明，以及《地图管理条例》合规可视化说明。",
};

export default function MethodologyPage() {
  const summary = getAtlasSummary();
  return <MethodologyClient bundle={summary} />;
}
