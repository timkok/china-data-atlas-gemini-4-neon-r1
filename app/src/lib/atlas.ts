import fs from "node:fs";
import path from "node:path";
import summaryBundle from "@/data/atlas-summary.json";
import exploreBundle from "@/data/atlas-explore.json";
import type { AtlasBundle, IndicatorSummary, ObservationRecord } from "./types";

export function getAtlasSummary(): AtlasBundle {
  return summaryBundle as unknown as AtlasBundle;
}

export function getAtlasExploreBundle(): AtlasBundle {
  return exploreBundle as unknown as AtlasBundle;
}

export function getIndicatorById(id: string): IndicatorSummary | undefined {
  return getAtlasSummary().indicators.find((i) => i.indicator_id === id);
}

export function getIndicatorObservationsServer(id: string): ObservationRecord[] {
  const filePath = path.join(process.cwd(), "src", "data", "indicators", `${id}.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ObservationRecord[];
}
