import type { IndicatorSummary, ObservationRecord, RegionRecord } from "./types";

export function formatValue(
  value: number | null | undefined,
  precision = 2
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "暂无数据";
  }
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export interface RankedItem {
  geo_code: string;
  geo_name_zh: string;
  geo_name_short_zh: string;
  geo_name_en: string;
  region_code: string;
  region_name_zh: string;
  value: number;
  rank: number;
  prevRank: number | null;
  rankDelta: number | null; // positive = moved up in rank (e.g. 5 -> 3 => +2)
  observation: ObservationRecord;
}

/**
 * Standard competition ranking (1, 2, 2, 4).
 * Missing values are excluded prior to calling this function.
 */
export function computeCompetitionRanking(
  observations: ObservationRecord[],
  regionsByCode: Record<string, RegionRecord>,
  descending = true,
  prevYearObs?: ObservationRecord[]
): RankedItem[] {
  const valid = observations.filter(
    (o) => o.geo_level === "provincial" && o.value !== null && !Number.isNaN(o.value)
  );
  const sorted = [...valid].sort((a, b) =>
    descending
      ? b.value - a.value || a.geo_code.localeCompare(b.geo_code)
      : a.value - b.value || a.geo_code.localeCompare(b.geo_code)
  );

  // Build previous year competition rank map (always in same sort direction)
  const prevRankMap: Record<string, number> = {};
  if (prevYearObs && prevYearObs.length > 0) {
    const prevSorted = [...prevYearObs]
      .filter((o) => o.geo_level === "provincial" && o.value !== null && !Number.isNaN(o.value))
      .sort((a, b) =>
        descending
          ? b.value - a.value || a.geo_code.localeCompare(b.geo_code)
          : a.value - b.value || a.geo_code.localeCompare(b.geo_code)
      );
    let pVal: number | null = null;
    let pRank = 0;
    prevSorted.forEach((o, i) => {
      if (pVal !== null && Math.abs(o.value - pVal) < 1e-9) {
        prevRankMap[o.geo_code] = pRank;
      } else {
        pRank = i + 1;
        pVal = o.value;
        prevRankMap[o.geo_code] = pRank;
      }
    });
  }

  let prevVal: number | null = null;
  let currentRank = 0;
  return sorted.map((o, i) => {
    if (prevVal !== null && Math.abs(o.value - prevVal) < 1e-9) {
      // tie keeps same rank
    } else {
      currentRank = i + 1;
      prevVal = o.value;
    }
    const reg = regionsByCode[o.geo_code];
    const prevRank = prevRankMap[o.geo_code] ?? null;
    const rankDelta = prevRank !== null ? prevRank - currentRank : null;
    return {
      geo_code: o.geo_code,
      geo_name_zh: reg?.geo_name_zh ?? o.geo_code,
      geo_name_short_zh: reg?.geo_name_short_zh ?? o.geo_code,
      geo_name_en: reg?.geo_name_en ?? o.geo_code,
      region_code: reg?.region_code ?? "",
      region_name_zh: reg?.region_name_zh ?? "",
      value: o.value,
      rank: currentRank,
      prevRank,
      rankDelta,
      observation: o,
    };
  });
}

export function computeCagr(
  startVal: number | null | undefined,
  endVal: number | null | undefined,
  years: number
): number | null {
  if (
    startVal === null ||
    startVal === undefined ||
    endVal === null ||
    endVal === undefined ||
    startVal <= 0 ||
    endVal <= 0 ||
    years <= 0
  ) {
    return null;
  }
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}

export function computePearsonR(pairs: Array<[number, number]>): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildSynchronizedCsv(
  indicator: IndicatorSummary,
  rows: ObservationRecord[],
  regionsByCode: Record<string, RegionRecord>
): string {
  const headers = [
    "indicator_id",
    "indicator_name_zh",
    "indicator_name_en",
    "geo_code",
    "geo_name_zh",
    "geo_name_en",
    "geo_level",
    "year",
    "value",
    "unit",
    "source_id",
    "source_agency",
    "source_url",
    "source_table",
    "source_locator",
    "publication_date",
    "retrieved_at",
    "data_status",
    "methodology_version",
    "transformation",
    "verification_status",
    "notes",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const reg = regionsByCode[r.geo_code];
    const line = [
      indicator.indicator_id,
      indicator.indicator_name_zh,
      indicator.indicator_name_en,
      r.geo_code,
      reg?.geo_name_zh ?? r.geo_code,
      reg?.geo_name_en ?? r.geo_code,
      r.geo_level,
      r.year,
      r.value,
      indicator.unit,
      r.source_id,
      r.source_agency,
      r.source_url,
      r.source_table,
      r.source_locator,
      r.publication_date,
      r.retrieved_at,
      r.data_status,
      r.methodology_version,
      r.transformation,
      r.verification_status,
      r.notes,
    ].map(escapeCsvCell);
    lines.push(line.join(","));
  }
  // Prepend UTF-8 BOM for clean Excel Chinese display while keeping standard UTF-8
  return "\uFEFF" + lines.join("\n") + "\n";
}

export const INDICATOR_ALIASES: Record<string, string[]> = {
  population: ["人口", "常住人口", "总人口", "population", "pop", "resident"],
  birth_rate: ["出生率", "生育", "新生儿", "birth", "fertility"],
  urbanization_rate: ["城镇化", "城市化", "城镇人口", "urban", "urbanization"],
  population_65plus: ["老龄化", "65岁", "老年人口", "银发", "aging", "ageing", "elderly", "65+"],
  gdp: ["gdp", "地区生产总值", "国内生产总值", "经济总量", "产值", "grp", "economy"],
  gdp_per_capita: ["人均gdp", "人均生产总值", "gdp per capita", "grp per capita", "人均产值"],
  disposable_income: ["可支配收入", "人均可支配收入", "居民收入", "收入", "income", "disposable"],
  retail_sales: ["社零", "社会消费品零售总额", "消费", "零售", "retail", "consumption"],
  higher_education_students: ["大学生", "在校生", "高等教育", "高校学生", "本专科", "students", "enrollment", "university"],
  higher_education_institutions: ["高校数量", "大学数量", "高等学校", "高校", "universities", "colleges", "institutions"],
  physicians_per_1000: ["医师", "医生", "执业医师", "医疗", "doctors", "physicians", "healthcare"],
  hospital_beds_per_1000: ["床位", "病床", "医疗床位", "医院床位", "beds", "hospital", "healthcare"],
};

export function aggregationLabelZh(method: string): string {
  switch (method) {
    case "sum":
      return "区域总量加总（各省之和）";
    case "population_weighted_mean":
      return "常住人口加权平均（按同年各省年末常住人口加权）";
    case "ratio_gdp_over_pop":
      return "区域现价GDP总量 ÷ 区域年末常住人口总量（估算）";
    default:
      return method;
  }
}

export function dataStatusLabelZh(status: string): string {
  switch (status) {
    case "final":
      return "终核 / 年鉴";
    case "preliminary":
      return "初步核算 / 公报";
    case "revised":
      return "修订数";
    default:
      return "未标注";
  }
}
