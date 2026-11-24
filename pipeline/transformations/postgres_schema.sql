-- PostgreSQL Migration Schema for China Data Atlas
-- Mirrors data/processed/china_data_atlas.duckdb for future relational deployment.

CREATE TABLE IF NOT EXISTS regions (
    geo_code CHAR(6) PRIMARY KEY,
    geo_name_zh VARCHAR(64) NOT NULL,
    geo_name_short_zh VARCHAR(32) NOT NULL,
    geo_name_en VARCHAR(64) NOT NULL,
    geo_level VARCHAR(32) NOT NULL CHECK (geo_level IN ('national', 'provincial', 'special_coverage_note')),
    region_code VARCHAR(16) NOT NULL,
    region_name_zh VARCHAR(32) NOT NULL,
    region_name_en VARCHAR(32) NOT NULL,
    in_mainland_nbs_scope BOOLEAN NOT NULL,
    coverage_note TEXT
);

CREATE TABLE IF NOT EXISTS indicators (
    indicator_id VARCHAR(64) PRIMARY KEY,
    is_core BOOLEAN NOT NULL DEFAULT TRUE,
    category_id VARCHAR(32) NOT NULL,
    category_zh VARCHAR(32) NOT NULL,
    category_en VARCHAR(32) NOT NULL,
    indicator_name_zh VARCHAR(128) NOT NULL,
    indicator_name_en VARCHAR(128) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    unit_en VARCHAR(32) NOT NULL,
    precision SMALLINT NOT NULL DEFAULT 2,
    aggregation_method VARCHAR(32) NOT NULL,
    weight_indicator_id VARCHAR(64),
    additive_to_national BOOLEAN NOT NULL DEFAULT FALSE,
    polarity VARCHAR(24) NOT NULL DEFAULT 'neutral',
    definition_zh TEXT NOT NULL,
    definition_en TEXT NOT NULL,
    caveats_zh TEXT
);

CREATE TABLE IF NOT EXISTS sources (
    source_id VARCHAR(64) PRIMARY KEY,
    source_agency VARCHAR(128) NOT NULL,
    source_title VARCHAR(256) NOT NULL,
    source_url TEXT NOT NULL,
    access_method VARCHAR(64) NOT NULL,
    authenticity_verified BOOLEAN NOT NULL,
    lawful_access_confirmed BOOLEAN NOT NULL,
    redistribution_status VARCHAR(64) NOT NULL,
    terms_summary TEXT NOT NULL,
    recommended_citation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
    indicator_id VARCHAR(64) NOT NULL REFERENCES indicators(indicator_id),
    geo_code CHAR(6) NOT NULL REFERENCES regions(geo_code),
    year SMALLINT NOT NULL CHECK (year BETWEEN 1949 AND 2100),
    methodology_version VARCHAR(64) NOT NULL,
    value DOUBLE PRECISION,
    unit VARCHAR(32) NOT NULL,
    source_id VARCHAR(64) NOT NULL REFERENCES sources(source_id),
    source_table TEXT NOT NULL,
    source_locator TEXT NOT NULL,
    publication_date DATE NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL,
    data_status VARCHAR(24) NOT NULL CHECK (data_status IN ('final', 'preliminary', 'revised', 'unknown')),
    transformation TEXT NOT NULL,
    verification_status VARCHAR(24) NOT NULL CHECK (verification_status IN ('verified', 'partially_verified', 'unverified')),
    notes TEXT,
    is_current_release BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (indicator_id, geo_code, year, methodology_version)
);

CREATE INDEX IF NOT EXISTS idx_obs_indicator_year ON observations (indicator_id, year);
CREATE INDEX IF NOT EXISTS idx_obs_geo_year ON observations (geo_code, year);
