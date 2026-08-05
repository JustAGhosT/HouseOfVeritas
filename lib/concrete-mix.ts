/**
 * Concrete garden stone / paver mix and pigment calculator.
 *
 * Deterministic and pure: no network, no persistence, no clock. Given slab
 * dimensions, a batch size and a target color it returns the cement, sand,
 * stone, water and oxide pigment needed, rounded up to the pack sizes sold at
 * local builders' merchants.
 *
 * Two conventions matter and are easy to get wrong:
 *   1. Pigment is dosed as a percentage of *cement* mass, never of the total
 *      mix. Suppliers spec it that way and the color follows the binder.
 *   2. Past ~10% of cement mass the color stops deepening and the slab starts
 *      losing strength, so dosage is capped rather than extrapolated.
 *
 * Mix designs are the Cement & Concrete SA volumetric tables converted to mass
 * per cubic metre using loose bulk densities.
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

// ── Types ────────────────────────────────────────────────────────────────────

export type MixDesignId = "garden-stone" | "paver-25" | "paver-30"
export type ColorIntensityId = "light" | "medium" | "dark" | "maximum"
export type SlabPresetId = "stepping-300" | "square-400" | "large-500" | "brick-paver"
export type CementType = "grey" | "white"
export type MaterialId = "cement" | "sand" | "stone" | "water" | "pigment"

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
  waterLitresPerM3: number
}

export interface ColorIntensity {
  id: ColorIntensityId
  label: string
  description: string
  dosagePercent: number
}

export interface ConcreteMixCosts {
  cementPerBagCents?: number
  sandPerM3Cents?: number
  stonePerM3Cents?: number
  pigmentPerKgCents?: number
}

export interface ConcreteMixInput {
  dimensions: SlabDimensions
  slabCount: number
  mixDesignId: MixDesignId
  /** Percent of cement mass. Already clamped to MAX_PIGMENT_PERCENT. */
  pigmentDosagePercent: number
  colorIntensityId: ColorIntensityId | null
  cementType: CementType
  wastePercent: number
  presetId: SlabPresetId | null
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
  /** Quantity expressed in `unit`, already rounded up to whole purchase units where relevant. */
  quantity: number
  unit: string
  massKg?: number
  packs?: PackBreakdown[]
  estimatedCostCents?: number
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
  mixDesign: MixDesign
  pigment: {
    intensityId: ColorIntensityId | null
    dosagePercent: number
    gramsPerSlab: number
    totalKg: number
    purchaseKg: number
    packs: PackBreakdown[]
  }
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
    waterLitresPerM3: 200,
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
    waterLitresPerM3: 190,
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
    waterLitresPerM3: 200,
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
  const keys = [
    "cementPerBagCents",
    "sandPerM3Cents",
    "stonePerM3Cents",
    "pigmentPerKgCents",
  ] as const

  const costs: ConcreteMixCosts = {}
  for (const key of keys) {
    const value = source[key]
    if (value === undefined || value === null) continue
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue
    costs[key] = Math.round(value)
  }
  return Object.keys(costs).length > 0 ? costs : null
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Narrows an untrusted request body into a `ConcreteMixInput`. Returns an error
 * string rather than throwing so route handlers can map it straight to a 400.
 */
export function validateConcreteMixInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Request body must be an object" }
  }
  const body = raw as Record<string, unknown>

  let presetId: SlabPresetId | null = null
  let dimensions: SlabDimensions

  if (body.presetId !== undefined && body.presetId !== null) {
    if (!isSlabPresetId(body.presetId)) {
      return {
        ok: false,
        error: `Unknown presetId. Expected one of: ${Object.keys(SLAB_PRESETS).join(", ")}`,
      }
    }
    presetId = body.presetId
    dimensions = { ...SLAB_PRESETS[presetId].dimensions }
  } else {
    const rawDimensions = body.dimensions
    if (!rawDimensions || typeof rawDimensions !== "object") {
      return { ok: false, error: "Provide either presetId or dimensions" }
    }
    const source = rawDimensions as Record<string, unknown>
    const lengthMm = source.lengthMm
    const widthMm = source.widthMm
    const thicknessMm = source.thicknessMm

    if (
      !isPositiveNumber(lengthMm) ||
      !isPositiveNumber(widthMm) ||
      !isPositiveNumber(thicknessMm)
    ) {
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
    dimensions = { lengthMm, widthMm, thicknessMm }
  }

  const slabCount = body.slabCount
  if (typeof slabCount !== "number" || !Number.isInteger(slabCount) || slabCount < 1) {
    return { ok: false, error: "slabCount must be a positive integer" }
  }
  if (slabCount > MAX_SLAB_COUNT) {
    return { ok: false, error: `slabCount must not exceed ${MAX_SLAB_COUNT}` }
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

  let wastePercent = DEFAULT_WASTE_PERCENT
  if (body.wastePercent !== undefined && body.wastePercent !== null) {
    const waste = body.wastePercent
    if (typeof waste !== "number" || !Number.isFinite(waste) || waste < 0) {
      return { ok: false, error: "wastePercent must be a number of 0 or more" }
    }
    if (waste > MAX_WASTE_PERCENT) {
      return { ok: false, error: `wastePercent must not exceed ${MAX_WASTE_PERCENT}` }
    }
    wastePercent = waste
  }

  return {
    ok: true,
    value: {
      dimensions,
      slabCount,
      mixDesignId,
      pigmentDosagePercent,
      colorIntensityId,
      cementType,
      wastePercent,
      presetId,
      costs: readCosts(body.costs),
    },
  }
}

// ── Calculation ──────────────────────────────────────────────────────────────

function buildWarnings(input: ConcreteMixInput, design: MixDesign, cementKg: number): string[] {
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
      `At ${thicknessMm} mm the slab will crack when it is stripped from the form or carried. ${FRAGILE_THICKNESS_MM} mm is the practical minimum without reinforcement.`
    )
  }

  if (cementKg > COLOR_CONSISTENCY_CEMENT_KG) {
    warnings.push(
      `This batch needs ${Math.ceil(cementKg / CEMENT_BAG_KG)} bags of cement, which is more than one mix. Pre-blend all the pigment through the full cement quantity before you start, or the slabs will come out in visibly different shades.`
    )
  }

  return warnings
}

function buildNotes(input: ConcreteMixInput): string[] {
  const notes = [
    "Weigh the pigment, do not scoop it. Inconsistent dosing between batches is the most common reason slabs come out mismatched.",
    "Blend the pigment dry through the cement and sand before adding any water.",
    "Keep the slabs damp for the first 7 days. Color lightens considerably as the concrete dries out.",
  ]

  if (
    input.cementType === "grey" &&
    input.pigmentDosagePercent <= COLOR_INTENSITIES.light.dosagePercent
  ) {
    notes.push(
      "Grey cement mutes pale colors towards a dirty pastel. For cream, buff or any bright shade, cast with white cement instead."
    )
  }

  notes.push(
    "Seal the finished slabs. Unsealed pigmented concrete fades in direct sun and shows efflorescence."
  )

  return notes
}

/**
 * Expands a validated input into a full bill of materials. Pure: same input,
 * same output, every time.
 */
export function calculateConcreteMix(input: ConcreteMixInput): ConcreteMixResult {
  const design = MIX_DESIGNS[input.mixDesignId]
  const { lengthMm, widthMm, thicknessMm } = input.dimensions

  const slabVolumeM3 = (lengthMm / 1000) * (widthMm / 1000) * (thicknessMm / 1000)
  const netVolumeM3 = slabVolumeM3 * input.slabCount
  const mixedVolumeM3 = netVolumeM3 * (1 + input.wastePercent / 100)

  const cementKg = mixedVolumeM3 * design.cementKgPerM3
  const sandKg = mixedVolumeM3 * design.sandKgPerM3
  const stoneKg = mixedVolumeM3 * design.stoneKgPerM3
  const waterLitres = mixedVolumeM3 * design.waterLitresPerM3
  const pigmentKg = cementKg * (input.pigmentDosagePercent / 100)

  // Per-slab figures are net of waste: this is what actually ends up in one stone.
  const pigmentGramsPerSlab =
    slabVolumeM3 * design.cementKgPerM3 * (input.pigmentDosagePercent / 100) * 1000
  const slabMassKg =
    slabVolumeM3 *
    (design.cementKgPerM3 + design.sandKgPerM3 + design.stoneKgPerM3 + design.waterLitresPerM3)

  const cementBags = Math.ceil(cementKg / CEMENT_BAG_KG)
  const sandM3 = sandKg / SAND_DENSITY_KG_PER_M3
  const stoneM3 = stoneKg / STONE_DENSITY_KG_PER_M3
  const pigmentPacks = packPigment(pigmentKg)
  const pigmentPurchaseKg = pigmentPacks.reduce((sum, pack) => sum + pack.count * pack.sizeKg, 0)

  const costs = input.costs
  const materials: MaterialLine[] = [
    {
      material: "cement",
      label: `${input.cementType === "white" ? "White" : "Grey"} cement`,
      quantity: cementBags,
      unit: `${CEMENT_BAG_KG} kg bags`,
      massKg: round(cementKg, 1),
      estimatedCostCents:
        costs?.cementPerBagCents !== undefined ? cementBags * costs.cementPerBagCents : undefined,
    },
  ]

  materials.push({
    material: "sand",
    label: design.stoneSizeMm === null ? "Plaster sand" : "Concrete sand",
    quantity: round(sandM3, 3),
    unit: "m3",
    massKg: round(sandKg, 1),
    estimatedCostCents:
      costs?.sandPerM3Cents !== undefined ? Math.round(sandM3 * costs.sandPerM3Cents) : undefined,
  })

  if (design.stoneKgPerM3 > 0) {
    materials.push({
      material: "stone",
      label: `${design.stoneSizeMm} mm stone`,
      quantity: round(stoneM3, 3),
      unit: "m3",
      massKg: round(stoneKg, 1),
      estimatedCostCents:
        costs?.stonePerM3Cents !== undefined
          ? Math.round(stoneM3 * costs.stonePerM3Cents)
          : undefined,
    })
  }

  materials.push({
    material: "water",
    label: "Clean water",
    quantity: round(waterLitres, 1),
    unit: "litres",
  })

  if (pigmentKg > 0) {
    materials.push({
      material: "pigment",
      label: "Oxide pigment",
      quantity: round(pigmentKg, 3),
      unit: "kg",
      packs: pigmentPacks,
      estimatedCostCents:
        costs?.pigmentPerKgCents !== undefined
          ? pigmentPurchaseKg * costs.pigmentPerKgCents
          : undefined,
    })
  }

  const pricedLines = materials.filter((line) => line.estimatedCostCents !== undefined)
  const estimatedCostCents = pricedLines.length
    ? pricedLines.reduce((sum, line) => sum + (line.estimatedCostCents ?? 0), 0)
    : null
  const unpricedMaterials = materials
    .filter((line) => line.material !== "water" && line.estimatedCostCents === undefined)
    .map((line) => line.material)

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
    mixDesign: design,
    pigment: {
      intensityId: input.colorIntensityId,
      dosagePercent: input.pigmentDosagePercent,
      gramsPerSlab: round(pigmentGramsPerSlab, 1),
      totalKg: round(pigmentKg, 3),
      purchaseKg: pigmentPurchaseKg,
      packs: pigmentPacks,
    },
    materials,
    estimatedCostCents,
    unpricedMaterials,
    warnings: buildWarnings(input, design, cementKg),
    notes: buildNotes(input),
  }
}

/** Reference data for the picker UI, so the client never hard-codes the options. */
export function getConcreteMixOptions() {
  return {
    slabPresets: Object.values(SLAB_PRESETS),
    mixDesigns: Object.values(MIX_DESIGNS),
    colorIntensities: Object.values(COLOR_INTENSITIES),
    defaults: {
      mixDesignId: DEFAULT_MIX_DESIGN,
      colorIntensityId: DEFAULT_COLOR_INTENSITY,
      wastePercent: DEFAULT_WASTE_PERCENT,
      cementType: "grey" as CementType,
    },
    limits: {
      maxSlabCount: MAX_SLAB_COUNT,
      maxPigmentPercent: MAX_PIGMENT_PERCENT,
      pigmentSaturationPercent: PIGMENT_SATURATION_PERCENT,
      maxWastePercent: MAX_WASTE_PERCENT,
    },
  }
}
