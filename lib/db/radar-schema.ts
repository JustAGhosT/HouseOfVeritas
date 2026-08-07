/**
 * Property Deal Radar schema (PostgreSQL).
 *
 * Serves both sides of the radar: the Next.js read path
 * (`lib/repositories/radar-repository-postgres.ts`) and the Python ingestion
 * function (`config/azure-functions/shared/radar_postgres.py`), which upserts
 * by `source_key`. Column names are the contract between them — change them in
 * both places or not at all.
 *
 * Money is integer cents (ZAR), never floating-point Rand, per spec §5.
 */

import { isPostgresConfigured, withClient } from "@/lib/db/postgres"
import { logger } from "@/lib/logger"

const RADAR_TABLES = [
  `CREATE TABLE IF NOT EXISTS deal_radar_listings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_key TEXT NOT NULL UNIQUE,
    listing_id TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL,
    source_portal TEXT NOT NULL,
    suburb TEXT NOT NULL DEFAULT '',
    price_cents BIGINT NOT NULL DEFAULT 0,
    bedrooms INTEGER,
    bathrooms INTEGER,
    erf_size_m2 INTEGER,
    floor_size_m2 INTEGER,
    property_type TEXT NOT NULL DEFAULT 'unknown',
    confidence TEXT NOT NULL DEFAULT 'estimate',
    status TEXT NOT NULL DEFAULT 'active',
    distress_flag TEXT NOT NULL DEFAULT 'none',
    effort TEXT NOT NULL DEFAULT 'unknown',
    buy_in_cents BIGINT,
    all_in_cents BIGINT,
    flip_pct NUMERIC,
    deal_score NUMERIC,
    rental_yield_gross NUMERIC,
    arv_estimate_cents BIGINT,
    reno_cost_estimate_cents BIGINT,
    area_quality_index NUMERIC,
    proximity_index NUMERIC,
    days_on_market INTEGER,
    subdivide_potential BOOLEAN NOT NULL DEFAULT false,
    transfer_friction TEXT NOT NULL DEFAULT 'unknown',
    physical_risk_dolomite BOOLEAN NOT NULL DEFAULT false,
    physical_risk_flood BOOLEAN NOT NULL DEFAULT false,
    analyst_note TEXT,
    canonical_key TEXT,
    last_seen DATE,
    -- Written by the ingestion function; not all are surfaced publicly.
    agency TEXT,
    ai_generated BOOLEAN NOT NULL DEFAULT false,
    classification_reasons TEXT,
    holding_cost_monthly_cents BIGINT,
    monthly_bond_cents BIGINT,
    monthly_rent_cents BIGINT,
    suburb_median_cents BIGINT,
    qa_status TEXT,
    qa_reasons TEXT,
    -- Appended price-change history and the delist timestamp. Both are written
    -- by the ingestion job after build_listing_row; without columns here their
    -- writes were silently dropped with only a log warning.
    change_log TEXT,
    delisted_at DATE,
    -- Publication gate. Rows are only ever served to the public page when this
    -- is 'published'; ingestion writes 'staged' unless RADAR_ENABLED is on.
    publish_status TEXT NOT NULL DEFAULT 'staged'
  );
  CREATE INDEX IF NOT EXISTS idx_radar_publish_status ON deal_radar_listings(publish_status);
  CREATE INDEX IF NOT EXISTS idx_radar_canonical_key ON deal_radar_listings(canonical_key);
  CREATE INDEX IF NOT EXISTS idx_radar_suburb ON deal_radar_listings(suburb);`,

  `CREATE TABLE IF NOT EXISTS deal_radar_quarantine (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_key TEXT NOT NULL UNIQUE,
    source_url TEXT,
    source_portal TEXT,
    suburb TEXT,
    price_cents BIGINT,
    payload JSONB,
    qa_failure_reason TEXT NOT NULL DEFAULT '',
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_radar_quarantine_at ON deal_radar_quarantine(quarantined_at DESC);`,
] as const

let schemaReady: Promise<void> | null = null

async function createRadarSchema(): Promise<void> {
  await withClient(async (client) => {
    for (const ddl of RADAR_TABLES) {
      await client.query(ddl)
    }
  })
}

/**
 * Create the radar tables if absent. Idempotent and memoised per process.
 * No-ops when Postgres is unconfigured — an unconfigured store yields empty
 * reads, which the radar surfaces as `mode: "empty"` rather than an error.
 */
export async function ensureRadarSchema(): Promise<void> {
  if (!isPostgresConfigured()) return

  schemaReady ??= createRadarSchema().catch((error: unknown) => {
    schemaReady = null
    logger.error("Radar schema creation failed", {
      error: error instanceof Error ? error.message : "unknown",
    })
    throw error
  })

  return schemaReady
}

export function resetRadarSchemaForTests(): void {
  schemaReady = null
}
