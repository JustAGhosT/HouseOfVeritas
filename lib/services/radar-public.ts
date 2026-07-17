import { logger } from "@/lib/logger"

const DEFAULT_BASEROW_API_URL = "https://api.baserow.io/api"
const RADAR_PAGE_SIZE = 200

export type RadarMode = "disabled" | "empty" | "live" | "error"

export interface PublicRadarListing {
  id: string
  sourcePortal: string
  sourceUrl: string
  suburb: string
  priceCents: number
  bedrooms: number | null
  bathrooms: number | null
  erfSizeM2: number | null
  floorSizeM2: number | null
  propertyType: string
  confidence: "verified" | "feed" | "estimate"
  status: "active" | "under-offer" | "in-transaction" | "delisted"
  distressFlag: string
  effort: string
  buyInCents: number
  allInCents: number
  flipPct: number | null
  dealScore: number | null
  rentalYieldGross: number | null
  arvEstimateCents: number | null
  renoCostEstimateCents: number | null
  areaQualityIndex: number | null
  proximityIndex: number | null
  daysOnMarket: number | null
  subdividePotential: boolean
  transferFriction: string
  physicalRiskDolomite: boolean
  physicalRiskFlood: boolean
  analystNote: string | null
  lastSeen: string | null
}

export interface RadarApiSummary {
  mode: RadarMode
  enabled: boolean
  configured: boolean
  count: number
  generatedAt: string
  lastSeen: string | null
  sources: string[]
  error?: string
}

export interface RadarListingsResult {
  data: PublicRadarListing[]
  summary: RadarApiSummary
}

interface BaserowRowsResponse {
  results?: unknown[]
}

function radarEnabled(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.RADAR_ENABLED || "").toLowerCase())
}

function getBaserowApiUrl(): string {
  const raw = process.env.BASEROW_API_URL || process.env.NEXT_PUBLIC_BASEROW_URL || DEFAULT_BASEROW_API_URL
  const trimmed = raw.replace(/\/$/, "")
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`
}

function getRadarTableId(): string | null {
  const tableId =
    process.env.BASEROW_TABLE_DEAL_RADAR_LISTINGS || process.env.TABLE_DEAL_RADAR_LISTINGS || ""
  return tableId.trim() || null
}

function isConfigured(): boolean {
  return Boolean(process.env.BASEROW_API_TOKEN && getRadarTableId())
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
  const listingId = stringField(row, "Listing ID") || stringField(row, "Source Key") || String(row.id || "")
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

function buildSummary(
  mode: RadarMode,
  enabled: boolean,
  configured: boolean,
  data: PublicRadarListing[],
  error?: string
): RadarApiSummary {
  const lastSeen = data
    .map((item) => item.lastSeen)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  return {
    mode,
    enabled,
    configured,
    count: data.length,
    generatedAt: new Date().toISOString(),
    lastSeen: lastSeen ?? null,
    sources: [...new Set(data.map((item) => item.sourcePortal))].sort(),
    ...(error ? { error } : {}),
  }
}

export async function getPublicRadarListings(): Promise<RadarListingsResult> {
  const enabled = radarEnabled()
  const configured = isConfigured()

  if (!enabled) {
    return { data: [], summary: buildSummary("disabled", enabled, configured, []) }
  }

  if (!configured) {
    return { data: [], summary: buildSummary("empty", enabled, configured, []) }
  }

  const tableId = getRadarTableId()
  if (!tableId) {
    return { data: [], summary: buildSummary("empty", enabled, configured, []) }
  }

  const url = new URL(`${getBaserowApiUrl()}/database/rows/table/${tableId}/`)
  url.searchParams.set("user_field_names", "true")
  url.searchParams.set("size", String(RADAR_PAGE_SIZE))

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${process.env.BASEROW_API_TOKEN}`,
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      logger.warn("Radar public Baserow fetch failed", { status: response.status })
      return {
        data: [],
        summary: buildSummary("error", enabled, configured, [], "Unable to load radar listings"),
      }
    }

    const body = (await response.json()) as BaserowRowsResponse
    const rows = Array.isArray(body.results) ? body.results : []
    const data = rows
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => row !== null)
      .map(mapRadarRow)
      .filter((item): item is PublicRadarListing => item !== null)

    return {
      data,
      summary: buildSummary(data.length > 0 ? "live" : "empty", enabled, configured, data),
    }
  } catch (error) {
    logger.error("Radar public Baserow fetch threw", {
      error: error instanceof Error ? error.message : "unknown",
    })
    return {
      data: [],
      summary: buildSummary("error", enabled, configured, [], "Unable to load radar listings"),
    }
  }
}

export const radarPublicTestInternals = {
  mapRadarRow,
}
