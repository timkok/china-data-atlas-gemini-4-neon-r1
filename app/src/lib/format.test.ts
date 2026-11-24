import { describe, it, expect } from "vitest";
import {
  computeCompetitionRanking,
  computeCagr,
  computePearsonR,
  buildSynchronizedCsv,
  formatValue,
} from "./format";
import type { IndicatorSummary, ObservationRecord, RegionRecord } from "./types";

const mockRegions: Record<string, RegionRecord> = {
  "110000": {
    geo_code: "110000",
    geo_name_zh: "北京市",
    geo_name_short_zh: "北京",
    geo_name_en: "Beijing",
    geo_level: "provincial",
    region_code: "NORTH",
    region_name_zh: "华北",
    region_name_en: "North China",
    in_mainland_nbs_scope: "true",
    coverage_note: "",
  },
  "310000": {
    geo_code: "310000",
    geo_name_zh: "上海市",
    geo_name_short_zh: "上海",
    geo_name_en: "Shanghai",
    geo_level: "provincial",
    region_code: "EAST",
    region_name_zh: "华东",
    region_name_en: "East China",
    in_mainland_nbs_scope: "true",
    coverage_note: "",
  },
  "440000": {
    geo_code: "440000",
    geo_name_zh: "广东省",
    geo_name_short_zh: "广东",
    geo_name_en: "Guangdong",
    geo_level: "provincial",
    region_code: "SOUTH",
    region_name_zh: "华南",
    region_name_en: "South China",
    in_mainland_nbs_scope: "true",
    coverage_note: "",
  },
  "320000": {
    geo_code: "320000",
    geo_name_zh: "江苏省",
    geo_name_short_zh: "江苏",
    geo_name_en: "Jiangsu",
    geo_level: "provincial",
    region_code: "EAST",
    region_name_zh: "华东",
    region_name_en: "East China",
    in_mainland_nbs_scope: "true",
    coverage_note: "",
  },
};

function makeObs(geo_code: string, year: number, value: number): ObservationRecord {
  return {
    indicator_id: "test_ind",
    geo_code,
    geo_level: "provincial",
    year,
    value,
    source_id: "NBS_TEST",
    source_agency: "国家统计局",
    source_url: "https://data.stats.gov.cn/",
    source_table: "测试表",
    source_locator: "row 1",
    publication_date: "2025-10-01",
    retrieved_at: "2026-11-24T00:00:00Z",
    data_status: "final",
    methodology_version: "v1",
    transformation: "none",
    verification_status: "verified",
    notes: "",
  };
}

describe("format & statistical helpers", () => {
  it("handles ties with standard competition ranking (1, 2, 2, 4)", () => {
    const obs = [
      makeObs("440000", 2024, 100),
      makeObs("110000", 2024, 80),
      makeObs("310000", 2024, 80),
      makeObs("320000", 2024, 50),
    ];
    const ranked = computeCompetitionRanking(obs, mockRegions, true);
    expect(ranked.map((r) => [r.geo_code, r.rank])).toEqual([
      ["440000", 1],
      ["110000", 2],
      ["310000", 2],
      ["320000", 4],
    ]);
  });

  it("handles negative values cleanly in ascending and descending ranking", () => {
    const obs = [
      makeObs("110000", 2024, -2.5),
      makeObs("310000", 2024, -5.0),
      makeObs("440000", 2024, 1.2),
    ];
    const desc = computeCompetitionRanking(obs, mockRegions, true);
    expect(desc.map((r) => r.geo_code)).toEqual(["440000", "110000", "310000"]);
    const asc = computeCompetitionRanking(obs, mockRegions, false);
    expect(asc.map((r) => r.geo_code)).toEqual(["310000", "110000", "440000"]);
  });

  it("computes CAGR accurately and returns null for invalid inputs", () => {
    expect(computeCagr(100, 121, 2)).toBeCloseTo(10, 5);
    expect(computeCagr(0, 100, 2)).toBeNull();
    expect(computeCagr(100, 120, 0)).toBeNull();
  });

  it("computes Pearson correlation accurately", () => {
    expect(computePearsonR([[1, 2], [2, 4], [3, 6], [4, 8]])).toBeCloseTo(1.0, 6);
    expect(computePearsonR([[1, 8], [2, 6], [3, 4], [4, 2]])).toBeCloseTo(-1.0, 6);
    expect(computePearsonR([[1, 2], [2, 4]])).toBeNull();
  });

  it("formats missing values as 暂无数据 instead of 0", () => {
    expect(formatValue(null, 2)).toBe("暂无数据");
    expect(formatValue(undefined, 2)).toBe("暂无数据");
    expect(formatValue(0, 2)).toBe("0.00");
  });

  it("builds synchronized CSV matching filtered observations", () => {
    const ind = {
      indicator_id: "gdp",
      indicator_name_zh: "地区生产总值（现价）",
      indicator_name_en: "GRP",
      unit: "亿元人民币",
    } as IndicatorSummary;
    const csv = buildSynchronizedCsv(ind, [makeObs("440000", 2024, 141633.81)], mockRegions);
    expect(csv).toContain("indicator_id,indicator_name_zh");
    expect(csv).toContain("440000,广东省,Guangdong,provincial,2024,141633.81,亿元人民币");
  });
});
