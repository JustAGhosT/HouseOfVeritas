/**
 * PostgreSQL implementation of the radar listing repository.
 *
 * Mirrors `radar-repository.ts` (Baserow) behaviourally: only rows whose
 * publish status is 'published' ever leave this module, so an unpublished or
 * quarantined row cannot reach the public page even if the caller forgets to
 * filter. The gate is enforced in SQL, not by the caller.
 */

import { ensureRadarSchema } from "@/lib/db/radar-schema"
import { isPostgresConfigured, query } from "@/lib/db/postgres"
import type { PublicRadarListing } from "@/lib/domain/radar-types"
import type { RadarListingRepository } from "@/lib/repositories/radar-repository"

const RADAR_PAGE_SIZE = 200

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "string" ? Number(value) : value
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
}

function int(value: unknown): number | null {
  const parsed = num(value)
  return parsed === null ? null : Math.round(parsed)
}

function str(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function nullableStr(value: unknown): string | null {
  const parsed = str(value)
  return parsed || null
}

function normaliseConfidence(value: string): PublicRadarListing["confidence"] {
  if (value === "verified" || value === "feed" || value === "estimate") return value
  return "estimate"
}

function normaliseStatus(value: string): PublicRadarListing["status"] {
  if (value === "under-offer" || value === "in-transaction" || value === "delisted") return value
  return "active"
}

function toIsoDate(value: unknown): string | null {
  // See lib/db/postgres: DATE is parsed as a string, so this Date branch is a
  // fallback. Local components, not toISOString(), to avoid a UTC day shift.
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  if (typeof value === "string" && value) return value.slice(0, 10)
  return null
}

function mapRow(row: Record<string, unknown>): PublicRadarListing | null {
  const sourceUrl = str(row.source_url)
  const sourcePortal = str(row.source_portal)
  const listingId = str(row.listing_id) || str(row.source_key) || String(row.id ?? "")
  const suburb = str(row.suburb)
  const priceCents = int(row.price_cents)

  // Same completeness guard as the Baserow mapper: a row missing any of these
  // is not publishable, regardless of what publish_status claims.
  if (!sourceUrl || !sourcePortal || !listingId || !suburb || priceCents === null || priceCents <= 0) {
    return null
  }

  const buyInCents = int(row.buy_in_cents) ?? priceCents
  const renoCostEstimateCents = int(row.reno_cost_estimate_cents)

  return {
    id: listingId,
    sourcePortal,
    sourceUrl,
    suburb,
    priceCents,
    bedrooms: int(row.bedrooms),
    bathrooms: int(row.bathrooms),
    erfSizeM2: int(row.erf_size_m2),
    floorSizeM2: int(row.floor_size_m2),
    propertyType: str(row.property_type) || "unknown",
    confidence: normaliseConfidence(str(row.confidence)),
    status: normaliseStatus(str(row.status)),
    distressFlag: str(row.distress_flag) || "none",
    effort: str(row.effort) || "unknown",
    buyInCents,
    allInCents: int(row.all_in_cents) ?? buyInCents + (renoCostEstimateCents ?? 0),
    flipPct: num(row.flip_pct),
    dealScore: num(row.deal_score),
    rentalYieldGross: num(row.rental_yield_gross),
    arvEstimateCents: int(row.arv_estimate_cents),
    renoCostEstimateCents,
    areaQualityIndex: num(row.area_quality_index),
    proximityIndex: num(row.proximity_index),
    daysOnMarket: int(row.days_on_market),
    subdividePotential: Boolean(row.subdivide_potential),
    transferFriction: str(row.transfer_friction) || "unknown",
    physicalRiskDolomite: Boolean(row.physical_risk_dolomite),
    physicalRiskFlood: Boolean(row.physical_risk_flood),
    analystNote: nullableStr(row.analyst_note),
    lastSeen: toIsoDate(row.last_seen),
  }
}

export const postgresRadarRepository: RadarListingRepository = {
  backend: "postgres",

  isConfigured() {
    return isPostgresConfigured()
  },

  async listPublished() {
    if (!isPostgresConfigured()) return []
    await ensureRadarSchema()

    const { rows } = await query<Record<string, unknown>>(
      `SELECT * FROM deal_radar_listings
       WHERE publish_status = 'published'
       ORDER BY deal_score DESC NULLS LAST, id ASC
       LIMIT $1`,
      [RADAR_PAGE_SIZE]
    )

    return rows.map(mapRow).filter((row): row is PublicRadarListing => row !== null)
  },
}

export const radarRepositoryPostgresTestInternals = { mapRow }
