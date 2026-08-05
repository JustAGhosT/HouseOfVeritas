/**
 * Named, saved mixes: "our terracotta" rather than a set of numbers retyped
 * from memory each time.
 *
 * The calculator's MIX_DESIGNS and COLOR_INTENSITIES are fixed engineering
 * tables and stay that way. A record layers the estate's own choices on top of
 * them - which design, which cast method, what dosage, which supplier's pigment
 * - so a batch cast in March can be reproduced in September.
 *
 * A record also carries cast samples: photographs of stones actually made from
 * it. Dosage to finished shade depends on the sand, the cement, the water and
 * the curing in ways no published table predicts, so over time these samples
 * become the estate's own colour chart, which is worth more than the supplier's.
 *
 * Pure: types, validation and merging only. Persistence lives in
 * lib/repositories/concrete-mix-repository.ts.
 */

import {
  COLOR_INTENSITIES,
  MAX_PIGMENT_PERCENT,
  MIX_DESIGNS,
  CAST_METHODS,
  type AdmixtureId,
  type CastMethodId,
  type CementType,
  type ColorIntensityId,
  type MixDesignId,
  type ReinforcementId,
} from "@/lib/concrete-mix"

const MAX_NAME_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 500
const MAX_PRODUCT_LENGTH = 160
const MAX_NOTE_LENGTH = 500
const MAX_SHADE_LENGTH = 80
const MAX_PHOTO_URL_LENGTH = 2048
const MAX_SAMPLES = 40
/** A stone stops changing colour long before this; anything more is a typo. */
const MAX_CURE_AGE_DAYS = 365

const ADMIXTURE_IDS: readonly AdmixtureId[] = ["plasticizer", "waterproofer"]
const REINFORCEMENT_IDS: readonly ReinforcementId[] = ["none", "fiber", "mesh"]

export interface ConcreteMixSample {
  id: string
  photoUrl: string
  /** What the stone actually looks like, in the operator's words. */
  observedShade?: string
  /** Days between casting and the photograph. Colour lightens as it dries. */
  cureAgeDays?: number
  note?: string
  capturedBy: string
  capturedAt: string
}

export interface ConcreteMixRecord {
  id: string
  name: string
  description?: string
  mixDesignId: MixDesignId
  castMethodId: CastMethodId
  pigmentDosagePercent: number
  colorIntensityId: ColorIntensityId | null
  cementType: CementType
  reinforcement: ReinforcementId
  admixtures: AdmixtureId[]
  /** The exact product bought, e.g. "Powafix Cement Colour - Terracotta". */
  pigmentProduct?: string
  /** Pins the mix to one inventory item when several pigments are stocked. */
  pigmentInventoryItemId?: string
  samples: ConcreteMixSample[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Everything a record fixes about a batch. Slab size and count stay per-batch. */
export type ConcreteMixRecordSettings = Pick<
  ConcreteMixRecord,
  | "mixDesignId"
  | "castMethodId"
  | "pigmentDosagePercent"
  | "colorIntensityId"
  | "cementType"
  | "reinforcement"
  | "admixtures"
>

export interface ConcreteMixRecordDraft extends ConcreteMixRecordSettings {
  name: string
  description?: string
  pigmentProduct?: string
  pigmentInventoryItemId?: string
}

export type RecordValidation<T> = { ok: true; value: T } | { ok: false; error: string }

function optionalText(
  value: unknown,
  field: string,
  maxLength: number
): RecordValidation<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined }
  if (typeof value !== "string") return { ok: false, error: `${field} must be a string` }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: undefined }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${field} must be ${maxLength} characters or fewer` }
  }
  return { ok: true, value: trimmed }
}

/**
 * Mirrors the upload rules the inventory route applies, so a saved mix cannot
 * become a way to point the app at an arbitrary host.
 */
export function isAllowedSamplePhotoUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  const url = value.trim()
  if (!url || url.length > MAX_PHOTO_URL_LENGTH) return false
  return (
    url.startsWith("/api/uploads/") ||
    url.startsWith("/api/files/serve?") ||
    url.startsWith("https://")
  )
}

function readAdmixtures(value: unknown): RecordValidation<AdmixtureId[]> {
  if (value === undefined || value === null) return { ok: true, value: [] }
  if (!Array.isArray(value)) return { ok: false, error: "admixtures must be an array" }

  const seen = new Set<AdmixtureId>()
  for (const entry of value) {
    if (typeof entry !== "string" || !ADMIXTURE_IDS.includes(entry as AdmixtureId)) {
      return { ok: false, error: `Unknown admixture. Expected one of: ${ADMIXTURE_IDS.join(", ")}` }
    }
    seen.add(entry as AdmixtureId)
  }
  return { ok: true, value: ADMIXTURE_IDS.filter((id) => seen.has(id)) }
}

/**
 * Narrows an untrusted body into a record draft. Deliberately strict about the
 * mix settings: a saved mix that quietly falls back to a default would produce
 * stones that do not match the ones cast from it last time.
 */
export function validateConcreteMixRecordDraft(
  raw: unknown
): RecordValidation<ConcreteMixRecordDraft> {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Request body must be an object" }
  }
  const body = raw as Record<string, unknown>

  const name = optionalText(body.name, "name", MAX_NAME_LENGTH)
  if (!name.ok) return name
  if (!name.value) return { ok: false, error: "name is required" }

  const description = optionalText(body.description, "description", MAX_DESCRIPTION_LENGTH)
  if (!description.ok) return description

  const pigmentProduct = optionalText(body.pigmentProduct, "pigmentProduct", MAX_PRODUCT_LENGTH)
  if (!pigmentProduct.ok) return pigmentProduct

  const pigmentInventoryItemId = optionalText(
    body.pigmentInventoryItemId,
    "pigmentInventoryItemId",
    120
  )
  if (!pigmentInventoryItemId.ok) return pigmentInventoryItemId

  if (typeof body.mixDesignId !== "string" || !(body.mixDesignId in MIX_DESIGNS)) {
    return {
      ok: false,
      error: `mixDesignId must be one of: ${Object.keys(MIX_DESIGNS).join(", ")}`,
    }
  }
  if (typeof body.castMethodId !== "string" || !(body.castMethodId in CAST_METHODS)) {
    return {
      ok: false,
      error: `castMethodId must be one of: ${Object.keys(CAST_METHODS).join(", ")}`,
    }
  }

  // An intensity is a shortcut for a dosage; a record must end up with a number.
  let pigmentDosagePercent: number
  let colorIntensityId: ColorIntensityId | null = null

  if (body.pigmentDosagePercent !== undefined && body.pigmentDosagePercent !== null) {
    const dosage = body.pigmentDosagePercent
    if (typeof dosage !== "number" || !Number.isFinite(dosage) || dosage < 0) {
      return { ok: false, error: "pigmentDosagePercent must be a number of 0 or more" }
    }
    if (dosage > MAX_PIGMENT_PERCENT) {
      return { ok: false, error: `pigmentDosagePercent must not exceed ${MAX_PIGMENT_PERCENT}` }
    }
    pigmentDosagePercent = dosage
  } else if (
    typeof body.colorIntensityId === "string" &&
    body.colorIntensityId in COLOR_INTENSITIES
  ) {
    colorIntensityId = body.colorIntensityId as ColorIntensityId
    pigmentDosagePercent = COLOR_INTENSITIES[colorIntensityId].dosagePercent
  } else {
    return { ok: false, error: "Provide either pigmentDosagePercent or a known colorIntensityId" }
  }

  const cementType = body.cementType ?? "grey"
  if (cementType !== "grey" && cementType !== "white") {
    return { ok: false, error: 'cementType must be "grey" or "white"' }
  }

  const reinforcement = body.reinforcement ?? "none"
  if (
    typeof reinforcement !== "string" ||
    !REINFORCEMENT_IDS.includes(reinforcement as ReinforcementId)
  ) {
    return {
      ok: false,
      error: `reinforcement must be one of: ${REINFORCEMENT_IDS.join(", ")}`,
    }
  }

  const admixtures = readAdmixtures(body.admixtures)
  if (!admixtures.ok) return admixtures

  return {
    ok: true,
    value: {
      name: name.value,
      description: description.value,
      pigmentProduct: pigmentProduct.value,
      pigmentInventoryItemId: pigmentInventoryItemId.value,
      mixDesignId: body.mixDesignId as MixDesignId,
      castMethodId: body.castMethodId as CastMethodId,
      pigmentDosagePercent,
      colorIntensityId,
      cementType,
      reinforcement: reinforcement as ReinforcementId,
      admixtures: admixtures.value,
    },
  }
}

export interface ConcreteMixSampleDraft {
  photoUrl: string
  observedShade?: string
  cureAgeDays?: number
  note?: string
}

export function validateConcreteMixSampleDraft(
  raw: unknown
): RecordValidation<ConcreteMixSampleDraft> {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Request body must be an object" }
  }
  const body = raw as Record<string, unknown>

  if (!isAllowedSamplePhotoUrl(body.photoUrl)) {
    return {
      ok: false,
      error: "photoUrl must be an uploaded file reference or an https URL",
    }
  }

  const observedShade = optionalText(body.observedShade, "observedShade", MAX_SHADE_LENGTH)
  if (!observedShade.ok) return observedShade

  const note = optionalText(body.note, "note", MAX_NOTE_LENGTH)
  if (!note.ok) return note

  let cureAgeDays: number | undefined
  if (body.cureAgeDays !== undefined && body.cureAgeDays !== null) {
    const days = body.cureAgeDays
    if (typeof days !== "number" || !Number.isInteger(days) || days < 0) {
      return { ok: false, error: "cureAgeDays must be a whole number of 0 or more" }
    }
    if (days > MAX_CURE_AGE_DAYS) {
      return { ok: false, error: `cureAgeDays must not exceed ${MAX_CURE_AGE_DAYS}` }
    }
    cureAgeDays = days
  }

  return {
    ok: true,
    value: {
      photoUrl: body.photoUrl.trim(),
      observedShade: observedShade.value,
      note: note.value,
      cureAgeDays,
    },
  }
}

export function canAcceptAnotherSample(record: ConcreteMixRecord): boolean {
  return record.samples.length < MAX_SAMPLES
}

export const MAX_SAMPLES_PER_RECORD = MAX_SAMPLES

/**
 * Layers a saved mix over a batch request. The record owns the mix settings;
 * the caller still says how many stones and what size, and may override any
 * setting explicitly for a one-off variation.
 */
export function applyRecordToBatchBody(
  record: ConcreteMixRecord,
  body: Record<string, unknown>
): Record<string, unknown> {
  const settings: Record<string, unknown> = {
    mixDesignId: record.mixDesignId,
    castMethodId: record.castMethodId,
    pigmentDosagePercent: record.pigmentDosagePercent,
    cementType: record.cementType,
    reinforcement: record.reinforcement,
    admixtures: record.admixtures,
  }

  // An explicit value in the request wins, so a saved mix can still be nudged
  // for one batch without editing the record.
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) settings[key] = value
  }

  // colorIntensityId would otherwise override the record's exact dosage.
  if (body.pigmentDosagePercent === undefined || body.pigmentDosagePercent === null) {
    delete settings.colorIntensityId
  }

  return settings
}
