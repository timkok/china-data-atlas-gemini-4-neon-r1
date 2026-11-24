export type Lang = "zh" | "en";

export interface RegionRecord {
  geo_code: string;
  geo_name_zh: string;
  geo_name_short_zh: string;
  geo_name_en: string;
  geo_level: "national" | "provincial" | "special_coverage_note";
  region_code: string;
  region_name_zh: string;
  region_name_en: string;
  in_mainland_nbs_scope: string;
  coverage_note: string;
}

export interface MacroRegion {
  region_code: string;
  region_name_zh: string;
  region_name_en: string;
}

export interface SourceRecord {
  source_id: string;
  source_agency: string;
  source_title: string;
  source_url: string;
  access_method: string;
  authenticity_verified: string;
  lawful_access_confirmed: string;
  redistribution_status: string;
  terms_summary: string;
  recommended_citation: string;
}

export interface ObservationRecord {
  indicator_id: string;
  geo_code: string;
  geo_level: "national" | "provincial";
  year: number;
  value: number;
  source_id: string;
  source_agency: string;
  source_url: string;
  source_table: string;
  source_locator: string;
  publication_date: string;
  retrieved_at: string;
  data_status: "final" | "preliminary" | "revised" | "unknown";
  methodology_version: string;
  transformation: string;
  verification_status: "verified" | "partially_verified" | "unverified";
  notes: string;
}

export interface RegionalAggregateEntry {
  region_code: string;
  value: number | null;
  method: string;
  complete: boolean;
  provinces_present: number;
  provinces_total: number;
}

export interface RankSummaryItem {
  geo_code: string;
  geo_name_zh: string;
  value: number;
  rank: number;
}

export interface IndicatorSummary {
  indicator_id: string;
  is_core: boolean;
  category_id: "demographics" | "economy" | "education" | "health";
  category_zh: string;
  category_en: string;
  indicator_name_zh: string;
  indicator_name_en: string;
  unit: string;
  unit_en: string;
  precision: number;
  aggregation_method: "sum" | "population_weighted_mean" | "ratio_gdp_over_pop";
  weight_indicator_id: string;
  additive_to_national: boolean;
  polarity: string;
  definition_zh: string;
  definition_en: string;
  caveats_zh: string;
  latest_national: ObservationRecord | null;
  latest_national_yoy: {
    from_year: number;
    to_year: number;
    abs_change: number;
    pct_change: number;
    is_rate_unit: boolean;
    comparable: boolean;
    note: string;
  } | null;
  latest_provincial_year: number | null;
  latest_provincial_coverage: number;
  provincial_years: number[];
  national_years: number[];
  all_years: number[];
  top3_latest: RankSummaryItem[];
  bottom3_latest: RankSummaryItem[];
  key_finding_zh: string;
  regional_aggregates: Record<string, RegionalAggregateEntry[]>;
  observation_count: number;
  verified_count: number;
  source_ids: string[];
}

export interface FeaturedInsight {
  indicator_id: string;
  category_id: string;
  title_zh: string;
  year: number | null;
  national_year: number | null;
  national_value: number | null;
  unit: string;
  precision: number;
  top_province: RankSummaryItem;
  summary_zh: string;
}

export interface AtlasBundle {
  generated_at: string;
  platform: {
    name_zh: string;
    name_en: string;
    tagline: string;
    map_compliance_status: string;
    map_compliance_note_zh: string;
    earliest_year: number | null;
    latest_year: number | null;
    total_valid_observations: number;
    total_verified_observations: number;
    core_indicators_count: number;
    total_sources: number;
  };
  regions: RegionRecord[];
  macro_regions: MacroRegion[];
  sources: SourceRecord[];
  indicators: IndicatorSummary[];
  observations: Record<string, ObservationRecord[]>;
  featured_insights: FeaturedInsight[];
}
