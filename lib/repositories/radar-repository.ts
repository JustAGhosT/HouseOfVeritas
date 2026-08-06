/**
 * Radar listing data-access seam.
 *
 * Previously `lib/services/radar-public.ts` held its own Baserow client, making
 * it a second, independent coupling to the datastore that would silently diverge
 * from `lib/repositories/estate-repository`. All backend access now lives here.
 *
 * The service layer keeps policy (the RADAR_ENABLED gate, summary shaping); this
 * module only knows how to read published rows out of the store.
 */

import { logger } from "@/lib/logger"
import type { PublicRadarListing } from "@/lib/domain/radar-types"

const DEFAULT_BASEROW_API_URL = "https://api.baserow.io/api"
const RADAR_PAGE_SIZE = 200

interface BaserowRowsResponse {
  results?: unknown[]
}

/** Thrown when the backend is reachable-but-unhappy, so callers can degrade. */
export class RadarRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RadarRepositoryError"
  }
}

function getBaserowApiUrl(): string {
  const raw =
    process.env.BASEROW_API_URL || process.env.NEXT_PUBLIC_BASEROW_URL || DEFAULT_BASEROW_API_URL
  const trimmed = raw.replace(/\/$/, "")
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`
}

function getRadarTableId(): string | null {
  const tableId =
    process.env.BASEROW_TABLE_DEAL_RADAR_LISTINGS || process.env.TABLE_DEAL_RADAR_LISTINGS || ""
  return tableId.trim() || null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function nullableStringField(row: Record<string, unknown>, field: string): string | null {
  const value = stringField(row, field)
  return value || null
}

function numberField(row: Record<string, unknown>, field: string): number | null {
  const value = row[field]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function integerField(row: Record<string, unknown>, field: string): number | null {
  const value = numberField(row, field)
  return value === null ? null : Math.round(value)
}

function booleanField(row: Record<string, unknown>, field: string): boolean {
  const value = row[field]
  if (typeof value === "boolean") return value
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.toLowerCase())
  return false
}

function normaliseConfidence(value: string): PublicRadarListing["confidence"] {
  if (value === "verified" || value === "feed" || value === "estimate") return value
  return "estimate"
}

function normaliseStatus(value: string): PublicRadarListing["status"] {
  if (value === "under-offer" || value === "in-transaction" || value === "delisted") return value
  return "active"
}

function mapRadarRow(row: Record<string, unknown>): PublicRadarListing | null {
  const publishStatus = stringField(row, "Publish Status").toLowerCase()
  if (publishStatus !== "published") return null

  const sourceUrl = stringField(row, "Source URL")
  const sourcePortal = stringField(row, "Source Portal")
  const listingId =
    stringField(row, "Listing ID") || stringField(row, "Source Key") || String(row.id || "")
  const suburb = stringField(row, "Suburb")
  const priceCents = integerField(row, "Price Cents")

  if (!sourceUrl || !sourcePortal || !listingId || !suburb || priceCents === null || priceCents <= 0) {
    return null
  }

  const buyInCents = integerField(row, "Buy In Cents") ?? priceCents
  const renoCostEstimateCents = integerField(row, "Reno Cost Estimate Cents")

  return {
    id: listingId,
    sourcePortal,
    sourceUrl,
    suburb,
    priceCents,
    bedrooms: integerField(row, "Bedrooms"),
    bathrooms: integerField(row, "Bathrooms"),
    erfSizeM2: integerField(row, "Erf Size M2"),
    floorSizeM2: integerField(row, "Floor Size M2"),
    propertyType: stringField(row, "Property Type") || "unknown",
    confidence: normaliseConfidence(stringField(row, "Confidence")),
    status: normaliseStatus(stringField(row, "Status")),
    distressFlag: stringField(row, "Distress Flag") || "none",
    effort: stringField(row, "Effort") || "unknown",
    buyInCents,
    allInCents: integerField(row, "All In Cents") ?? buyInCents + (renoCostEstimateCents ?? 0),
    flipPct: numberField(row, "Flip Pct"),
    dealScore: numberField(row, "Deal Score"),
    rentalYieldGross: numberField(row, "Rental Yield Gross"),
    arvEstimateCents: integerField(row, "ARV Estimate Cents"),
    renoCostEstimateCents,
    areaQualityIndex: numberField(row, "Area Quality Index"),
    proximityIndex: numberField(row, "Proximity Index"),
    daysOnMarket: integerField(row, "Days On Market"),
    subdividePotential: booleanField(row, "Subdivide Potential"),
    transferFriction: stringField(row, "Transfer Friction") || "unknown",
    physicalRiskDolomite: booleanField(row, "Physical Risk Dolomite"),
    physicalRiskFlood: booleanField(row, "Physical Risk Flood"),
    analystNote: nullableStringField(row, "Analyst Note"),
    lastSeen: nullableStringField(row, "Last Seen"),
  }
}

export type RadarBackend = "baserow"

export interface RadarListingRepository {
  readonly backend: RadarBackend
  /** Whether the backing store has both credentials and a table configured. */
  isConfigured(): boolean
  /**
   * Published listings only — rows not marked published are filtered out at the
   * mapping layer, so an unpublished row can never reach the public page.
   *
   * @throws {RadarRepositoryError} when the store responds unsuccessfully.
   */
  listPublished(): Promise<PublicRadarListing[]>
}

const baserowRadarRepository: RadarListingRepository = {
  backend: "baserow",

  isConfigured() {
    return Boolean(process.env.BASEROW_API_TOKEN && getRadarTableId())
  },

  async listPublished() {
    const tableId = getRadarTableId()
    if (!tableId) return []

    const url = new URL(`${getBaserowApiUrl()}/database/rows/table/${tableId}/`)
    url.searchParams.set("user_field_names", "true")
    url.searchParams.set("size", String(RADAR_PAGE_SIZE))

    const response = await fetch(url, {
      headers: { Authorization: `Token ${process.env.BASEROW_API_TOKEN}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      logger.warn("Radar public Baserow fetch failed", { status: response.status })
      throw new RadarRepositoryError(`Radar store responded ${response.status}`)
    }

    const body = (await response.json()) as BaserowRowsResponse
    const rows = Array.isArray(body.results) ? body.results : []

    return rows
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => row !== null)
      .map(mapRadarRow)
      .filter((item): item is PublicRadarListing => item !== null)
  },
}

/**
 * Resolve the radar listing repository.
 *
 * Single point of backend selection, mirroring `getEstateRepository()`.
 */
export function getRadarListingRepository(): RadarListingRepository {
  return baserowRadarRepository
}

export const radarRepositoryTestInternals = {
  mapRadarRow,
}
