/**
 * Concrete garden stone / paver mix and pigment calculator.
 *
 * Deterministic and pure: no network, no persistence, no clock. Given a slab
 * size, a batch size (or the area being paved) and a target color it returns
 * the cement, sand, stone, water, pigment, reinforcement and admixtures needed,
 * rounded up to the pack sizes sold at local builders' merchants.
 *
 * Two conventions matter and are easy to get wrong:
 *   1. Pigment is dosed as a percentage of *cement* mass, never of the total
 *      mix. Suppliers spec it that way and the color follows the binder.
 *   2. Past ~10% of cement mass the color stops deepening and the slab starts
 *      losing strength, so dosage is capped rather than extrapolated.
 *
 * Mix designs are the Cement & Concrete SA volumetric tables converted to mass
 * per cubic metre using loose bulk densities. Water is derived from a
 * water/cement ratio rather than fixed per design, because the cast method
 * moves it further than the design does.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const CEMENT_BAG_KG = 50
export const SAND_DENSITY_KG_PER_M3 = 1600
export const STONE_DENSITY_KG_PER_M3 = 1500

/** Oxide pigment pack sizes, descending so greedy packing fills the big bag first. */
export const PIGMENT_PACK_SIZES_KG = [25, 5, 1] as const

/** Past this dosage extra pigment buys no color and costs strength. */
export const PIGMENT_SATURATION_PERCENT = 10

/** Anything above this is a typo, not a color choice. */
export const MAX_PIGMENT_PERCENT = 15

export const DEFAULT_WASTE_PERCENT = 10
export const MAX_WASTE_PERCENT = 50
export const MAX_SLAB_COUNT = 10000

/** Extra stones for cut edges and breakage while laying, when working from an area. */
export const DEFAULT_EDGE_ALLOWANCE_PERCENT = 5
export const MAX_EDGE_ALLOWANCE_PERCENT = 50
export const DEFAULT_JOINT_MM = 10
export const MAX_JOINT_MM = 100
export const MAX_AREA_M2 = 2000

/** Polypropylene micro-fiber: one 900 g bag doses one cubic metre. */
export const FIBER_KG_PER_M3 = 0.9
export const FIBER_BAG_GRAMS = 900
export const FIBER_BAG_KG = FIBER_BAG_GRAMS / 1000

/** Standard welded mesh sheet, 2.4 m x 6.0 m. */
export const MESH_SHEET_M2 = 14.4
/** Mesh sheets overlap where they meet, so buy more than the plan area. */
export const MESH_LAP_FACTOR = 1.1
/** Below this there is no room for cover top and bottom, so mesh does more harm than good. */
export const MESH_MIN_THICKNESS_MM = 50

export const PLASTICIZER_ML_PER_CEMENT_BAG = 200
export const WATERPROOFER_LITRES_PER_CEMENT_BAG = 1

export const MIN_MIXER_CAPACITY_M3 = 0.02
export const MAX_MIXER_CAPACITY_M3 = 2

const MIN_SLAB_SIDE_MM = 50
const MAX_SLAB_SIDE_MM = 2000
const MIN_SLAB_THICKNESS_MM = 15
const MAX_SLAB_THICKNESS_MM = 300

/** Below this a slab cracks under its own handling, whatever the mix. */
const FRAGILE_THICKNESS_MM = 30

/** Aggregate should be no more than a third of the section it sits in. */
const MAX_STONE_TO_THICKNESS_RATIO = 1 / 3

/** Cement mass past which one continuous batch is no longer realistic. */
const COLOR_CONSISTENCY_CEMENT_KG = 500

/** Semi-dry mix deeper than this cannot be compacted through by table vibration. */
const DRY_CAST_MAX_THICKNESS_MM = 75

// ── Types ────────────────────────────────────────────────────────────────────

export type MixDesignId = "garden-stone" | "paver-25" | "paver-30"
export type ColorIntensityId = "light" | "medium" | "dark" | "maximum"
export type SlabPresetId = "stepping-300" | "square-400" | "large-500" | "brick-paver"
export type CementType = "grey" | "white"
export type CastMethodId = "wet" | "dry"
export type ReinforcementId = "none" | "fiber" | "mesh"
export type AdmixtureId = "plasticizer" | "waterproofer"
export type MaterialId =
  | "cement"
  | "sand"
  | "stone"
  | "water"
  | "pigment"
  | "fiber"
  | "mesh"
  | "plasticizer"
  | "waterproofer"

export interface SlabDimensions {
  lengthMm: number
  widthMm: number
  thicknessMm: number
}

export interface SlabPreset {
  id: SlabPresetId
  label: string
  dimensions: SlabDimensions
  defaultMixDesign: MixDesignId
}

export interface MixDesign {
  id: MixDesignId
  label: string
  description: string
  strengthMpa: number
  cementKgPerM3: number
  sandKgPerM3: number
  stoneKgPerM3: number
  /** Nominal aggregate size, or null for a sand-only mortar mix. */
  stoneSizeMm: number | null
  /** Wet-cast water/cement ratio by mass. Dry casting overrides this. */
  waterCementRatio: number
}

export interface CastMethod {
  id: CastMethodId
  label: string
  description: string
  /** Overrides the mix design's ratio when set. */
  waterCementRatio: number | null
  /** How long the stone stays in the mould before it can be stripped. */
  stripHours: number
}

export interface ColorIntensity {
  id: ColorIntensityId
  label: string
  description: string
  dosagePercent: number
}

/** Cents per purchase unit, keyed by material. See `MaterialLine.purchaseUnit`. */
export type ConcreteMixCosts = Partial<Record<MaterialId, number>>

export interface CoverageInput {
  areaM2: number
  jointMm: number
  edgeAllowancePercent: number
}

export interface ConcreteMixInput {
  dimensions: SlabDimensions
  slabCount: number
  mixDesignId: MixDesignId
  castMethodId: CastMethodId
  /** Percent of cement mass. Already clamped to MAX_PIGMENT_PERCENT. */
  pigmentDosagePercent: number
  colorIntensityId: ColorIntensityId | null
  cementType: CementType
  reinforcement: ReinforcementId
  admixtures: AdmixtureId[]
  wastePercent: number
  mixerCapacityM3: number | null
  presetId: SlabPresetId | null
  coverage: CoverageInput | null
  costs: ConcreteMixCosts | null
}

export interface PackBreakdown {
  label: string
  count: number
  sizeKg: number
}

export interface MaterialLine {
  material: MaterialId
  label: string
  /** What the mix actually needs, which may be fractional. */
  requiredQuantity: number
  requiredUnit: string
  /** Whole units to buy. Equal to the requirement for bulk materials sold loose. */
  purchaseQuantity: number
  purchaseUnit: string
  packs?: PackBreakdown[]
  estimatedCostCents?: number
}

export interface MixerLoad {
  cementKg: number
  sandKg: number
  stoneKg: number
  waterLitres: number
  pigmentGrams: number
  volumeM3: number
}

export interface MixerPlan {
  capacityM3: number
  loadCount: number
  fullLoadCount: number
  fullLoad: MixerLoad
  /** The short last load, or null when the batch divides evenly. */
  finalLoad: MixerLoad | null
}

export interface CoverageResult {
  requestedAreaM2: number
  jointMm: number
  edgeAllowancePercent: number
  slabFootprintM2: number
  coveredAreaM2: number
}

export interface ConcreteMixResult {
  slab: {
    presetId: SlabPresetId | null
    dimensions: SlabDimensions
    volumeM3: number
    massKg: number
  }
  batch: {
    slabCount: number
    wastePercent: number
    netVolumeM3: number
    mixedVolumeM3: number
  }
  coverage: CoverageResult | null
  mixDesign: MixDesign
  castMethod: CastMethod
  waterCementRatio: number
  pigment: {
    intensityId: ColorIntensityId | null
    dosagePercent: number
    gramsPerSlab: number
    totalKg: number
    purchaseKg: number
    packs: PackBreakdown[]
  }
  reinforcement: ReinforcementId
  admixtures: AdmixtureId[]
  mixerPlan: MixerPlan | null
  materials: MaterialLine[]
  estimatedCostCents: number | null
  unpricedMaterials: MaterialId[]
  warnings: string[]
  notes: string[]
}

export type ValidationResult = { ok: true; value: ConcreteMixInput } | { ok: false; error: string }

// ── Reference data ───────────────────────────────────────────────────────────

export const MIX_DESIGNS: Record<MixDesignId, MixDesign> = {
  "garden-stone": {
    id: "garden-stone",
    label: "Garden stone mortar (1:3)",
    description:
      "Cement and plaster sand only. Best surface detail for thin decorative stones, and the only sensible choice under 50 mm.",
    strengthMpa: 25,
    cementKgPerM3: 450,
    sandKgPerM3: 1500,
    stoneKgPerM3: 0,
    stoneSizeMm: null,
    waterCementRatio: 0.44,
  },
  "paver-25": {
    id: "paver-25",
    label: "Paver 25 MPa (1:2:2)",
    description:
      "Medium-strength concrete with 13 mm stone. Foot traffic, patios and garden paths at 50 mm and up.",
    strengthMpa: 25,
    cementKgPerM3: 385,
    sandKgPerM3: 880,
    stoneKgPerM3: 825,
    stoneSizeMm: 13,
    waterCementRatio: 0.49,
  },
  "paver-30": {
    id: "paver-30",
    label: "Paver 30 MPa (1:2:2 rich)",
    description:
      "High-strength concrete with 13 mm stone. Driveways and anything carrying a vehicle.",
    strengthMpa: 30,
    cementKgPerM3: 460,
    sandKgPerM3: 800,
    stoneKgPerM3: 750,
    stoneSizeMm: 13,
    waterCementRatio: 0.43,
  },
}

export const CAST_METHODS: Record<CastMethodId, CastMethod> = {
  wet: {
    id: "wet",
    label: "Wet cast",
    description:
      "Pourable mix vibrated or rodded into the mould. Richest color and the smoothest face, but the mould is tied up for a full day.",
    waterCementRatio: null,
    stripHours: 24,
  },
  dry: {
    id: "dry",
    label: "Dry cast (semi-dry, vibrated)",
    description:
      "Earth-damp mix compacted on a vibrating table. Strips in about an hour so one mould turns over many times a day, at the cost of a paler, more matte face.",
    waterCementRatio: 0.32,
    stripHours: 1,
  },
}

export const COLOR_INTENSITIES: Record<ColorIntensityId, ColorIntensity> = {
  light: {
    id: "light",
    label: "Light",
    description: "Cream, buff, soft sandstone tones.",
    dosagePercent: 3,
  },
  medium: {
    id: "medium",
    label: "Medium",
    description: "Terracotta, brown, olive. The usual choice.",
    dosagePercent: 5,
  },
  dark: {
    id: "dark",
    label: "Dark",
    description: "Charcoal, deep red, forest green.",
    dosagePercent: 8,
  },
  maximum: {
    id: "maximum",
    label: "Maximum",
    description: "Saturation point. Past this the color stops deepening.",
    dosagePercent: 10,
  },
}

export const SLAB_PRESETS: Record<SlabPresetId, SlabPreset> = {
  "stepping-300": {
    id: "stepping-300",
    label: "Stepping stone 300 x 300 x 40 mm",
    dimensions: { lengthMm: 300, widthMm: 300, thicknessMm: 40 },
    defaultMixDesign: "garden-stone",
  },
  "square-400": {
    id: "square-400",
    label: "Garden slab 400 x 400 x 40 mm",
    dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 40 },
    defaultMixDesign: "garden-stone",
  },
  "large-500": {
    id: "large-500",
    label: "Large slab 500 x 500 x 50 mm",
    dimensions: { lengthMm: 500, widthMm: 500, thicknessMm: 50 },
    defaultMixDesign: "garden-stone",
  },
  "brick-paver": {
    id: "brick-paver",
    label: "Paving brick 220 x 110 x 50 mm",
    dimensions: { lengthMm: 220, widthMm: 110, thicknessMm: 50 },
    defaultMixDesign: "paver-25",
  },
}

const DEFAULT_MIX_DESIGN: MixDesignId = "garden-stone"
const DEFAULT_COLOR_INTENSITY: ColorIntensityId = "medium"
const DEFAULT_CAST_METHOD: CastMethodId = "wet"

const ADMIXTURE_IDS: readonly AdmixtureId[] = ["plasticizer", "waterproofer"]
const REINFORCEMENT_IDS: readonly ReinforcementId[] = ["none", "fiber", "mesh"]
const MATERIAL_IDS: readonly MaterialId[] = [
  "cement",
  "sand",
  "stone",
  "water",
  "pigment",
  "fiber",
  "mesh",
  "plasticizer",
  "waterproofer",
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isMixDesignId(value: unknown): value is MixDesignId {
  return typeof value === "string" && value in MIX_DESIGNS
}

function isColorIntensityId(value: unknown): value is ColorIntensityId {
  return typeof value === "string" && value in COLOR_INTENSITIES
}

function isSlabPresetId(value: unknown): value is SlabPresetId {
  return typeof value === "string" && value in SLAB_PRESETS
}

function isCastMethodId(value: unknown): value is CastMethodId {
  return typeof value === "string" && value in CAST_METHODS
}

/** Greedy fill over descending pack sizes; optimal for the 25/5/1 kg denominations. */
function packPigment(requiredKg: number): PackBreakdown[] {
  let remaining = Math.ceil(requiredKg)
  if (remaining <= 0) return []

  const packs: PackBreakdown[] = []
  for (const sizeKg of PIGMENT_PACK_SIZES_KG) {
    const count = Math.floor(remaining / sizeKg)
    if (count > 0) {
      packs.push({ label: `${sizeKg} kg bag`, count, sizeKg })
      remaining -= count * sizeKg
    }
  }
  return packs
}

function readCosts(raw: unknown): ConcreteMixCosts | null {
  if (!raw || typeof raw !== "object") return null
  const source = raw as Record<string, unknown>

  const costs: ConcreteMixCosts = {}
  for (const material of MATERIAL_IDS) {
    const value = source[material]
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue
    costs[material] = Math.round(value)
  }
  return Object.keys(costs).length > 0 ? costs : null
}

// ── Validation ───────────────────────────────────────────────────────────────

function readDimensions(
  body: Record<string, unknown>
):
  | { ok: true; dimensions: SlabDimensions; presetId: SlabPresetId | null }
  | { ok: false; error: string } {
  if (body.presetId !== undefined && body.presetId !== null) {
    if (!isSlabPresetId(body.presetId)) {
      return {
        ok: false,
        error: `Unknown presetId. Expected one of: ${Object.keys(SLAB_PRESETS).join(", ")}`,
      }
    }
    return {
      ok: true,
      presetId: body.presetId,
      dimensions: { ...SLAB_PRESETS[body.presetId].dimensions },
    }
  }

  const rawDimensions = body.dimensions
  if (!rawDimensions || typeof rawDimensions !== "object") {
    return { ok: false, error: "Provide either presetId or dimensions" }
  }
  const source = rawDimensions as Record<string, unknown>
  const { lengthMm, widthMm, thicknessMm } = source

  if (!isPositiveNumber(lengthMm) || !isPositiveNumber(widthMm) || !isPositiveNumber(thicknessMm)) {
    return {
      ok: false,
      error: "dimensions.lengthMm, widthMm and thicknessMm must be positive numbers",
    }
  }
  if (
    lengthMm < MIN_SLAB_SIDE_MM ||
    lengthMm > MAX_SLAB_SIDE_MM ||
    widthMm < MIN_SLAB_SIDE_MM ||
    widthMm > MAX_SLAB_SIDE_MM
  ) {
    return {
      ok: false,
      error: `lengthMm and widthMm must be between ${MIN_SLAB_SIDE_MM} and ${MAX_SLAB_SIDE_MM}`,
    }
  }
  if (thicknessMm < MIN_SLAB_THICKNESS_MM || thicknessMm > MAX_SLAB_THICKNESS_MM) {
    return {
      ok: false,
      error: `thicknessMm must be between ${MIN_SLAB_THICKNESS_MM} and ${MAX_SLAB_THICKNESS_MM}`,
    }
  }
  return { ok: true, presetId: null, dimensions: { lengthMm, widthMm, thicknessMm } }
}

function readOptionalPercent(
  value: unknown,
  field: string,
  max: number,
  fallback: number
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: fallback }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { ok: false, error: `${field} must be a number of 0 or more` }
  }
  if (value > max) return { ok: false, error: `${field} must not exceed ${max}` }
  return { ok: true, value }
}

/**
 * Derives a slab count from the area being paved. Each stone occupies its own
 * footprint plus one joint on two sides, which is what actually tiles across a
 * run; the edge allowance then covers cuts and breakage while laying.
 */
function readCoverage(
  raw: unknown,
  dimensions: SlabDimensions
): { ok: true; coverage: CoverageInput; slabCount: number } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "coverage must be an object with areaM2" }
  }
  const source = raw as Record<string, unknown>

  const areaM2 = source.areaM2
  if (!isPositiveNumber(areaM2)) {
    return { ok: false, error: "coverage.areaM2 must be a positive number" }
  }
  if (areaM2 > MAX_AREA_M2) {
    return { ok: false, error: `coverage.areaM2 must not exceed ${MAX_AREA_M2}` }
  }

  const joint = readOptionalPercent(
    source.jointMm,
    "coverage.jointMm",
    MAX_JOINT_MM,
    DEFAULT_JOINT_MM
  )
  if (!joint.ok) return joint

  const edge = readOptionalPercent(
    source.edgeAllowancePercent,
    "coverage.edgeAllowancePercent",
    MAX_EDGE_ALLOWANCE_PERCENT,
    DEFAULT_EDGE_ALLOWANCE_PERCENT
  )
  if (!edge.ok) return edge

  const footprintM2 =
    ((dimensions.lengthMm + joint.value) / 1000) * ((dimensions.widthMm + joint.value) / 1000)
  const slabCount = Math.ceil((areaM2 / footprintM2) * (1 + edge.value / 100))

  if (slabCount > MAX_SLAB_COUNT) {
    return {
      ok: false,
      error: `That area needs ${slabCount} stones, which exceeds the ${MAX_SLAB_COUNT} limit`,
    }
  }

  return {
    ok: true,
    slabCount,
    coverage: { areaM2, jointMm: joint.value, edgeAllowancePercent: edge.value },
  }
}

function readAdmixtures(
  value: unknown
): { ok: true; value: AdmixtureId[] } | { ok: false; error: string } {
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
 * Narrows an untrusted request body into a `ConcreteMixInput`. Returns an error
 * string rather than throwing so route handlers can map it straight to a 400.
 */
export function validateConcreteMixInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Request body must be an object" }
  }
  const body = raw as Record<string, unknown>

  const slab = readDimensions(body)
  if (!slab.ok) return slab
  const { dimensions, presetId } = slab

  const hasSlabCount = body.slabCount !== undefined && body.slabCount !== null
  const hasCoverage = body.coverage !== undefined && body.coverage !== null

  if (hasSlabCount && hasCoverage) {
    return { ok: false, error: "Provide either slabCount or coverage, not both" }
  }
  if (!hasSlabCount && !hasCoverage) {
    return { ok: false, error: "Provide either slabCount or coverage" }
  }

  let slabCount: number
  let coverage: CoverageInput | null = null

  if (hasCoverage) {
    const resolved = readCoverage(body.coverage, dimensions)
    if (!resolved.ok) return resolved
    slabCount = resolved.slabCount
    coverage = resolved.coverage
  } else {
    const count = body.slabCount
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
      return { ok: false, error: "slabCount must be a positive integer" }
    }
    if (count > MAX_SLAB_COUNT) {
      return { ok: false, error: `slabCount must not exceed ${MAX_SLAB_COUNT}` }
    }
    slabCount = count
  }

  let mixDesignId: MixDesignId
  if (body.mixDesignId === undefined || body.mixDesignId === null) {
    mixDesignId = presetId ? SLAB_PRESETS[presetId].defaultMixDesign : DEFAULT_MIX_DESIGN
  } else if (isMixDesignId(body.mixDesignId)) {
    mixDesignId = body.mixDesignId
  } else {
    return {
      ok: false,
      error: `Unknown mixDesignId. Expected one of: ${Object.keys(MIX_DESIGNS).join(", ")}`,
    }
  }

  let castMethodId: CastMethodId = DEFAULT_CAST_METHOD
  if (body.castMethodId !== undefined && body.castMethodId !== null) {
    if (!isCastMethodId(body.castMethodId)) {
      return {
        ok: false,
        error: `Unknown castMethodId. Expected one of: ${Object.keys(CAST_METHODS).join(", ")}`,
      }
    }
    castMethodId = body.castMethodId
  }

  // An explicit dosage wins over the named intensity; the intensity is only a shortcut.
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
  } else {
    const intensity = body.colorIntensityId ?? DEFAULT_COLOR_INTENSITY
    if (!isColorIntensityId(intensity)) {
      return {
        ok: false,
        error: `Unknown colorIntensityId. Expected one of: ${Object.keys(COLOR_INTENSITIES).join(", ")}`,
      }
    }
    colorIntensityId = intensity
    pigmentDosagePercent = COLOR_INTENSITIES[intensity].dosagePercent
  }

  let cementType: CementType = "grey"
  if (body.cementType !== undefined && body.cementType !== null) {
    if (body.cementType !== "grey" && body.cementType !== "white") {
      return { ok: false, error: 'cementType must be "grey" or "white"' }
    }
    cementType = body.cementType
  }

  let reinforcement: ReinforcementId = "none"
  if (body.reinforcement !== undefined && body.reinforcement !== null) {
    if (
      typeof body.reinforcement !== "string" ||
      !REINFORCEMENT_IDS.includes(body.reinforcement as ReinforcementId)
    ) {
      return {
        ok: false,
        error: `Unknown reinforcement. Expected one of: ${REINFORCEMENT_IDS.join(", ")}`,
      }
    }
    reinforcement = body.reinforcement as ReinforcementId
  }

  const admixtures = readAdmixtures(body.admixtures)
  if (!admixtures.ok) return admixtures

  const waste = readOptionalPercent(
    body.wastePercent,
    "wastePercent",
    MAX_WASTE_PERCENT,
    DEFAULT_WASTE_PERCENT
  )
  if (!waste.ok) return waste

  let mixerCapacityM3: number | null = null
  if (body.mixerCapacityM3 !== undefined && body.mixerCapacityM3 !== null) {
    const capacity = body.mixerCapacityM3
    if (!isPositiveNumber(capacity)) {
      return { ok: false, error: "mixerCapacityM3 must be a positive number" }
    }
    if (capacity < MIN_MIXER_CAPACITY_M3 || capacity > MAX_MIXER_CAPACITY_M3) {
      return {
        ok: false,
        error: `mixerCapacityM3 must be between ${MIN_MIXER_CAPACITY_M3} and ${MAX_MIXER_CAPACITY_M3}`,
      }
    }
    mixerCapacityM3 = capacity
  }

  return {
    ok: true,
    value: {
      dimensions,
      slabCount,
      mixDesignId,
      castMethodId,
      pigmentDosagePercent,
      colorIntensityId,
      cementType,
      reinforcement,
      admixtures: admixtures.value,
      wastePercent: waste.value,
      mixerCapacityM3,
      presetId,
      coverage,
      costs: readCosts(body.costs),
    },
  }
}

// ── Calculation ──────────────────────────────────────────────────────────────

interface BatchTotals {
  cementKg: number
  sandKg: number
  stoneKg: number
  waterLitres: number
  pigmentKg: number
}

function buildWarnings(input: ConcreteMixInput, design: MixDesign, totals: BatchTotals): string[] {
  const warnings: string[] = []
  const { thicknessMm } = input.dimensions

  if (input.pigmentDosagePercent > PIGMENT_SATURATION_PERCENT) {
    warnings.push(
      `Pigment is dosed at ${input.pigmentDosagePercent}% of cement mass. Past ${PIGMENT_SATURATION_PERCENT}% the color stops deepening and compressive strength drops.`
    )
  }

  if (
    design.stoneSizeMm !== null &&
    design.stoneSizeMm > thicknessMm * MAX_STONE_TO_THICKNESS_RATIO
  ) {
    warnings.push(
      `${design.stoneSizeMm} mm stone is too coarse for a ${thicknessMm} mm slab. Use the garden stone mortar mix, or drop to 6.7 mm stone.`
    )
  }

  if (thicknessMm < FRAGILE_THICKNESS_MM) {
    warnings.push(
      input.reinforcement === "none"
        ? `At ${thicknessMm} mm the slab will crack when it is stripped from the form or carried. Add polypropylene fiber, or go to ${FRAGILE_THICKNESS_MM} mm.`
        : `At ${thicknessMm} mm the slab is below the ${FRAGILE_THICKNESS_MM} mm practical minimum even with reinforcement. Handle the stones flat and support them across the full face.`
    )
  }

  if (input.reinforcement === "mesh" && thicknessMm < MESH_MIN_THICKNESS_MM) {
    warnings.push(
      `Mesh needs cover above and below it, which a ${thicknessMm} mm slab cannot give. Use polypropylene fiber instead, or go to ${MESH_MIN_THICKNESS_MM} mm.`
    )
  }

  if (input.castMethodId === "dry" && thicknessMm > DRY_CAST_MAX_THICKNESS_MM) {
    warnings.push(
      `Table vibration will not compact a semi-dry mix through ${thicknessMm} mm. Wet cast anything deeper than ${DRY_CAST_MAX_THICKNESS_MM} mm.`
    )
  }

  if (totals.cementKg > COLOR_CONSISTENCY_CEMENT_KG) {
    warnings.push(
      `This batch needs ${Math.ceil(totals.cementKg / CEMENT_BAG_KG)} bags of cement, which is more than one mix. Pre-blend all the pigment through the full cement quantity before you start, or the slabs will come out in visibly different shades.`
    )
  }

  return warnings
}

function buildNotes(input: ConcreteMixInput, castMethod: CastMethod): string[] {
  const notes = [
    "Weigh the pigment, do not scoop it. Inconsistent dosing between batches is the most common reason slabs come out mismatched.",
    "Blend the pigment dry through the cement and sand before adding any water.",
  ]

  if (input.castMethodId === "dry") {
    notes.push(
      "A semi-dry mix only works on a vibrating table or press. Hand-tamped, it comes out crumbly and pale."
    )
    notes.push(
      `Stones can be stripped after about ${castMethod.stripHours} hour, so one mould turns over many times a day.`
    )
  } else {
    notes.push(`Leave the stones in the mould for ${castMethod.stripHours} hours before stripping.`)
  }

  notes.push(
    "Keep the slabs damp for the first 7 days. Color lightens considerably as they dry out."
  )

  if (
    input.cementType === "grey" &&
    input.pigmentDosagePercent <= COLOR_INTENSITIES.light.dosagePercent
  ) {
    notes.push(
      "Grey cement mutes pale colors towards a dirty pastel. For cream, buff or any bright shade, cast with white cement instead."
    )
  }

  if (input.admixtures.includes("plasticizer")) {
    notes.push(
      "Plasticizer lets you hold the same workability on less water, which deepens the finished color and lifts strength."
    )
  }

  notes.push(
    "Seal the finished slabs. Unsealed pigmented concrete fades in direct sun and shows efflorescence."
  )

  return notes
}

function buildMixerPlan(
  input: ConcreteMixInput,
  mixedVolumeM3: number,
  totals: BatchTotals
): MixerPlan | null {
  const capacityM3 = input.mixerCapacityM3
  if (capacityM3 === null) return null

  // Nudge off the float dust so a batch that is an exact multiple of the drum
  // does not gain a phantom load carrying 1e-16 cubic metres.
  const loadCount = Math.max(1, Math.ceil(mixedVolumeM3 / capacityM3 - 1e-9))
  const finalLoadM3 = round(mixedVolumeM3 - (loadCount - 1) * capacityM3, 4)
  // A final load within rounding distance of a full one means the batch divides evenly.
  const dividesEvenly = Math.abs(finalLoadM3 - capacityM3) < 1e-6
  const fullLoadCount = dividesEvenly ? loadCount : loadCount - 1

  const loadFor = (volumeM3: number): MixerLoad => {
    const share = mixedVolumeM3 === 0 ? 0 : volumeM3 / mixedVolumeM3
    return {
      volumeM3: round(volumeM3, 4),
      cementKg: round(totals.cementKg * share, 2),
      sandKg: round(totals.sandKg * share, 2),
      stoneKg: round(totals.stoneKg * share, 2),
      waterLitres: round(totals.waterLitres * share, 2),
      pigmentGrams: round(totals.pigmentKg * share * 1000, 1),
    }
  }

  return {
    capacityM3,
    loadCount,
    fullLoadCount,
    fullLoad: loadFor(capacityM3),
    finalLoad: dividesEvenly ? null : loadFor(finalLoadM3),
  }
}

function buildReinforcementLines(
  input: ConcreteMixInput,
  mixedVolumeM3: number,
  costs: ConcreteMixCosts | null
): MaterialLine[] {
  if (input.reinforcement === "fiber") {
    const requiredKg = mixedVolumeM3 * FIBER_KG_PER_M3
    const bags = Math.ceil(requiredKg / FIBER_BAG_KG)
    return [
      {
        material: "fiber",
        label: "Polypropylene micro-fiber",
        requiredQuantity: round(requiredKg, 3),
        requiredUnit: "kg",
        purchaseQuantity: bags,
        purchaseUnit: `${FIBER_BAG_GRAMS} g bags`,
        estimatedCostCents: costs?.fiber !== undefined ? bags * costs.fiber : undefined,
      },
    ]
  }

  if (input.reinforcement === "mesh") {
    const planAreaM2 =
      (input.dimensions.lengthMm / 1000) * (input.dimensions.widthMm / 1000) * input.slabCount
    const requiredM2 = planAreaM2 * MESH_LAP_FACTOR
    const sheets = Math.ceil(requiredM2 / MESH_SHEET_M2)
    return [
      {
        material: "mesh",
        label: "Welded reinforcing mesh",
        requiredQuantity: round(requiredM2, 2),
        requiredUnit: "m2",
        purchaseQuantity: sheets,
        purchaseUnit: `${MESH_SHEET_M2} m2 sheets`,
        estimatedCostCents: costs?.mesh !== undefined ? sheets * costs.mesh : undefined,
      },
    ]
  }

  return []
}

function buildAdmixtureLines(
  input: ConcreteMixInput,
  cementBags: number,
  costs: ConcreteMixCosts | null
): MaterialLine[] {
  const lines: MaterialLine[] = []

  if (input.admixtures.includes("plasticizer")) {
    const requiredLitres = (cementBags * PLASTICIZER_ML_PER_CEMENT_BAG) / 1000
    const purchase = Math.ceil(requiredLitres)
    lines.push({
      material: "plasticizer",
      label: "Plasticizer",
      requiredQuantity: round(requiredLitres, 2),
      requiredUnit: "litres",
      purchaseQuantity: purchase,
      purchaseUnit: "litres",
      estimatedCostCents:
        costs?.plasticizer !== undefined ? purchase * costs.plasticizer : undefined,
    })
  }

  if (input.admixtures.includes("waterproofer")) {
    const requiredLitres = cementBags * WATERPROOFER_LITRES_PER_CEMENT_BAG
    const purchase = Math.ceil(requiredLitres)
    lines.push({
      material: "waterproofer",
      label: "Integral waterproofer",
      requiredQuantity: round(requiredLitres, 2),
      requiredUnit: "litres",
      purchaseQuantity: purchase,
      purchaseUnit: "litres",
      estimatedCostCents:
        costs?.waterproofer !== undefined ? purchase * costs.waterproofer : undefined,
    })
  }

  return lines
}

/**
 * Expands a validated input into a full bill of materials. Pure: same input,
 * same output, every time.
 */
export function calculateConcreteMix(input: ConcreteMixInput): ConcreteMixResult {
  const design = MIX_DESIGNS[input.mixDesignId]
  const castMethod = CAST_METHODS[input.castMethodId]
  const waterCementRatio = castMethod.waterCementRatio ?? design.waterCementRatio
  const { lengthMm, widthMm, thicknessMm } = input.dimensions

  const slabVolumeM3 = (lengthMm / 1000) * (widthMm / 1000) * (thicknessMm / 1000)
  const netVolumeM3 = slabVolumeM3 * input.slabCount
  const mixedVolumeM3 = netVolumeM3 * (1 + input.wastePercent / 100)

  const totals: BatchTotals = {
    cementKg: mixedVolumeM3 * design.cementKgPerM3,
    sandKg: mixedVolumeM3 * design.sandKgPerM3,
    stoneKg: mixedVolumeM3 * design.stoneKgPerM3,
    waterLitres: mixedVolumeM3 * design.cementKgPerM3 * waterCementRatio,
    pigmentKg: mixedVolumeM3 * design.cementKgPerM3 * (input.pigmentDosagePercent / 100),
  }

  // Per-slab figures are net of waste: this is what actually ends up in one stone.
  const cementPerSlabKg = slabVolumeM3 * design.cementKgPerM3
  const pigmentGramsPerSlab = cementPerSlabKg * (input.pigmentDosagePercent / 100) * 1000
  const slabMassKg =
    slabVolumeM3 * (design.cementKgPerM3 + design.sandKgPerM3 + design.stoneKgPerM3) +
    cementPerSlabKg * waterCementRatio

  const cementBags = Math.ceil(totals.cementKg / CEMENT_BAG_KG)
  const sandM3 = totals.sandKg / SAND_DENSITY_KG_PER_M3
  const stoneM3 = totals.stoneKg / STONE_DENSITY_KG_PER_M3
  const pigmentPacks = packPigment(totals.pigmentKg)
  const pigmentPurchaseKg = pigmentPacks.reduce((sum, pack) => sum + pack.count * pack.sizeKg, 0)

  const costs = input.costs
  const materials: MaterialLine[] = [
    {
      material: "cement",
      label: `${input.cementType === "white" ? "White" : "Grey"} cement`,
      requiredQuantity: round(totals.cementKg, 1),
      requiredUnit: "kg",
      purchaseQuantity: cementBags,
      purchaseUnit: `${CEMENT_BAG_KG} kg bags`,
      estimatedCostCents: costs?.cement !== undefined ? cementBags * costs.cement : undefined,
    },
    {
      material: "sand",
      label: design.stoneSizeMm === null ? "Plaster sand" : "Concrete sand",
      requiredQuantity: round(totals.sandKg, 1),
      requiredUnit: "kg",
      purchaseQuantity: round(sandM3, 3),
      purchaseUnit: "m3",
      estimatedCostCents: costs?.sand !== undefined ? Math.round(sandM3 * costs.sand) : undefined,
    },
  ]

  if (design.stoneKgPerM3 > 0) {
    materials.push({
      material: "stone",
      label: `${design.stoneSizeMm} mm stone`,
      requiredQuantity: round(totals.stoneKg, 1),
      requiredUnit: "kg",
      purchaseQuantity: round(stoneM3, 3),
      purchaseUnit: "m3",
      estimatedCostCents:
        costs?.stone !== undefined ? Math.round(stoneM3 * costs.stone) : undefined,
    })
  }

  materials.push({
    material: "water",
    label: "Clean water",
    requiredQuantity: round(totals.waterLitres, 1),
    requiredUnit: "litres",
    purchaseQuantity: round(totals.waterLitres, 1),
    purchaseUnit: "litres",
  })

  if (totals.pigmentKg > 0) {
    materials.push({
      material: "pigment",
      label: "Oxide pigment",
      requiredQuantity: round(totals.pigmentKg, 3),
      requiredUnit: "kg",
      purchaseQuantity: pigmentPurchaseKg,
      purchaseUnit: "kg",
      packs: pigmentPacks,
      estimatedCostCents:
        costs?.pigment !== undefined ? pigmentPurchaseKg * costs.pigment : undefined,
    })
  }

  materials.push(...buildReinforcementLines(input, mixedVolumeM3, costs))
  materials.push(...buildAdmixtureLines(input, cementBags, costs))

  const pricedLines = materials.filter((line) => line.estimatedCostCents !== undefined)
  const estimatedCostCents = pricedLines.length
    ? pricedLines.reduce((sum, line) => sum + (line.estimatedCostCents ?? 0), 0)
    : null
  const unpricedMaterials = materials
    .filter((line) => line.material !== "water" && line.estimatedCostCents === undefined)
    .map((line) => line.material)

  const coverage: CoverageResult | null = input.coverage
    ? {
        requestedAreaM2: input.coverage.areaM2,
        jointMm: input.coverage.jointMm,
        edgeAllowancePercent: input.coverage.edgeAllowancePercent,
        slabFootprintM2: round(
          ((lengthMm + input.coverage.jointMm) / 1000) *
            ((widthMm + input.coverage.jointMm) / 1000),
          5
        ),
        coveredAreaM2: round(
          input.slabCount *
            ((lengthMm + input.coverage.jointMm) / 1000) *
            ((widthMm + input.coverage.jointMm) / 1000),
          3
        ),
      }
    : null

  return {
    slab: {
      presetId: input.presetId,
      dimensions: input.dimensions,
      volumeM3: round(slabVolumeM3, 5),
      massKg: round(slabMassKg, 2),
    },
    batch: {
      slabCount: input.slabCount,
      wastePercent: input.wastePercent,
      netVolumeM3: round(netVolumeM3, 4),
      mixedVolumeM3: round(mixedVolumeM3, 4),
    },
    coverage,
    mixDesign: design,
    castMethod,
    waterCementRatio,
    pigment: {
      intensityId: input.colorIntensityId,
      dosagePercent: input.pigmentDosagePercent,
      gramsPerSlab: round(pigmentGramsPerSlab, 1),
      totalKg: round(totals.pigmentKg, 3),
      purchaseKg: pigmentPurchaseKg,
      packs: pigmentPacks,
    },
    reinforcement: input.reinforcement,
    admixtures: input.admixtures,
    mixerPlan: buildMixerPlan(input, mixedVolumeM3, totals),
    materials,
    estimatedCostCents,
    unpricedMaterials,
    warnings: buildWarnings(input, design, totals),
    notes: buildNotes(input, castMethod),
  }
}

/** Reference data for the picker UI, so the client never hard-codes the options. */
export function getConcreteMixOptions() {
  return {
    slabPresets: Object.values(SLAB_PRESETS),
    mixDesigns: Object.values(MIX_DESIGNS),
    castMethods: Object.values(CAST_METHODS),
    colorIntensities: Object.values(COLOR_INTENSITIES),
    reinforcements: REINFORCEMENT_IDS,
    admixtures: ADMIXTURE_IDS,
    defaults: {
      mixDesignId: DEFAULT_MIX_DESIGN,
      castMethodId: DEFAULT_CAST_METHOD,
      colorIntensityId: DEFAULT_COLOR_INTENSITY,
      wastePercent: DEFAULT_WASTE_PERCENT,
      cementType: "grey" as CementType,
      reinforcement: "none" as ReinforcementId,
      jointMm: DEFAULT_JOINT_MM,
      edgeAllowancePercent: DEFAULT_EDGE_ALLOWANCE_PERCENT,
    },
    limits: {
      maxSlabCount: MAX_SLAB_COUNT,
      maxPigmentPercent: MAX_PIGMENT_PERCENT,
      pigmentSaturationPercent: PIGMENT_SATURATION_PERCENT,
      maxWastePercent: MAX_WASTE_PERCENT,
      maxAreaM2: MAX_AREA_M2,
      maxJointMm: MAX_JOINT_MM,
      minMixerCapacityM3: MIN_MIXER_CAPACITY_M3,
      maxMixerCapacityM3: MAX_MIXER_CAPACITY_M3,
    },
  }
}
