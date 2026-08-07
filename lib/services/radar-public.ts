/**
 * Property Deal Radar — public read service.
 *
 * Owns policy only: the RADAR_ENABLED kill-switch and the response envelope.
 * All datastore access goes through `lib/repositories/radar-repository`, so this
 * module no longer knows what backend the listings live in.
 */

import { logger } from "@/lib/logger"
import type { PublicRadarListing, RadarMode } from "@/lib/domain/radar-types"
import {
  getRadarListingRepository,
  radarRepositoryTestInternals,
} from "@/lib/repositories/radar-repository"

export type { PublicRadarListing, RadarMode } from "@/lib/domain/radar-types"

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

function radarEnabled(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.RADAR_ENABLED || "").toLowerCase())
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
  const repository = await getRadarListingRepository()
  const enabled = radarEnabled()
  const configured = repository.isConfigured()

  if (!enabled) {
    return { data: [], summary: buildSummary("disabled", enabled, configured, []) }
  }

  if (!configured) {
    return { data: [], summary: buildSummary("empty", enabled, configured, []) }
  }

  try {
    const data = await repository.listPublished()
    return {
      data,
      summary: buildSummary(data.length > 0 ? "live" : "empty", enabled, configured, data),
    }
  } catch (error) {
    logger.error("Radar listing repository read failed", {
      error: error instanceof Error ? error.message : "unknown",
    })
    return {
      data: [],
      summary: buildSummary("error", enabled, configured, [], "Unable to load radar listings"),
    }
  }
}

export const radarPublicTestInternals = {
  mapRadarRow: radarRepositoryTestInternals.mapRadarRow,
}
