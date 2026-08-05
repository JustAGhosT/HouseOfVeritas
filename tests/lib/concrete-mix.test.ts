import { describe, it, expect } from "vitest"
import {
  CEMENT_BAG_KG,
  FIBER_KG_PER_M3,
  MAX_PIGMENT_PERCENT,
  MAX_SLAB_COUNT,
  MESH_SHEET_M2,
  calculateConcreteMix,
  getConcreteMixOptions,
  validateConcreteMixInput,
  type ConcreteMixInput,
  type ConcreteMixResult,
  type MaterialId,
} from "@/lib/concrete-mix"

/** Validates a body and fails the test loudly if it was rejected. */
function validated(body: unknown): ConcreteMixInput {
  const result = validateConcreteMixInput(body)
  if (!result.ok) throw new Error(`Expected valid input, got: ${result.error}`)
  return result.value
}

function calculate(body: unknown): ConcreteMixResult {
  return calculateConcreteMix(validated(body))
}

function lineFor(result: ConcreteMixResult, material: MaterialId) {
  return result.materials.find((line) => line.material === material)
}

function errorFor(body: unknown): string {
  const result = validateConcreteMixInput(body)
  if (result.ok) throw new Error("Expected input to be rejected")
  return result.error
}

describe("validateConcreteMixInput", () => {
  it("accepts a preset and inherits its dimensions and mix design", () => {
    const input = validated({ presetId: "brick-paver", slabCount: 10 })

    expect(input.dimensions).toEqual({ lengthMm: 220, widthMm: 110, thicknessMm: 50 })
    expect(input.mixDesignId).toBe("paver-25")
    expect(input.presetId).toBe("brick-paver")
  })

  it("defaults to a wet-cast medium color at 5% of cement mass with 10% waste", () => {
    const input = validated({ presetId: "square-400", slabCount: 1 })

    expect(input.colorIntensityId).toBe("medium")
    expect(input.pigmentDosagePercent).toBe(5)
    expect(input.castMethodId).toBe("wet")
    expect(input.wastePercent).toBe(10)
    expect(input.cementType).toBe("grey")
    expect(input.reinforcement).toBe("none")
    expect(input.admixtures).toEqual([])
    expect(input.mixerCapacityM3).toBeNull()
  })

  it("lets an explicit dosage override the named intensity", () => {
    const input = validated({
      presetId: "square-400",
      slabCount: 1,
      colorIntensityId: "light",
      pigmentDosagePercent: 7.5,
    })

    expect(input.pigmentDosagePercent).toBe(7.5)
    expect(input.colorIntensityId).toBeNull()
  })

  it("accepts custom dimensions without a preset", () => {
    const input = validated({
      dimensions: { lengthMm: 600, widthMm: 300, thicknessMm: 45 },
      slabCount: 4,
    })

    expect(input.dimensions.lengthMm).toBe(600)
    expect(input.presetId).toBeNull()
    expect(input.mixDesignId).toBe("garden-stone")
  })

  it("rejects a body that is not an object", () => {
    expect(validateConcreteMixInput("nope")).toEqual({
      ok: false,
      error: "Request body must be an object",
    })
    expect(validateConcreteMixInput(null).ok).toBe(false)
  })

  it("rejects a request with neither preset nor dimensions", () => {
    expect(errorFor({ slabCount: 5 })).toContain("presetId or dimensions")
  })

  it("requires exactly one of slabCount and coverage", () => {
    expect(errorFor({ presetId: "square-400" })).toBe("Provide either slabCount or coverage")
    expect(errorFor({ presetId: "square-400", slabCount: 5, coverage: { areaM2: 10 } })).toBe(
      "Provide either slabCount or coverage, not both"
    )
  })

  it("rejects unknown preset, mix design, cast method and intensity ids", () => {
    expect(validateConcreteMixInput({ presetId: "hexagon", slabCount: 1 }).ok).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, mixDesignId: "screed" }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, castMethodId: "sprayed" }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, colorIntensityId: "neon" })
        .ok
    ).toBe(false)
  })

  it("rejects non-integer, zero and oversized slab counts", () => {
    expect(validateConcreteMixInput({ presetId: "square-400", slabCount: 0 }).ok).toBe(false)
    expect(validateConcreteMixInput({ presetId: "square-400", slabCount: 2.5 }).ok).toBe(false)
    expect(validateConcreteMixInput({ presetId: "square-400", slabCount: -3 }).ok).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: MAX_SLAB_COUNT + 1 }).ok
    ).toBe(false)
    expect(validateConcreteMixInput({ presetId: "square-400", slabCount: MAX_SLAB_COUNT }).ok).toBe(
      true
    )
  })

  it("rejects dimensions outside the castable range", () => {
    expect(
      errorFor({ dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 5 }, slabCount: 1 })
    ).toContain("thicknessMm")
    expect(
      validateConcreteMixInput({
        dimensions: { lengthMm: 5000, widthMm: 400, thicknessMm: 40 },
        slabCount: 1,
      }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({
        dimensions: { lengthMm: "400", widthMm: 400, thicknessMm: 40 },
        slabCount: 1,
      }).ok
    ).toBe(false)
  })

  it("rejects a pigment dosage above the hard ceiling but allows the saturation point", () => {
    expect(
      validateConcreteMixInput({
        presetId: "square-400",
        slabCount: 1,
        pigmentDosagePercent: MAX_PIGMENT_PERCENT + 0.1,
      }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({
        presetId: "square-400",
        slabCount: 1,
        pigmentDosagePercent: MAX_PIGMENT_PERCENT,
      }).ok
    ).toBe(true)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, pigmentDosagePercent: -1 })
        .ok
    ).toBe(false)
  })

  it("rejects an out-of-range waste allowance and an unknown cement type", () => {
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, wastePercent: 80 }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, wastePercent: -5 }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, cementType: "beige" }).ok
    ).toBe(false)
  })

  it("rejects unknown reinforcement and admixtures", () => {
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, reinforcement: "bar" }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, admixtures: ["retarder"] })
        .ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, admixtures: "plasticizer" })
        .ok
    ).toBe(false)
  })

  it("deduplicates admixtures into a stable order", () => {
    const input = validated({
      presetId: "square-400",
      slabCount: 1,
      admixtures: ["waterproofer", "plasticizer", "waterproofer"],
    })

    expect(input.admixtures).toEqual(["plasticizer", "waterproofer"])
  })

  it("rejects a mixer capacity outside the range of a real machine", () => {
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, mixerCapacityM3: 0 }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, mixerCapacityM3: 5 }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, mixerCapacityM3: 0.15 }).ok
    ).toBe(true)
  })

  it("drops malformed cost entries and keeps the valid ones", () => {
    const input = validated({
      presetId: "square-400",
      slabCount: 1,
      costs: { cement: 12000, pigment: -5, sand: "cheap", gravel: 100 },
    })

    expect(input.costs).toEqual({ cement: 12000 })
  })

  it("treats a costs object with nothing usable as no costs at all", () => {
    const input = validated({
      presetId: "square-400",
      slabCount: 1,
      costs: { cement: Number.NaN },
    })

    expect(input.costs).toBeNull()
  })
})

describe("coverage-driven slab counts", () => {
  it("derives the slab count from the paved area, joint and edge allowance", () => {
    const result = calculate({ presetId: "square-400", coverage: { areaM2: 12 } })

    // A 400 mm slab with a 10 mm joint occupies 0.41 x 0.41 = 0.1681 m2.
    // 12 / 0.1681 = 71.4 stones, plus the 5% edge allowance = 75 after rounding up.
    expect(result.coverage?.slabFootprintM2).toBe(0.1681)
    expect(result.batch.slabCount).toBe(75)
    expect(result.coverage?.requestedAreaM2).toBe(12)
    expect(result.coverage?.jointMm).toBe(10)
    expect(result.coverage?.edgeAllowancePercent).toBe(5)
  })

  it("covers more ground with a wider joint", () => {
    const tight = calculate({ presetId: "square-400", coverage: { areaM2: 12, jointMm: 0 } })
    const wide = calculate({ presetId: "square-400", coverage: { areaM2: 12, jointMm: 30 } })

    expect(tight.batch.slabCount).toBeGreaterThan(wide.batch.slabCount)
    expect(tight.coverage?.slabFootprintM2).toBe(0.16)
  })

  it("adds stones for cut edges without touching the mix waste allowance", () => {
    const none = calculate({
      presetId: "square-400",
      coverage: { areaM2: 12, edgeAllowancePercent: 0 },
    })
    const generous = calculate({
      presetId: "square-400",
      coverage: { areaM2: 12, edgeAllowancePercent: 20 },
    })

    expect(none.batch.slabCount).toBe(72)
    expect(generous.batch.slabCount).toBe(86)
    expect(none.batch.wastePercent).toBe(10)
    expect(generous.batch.wastePercent).toBe(10)
  })

  it("reports the area the stones actually cover", () => {
    const result = calculate({ presetId: "square-400", coverage: { areaM2: 12 } })

    // 75 stones at 0.1681 m2 each, so the run overshoots the 12 m2 asked for.
    expect(result.coverage?.coveredAreaM2).toBeCloseTo(12.607, 2)
    expect(result.coverage?.coveredAreaM2).toBeGreaterThan(12)
  })

  it("is null when the batch was given as a slab count", () => {
    expect(calculate({ presetId: "square-400", slabCount: 10 }).coverage).toBeNull()
  })

  it("rejects a non-positive, oversized or malformed area", () => {
    expect(errorFor({ presetId: "square-400", coverage: { areaM2: 0 } })).toContain("areaM2")
    expect(errorFor({ presetId: "square-400", coverage: { areaM2: 5000 } })).toContain("areaM2")
    expect(errorFor({ presetId: "square-400", coverage: "12" })).toContain("coverage")
    expect(errorFor({ presetId: "square-400", coverage: { areaM2: 10, jointMm: 500 } })).toContain(
      "jointMm"
    )
  })

  it("rejects an area that would need more stones than the batch limit allows", () => {
    expect(
      errorFor({
        dimensions: { lengthMm: 50, widthMm: 50, thicknessMm: 40 },
        coverage: { areaM2: 2000, jointMm: 0 },
      })
    ).toContain("exceeds")
  })
})

describe("cast method and water", () => {
  it("derives water from the mix design's ratio when wet casting", () => {
    const result = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })

    // 144 kg cement at a 0.44 water/cement ratio = 63.36 litres.
    expect(result.waterCementRatio).toBe(0.44)
    expect(result.castMethod.id).toBe("wet")
    expect(lineFor(result, "water")?.requiredQuantity).toBe(63.4)
  })

  it("overrides the design ratio when dry casting, and uses much less water", () => {
    const wet = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })
    const dry = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      castMethodId: "dry",
    })

    expect(dry.waterCementRatio).toBe(0.32)
    expect(lineFor(dry, "water")?.requiredQuantity).toBe(46.1)
    expect(lineFor(dry, "water")!.requiredQuantity).toBeLessThan(
      lineFor(wet, "water")!.requiredQuantity
    )
  })

  it("leaves cement, sand and pigment untouched by the cast method", () => {
    const wet = calculate({ presetId: "square-400", slabCount: 50 })
    const dry = calculate({ presetId: "square-400", slabCount: 50, castMethodId: "dry" })

    expect(dry.pigment.totalKg).toBe(wet.pigment.totalKg)
    expect(lineFor(dry, "cement")?.requiredQuantity).toBe(lineFor(wet, "cement")?.requiredQuantity)
    expect(lineFor(dry, "sand")?.requiredQuantity).toBe(lineFor(wet, "sand")?.requiredQuantity)
  })

  it("counts the reduced water in the finished slab mass", () => {
    const wet = calculate({ presetId: "square-400", slabCount: 1 })
    const dry = calculate({ presetId: "square-400", slabCount: 1, castMethodId: "dry" })

    expect(wet.slab.massKg).toBe(13.75)
    expect(dry.slab.massKg).toBeLessThan(wet.slab.massKg)
  })

  it("explains the vibrating table requirement and the faster strip time", () => {
    const dry = calculate({ presetId: "square-400", slabCount: 1, castMethodId: "dry" })
    const wet = calculate({ presetId: "square-400", slabCount: 1 })

    expect(dry.castMethod.stripHours).toBe(1)
    expect(wet.castMethod.stripHours).toBe(24)
    expect(dry.notes.some((note) => note.includes("vibrating table"))).toBe(true)
    expect(wet.notes.some((note) => note.includes("vibrating table"))).toBe(false)
  })

  it("warns when a semi-dry mix is too deep to compact by vibration", () => {
    const deep = calculate({
      dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 100 },
      slabCount: 1,
      castMethodId: "dry",
    })
    const shallow = calculate({ presetId: "brick-paver", slabCount: 1, castMethodId: "dry" })

    expect(deep.warnings.some((warning) => warning.includes("semi-dry"))).toBe(true)
    expect(shallow.warnings).toEqual([])
  })
})

describe("mixer load planning", () => {
  it("splits the batch into full loads plus a short final load", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      mixerCapacityM3: 0.15,
    })

    // 0.32 m3 at 0.15 m3 a load = two full loads and a 0.02 m3 remainder.
    expect(result.mixerPlan?.loadCount).toBe(3)
    expect(result.mixerPlan?.fullLoadCount).toBe(2)
    expect(result.mixerPlan?.fullLoad.volumeM3).toBe(0.15)
    expect(result.mixerPlan?.finalLoad?.volumeM3).toBe(0.02)
  })

  it("gives the pigment for one load in grams, which is what gets weighed", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      mixerCapacityM3: 0.15,
    })

    // A 0.15 m3 load carries 67.5 kg cement, and 5% of that is 3 375 g of pigment.
    expect(result.mixerPlan?.fullLoad.cementKg).toBe(67.5)
    expect(result.mixerPlan?.fullLoad.pigmentGrams).toBe(3375)
  })

  it("reports no final load when the batch divides evenly", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      mixerCapacityM3: 0.16,
    })

    expect(result.mixerPlan?.loadCount).toBe(2)
    expect(result.mixerPlan?.fullLoadCount).toBe(2)
    expect(result.mixerPlan?.finalLoad).toBeNull()
  })

  it("conserves the batch across the loads", () => {
    const result = calculate({
      presetId: "brick-paver",
      slabCount: 400,
      mixerCapacityM3: 0.15,
    })
    const plan = result.mixerPlan!
    const cementAcrossLoads =
      plan.fullLoadCount * plan.fullLoad.cementKg + (plan.finalLoad?.cementKg ?? 0)

    expect(cementAcrossLoads).toBeCloseTo(lineFor(result, "cement")!.requiredQuantity, 0)
  })

  it("is null when no mixer capacity was given", () => {
    expect(calculate({ presetId: "square-400", slabCount: 10 }).mixerPlan).toBeNull()
  })
})

describe("reinforcement and admixtures", () => {
  it("doses polypropylene fiber by mixed volume and rounds up to whole bags", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      reinforcement: "fiber",
    })
    const fiber = lineFor(result, "fiber")

    expect(fiber?.requiredQuantity).toBe(round3(0.32 * FIBER_KG_PER_M3))
    expect(fiber?.purchaseQuantity).toBe(1)
    expect(fiber?.purchaseUnit).toBe("900 g bags")
  })

  it("doses mesh by slab plan area with a lap allowance and rounds up to whole sheets", () => {
    const result = calculate({
      presetId: "large-500",
      slabCount: 100,
      reinforcement: "mesh",
    })
    const mesh = lineFor(result, "mesh")

    // 100 slabs of 0.25 m2 = 25 m2, plus 10% for laps = 27.5 m2, which is two sheets.
    expect(mesh?.requiredQuantity).toBe(27.5)
    expect(mesh?.purchaseQuantity).toBe(Math.ceil(27.5 / MESH_SHEET_M2))
  })

  it("adds no reinforcement line by default", () => {
    const result = calculate({ presetId: "square-400", slabCount: 10 })

    expect(result.reinforcement).toBe("none")
    expect(lineFor(result, "fiber")).toBeUndefined()
    expect(lineFor(result, "mesh")).toBeUndefined()
  })

  it("doses admixtures per bag of cement", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      admixtures: ["plasticizer", "waterproofer"],
    })

    // Three bags of cement: 600 ml of plasticizer and 3 litres of waterproofer.
    expect(lineFor(result, "plasticizer")?.requiredQuantity).toBe(0.6)
    expect(lineFor(result, "plasticizer")?.purchaseQuantity).toBe(1)
    expect(lineFor(result, "waterproofer")?.requiredQuantity).toBe(3)
    expect(lineFor(result, "waterproofer")?.purchaseQuantity).toBe(3)
  })

  it("points a thin slab at fiber instead of just complaining", () => {
    const bare = calculate({
      dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 20 },
      slabCount: 1,
    })
    const reinforced = calculate({
      dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 20 },
      slabCount: 1,
      reinforcement: "fiber",
    })

    expect(bare.warnings.some((warning) => warning.includes("Add polypropylene fiber"))).toBe(true)
    expect(reinforced.warnings.some((warning) => warning.includes("Add polypropylene fiber"))).toBe(
      false
    )
    expect(reinforced.warnings.some((warning) => warning.includes("even with reinforcement"))).toBe(
      true
    )
  })

  it("warns that mesh will not fit in a thin slab", () => {
    const thin = calculate({ presetId: "square-400", slabCount: 1, reinforcement: "mesh" })
    const thick = calculate({ presetId: "large-500", slabCount: 1, reinforcement: "mesh" })

    expect(thin.warnings.some((warning) => warning.includes("Mesh needs cover"))).toBe(true)
    expect(thick.warnings).toEqual([])
  })
})

describe("calculateConcreteMix", () => {
  it("computes pigment per slab from cement mass, not total mix mass", () => {
    // 400 x 400 x 40 mm = 0.0064 m3 at 450 kg cement/m3 = 2.88 kg cement.
    // 5% of 2.88 kg = 144 g of pigment in one stone.
    const result = calculate({ presetId: "square-400", slabCount: 1 })

    expect(result.slab.volumeM3).toBe(0.0064)
    expect(result.pigment.dosagePercent).toBe(5)
    expect(result.pigment.gramsPerSlab).toBe(144)
  })

  it("scales pigment linearly with the dosage", () => {
    const light = calculate({ presetId: "square-400", slabCount: 1, colorIntensityId: "light" })
    const dark = calculate({ presetId: "square-400", slabCount: 1, colorIntensityId: "dark" })

    expect(light.pigment.gramsPerSlab).toBe(86.4)
    expect(dark.pigment.gramsPerSlab).toBe(230.4)
  })

  it("applies the waste allowance to the mixed volume but not to the per-slab figures", () => {
    const noWaste = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })
    const withWaste = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 10 })

    expect(noWaste.batch.mixedVolumeM3).toBe(0.32)
    expect(withWaste.batch.mixedVolumeM3).toBe(0.352)
    expect(withWaste.batch.netVolumeM3).toBe(0.32)
    expect(withWaste.pigment.gramsPerSlab).toBe(noWaste.pigment.gramsPerSlab)
    expect(withWaste.pigment.totalKg).toBeGreaterThan(noWaste.pigment.totalKg)
  })

  it("separates what the mix needs from what has to be bought", () => {
    const result = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })
    const cement = lineFor(result, "cement")

    // 0.32 m3 x 450 kg/m3 = 144 kg, which is three bags with 6 kg spare.
    expect(cement?.requiredQuantity).toBe(144)
    expect(cement?.requiredUnit).toBe("kg")
    expect(cement?.purchaseQuantity).toBe(3)
    expect(cement?.purchaseUnit).toBe(`${CEMENT_BAG_KG} kg bags`)
  })

  it("packs pigment into the largest bags that fit", () => {
    const result = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })

    // 144 kg cement x 5% = 7.2 kg, bought as 8 kg.
    expect(result.pigment.totalKg).toBe(7.2)
    expect(result.pigment.packs).toEqual([
      { label: "5 kg bag", count: 1, sizeKg: 5 },
      { label: "1 kg bag", count: 3, sizeKg: 1 },
    ])
    expect(result.pigment.purchaseKg).toBe(8)
  })

  it("rounds a sub-kilogram pigment requirement up to a single 1 kg bag", () => {
    const result = calculate({ presetId: "stepping-300", slabCount: 1 })

    expect(result.pigment.totalKg).toBeLessThan(1)
    expect(result.pigment.packs).toEqual([{ label: "1 kg bag", count: 1, sizeKg: 1 }])
    expect(result.pigment.purchaseKg).toBe(1)
  })

  it("omits the stone line for the sand-only garden stone mortar", () => {
    const mortar = calculate({ presetId: "square-400", slabCount: 10 })
    const concrete = calculate({ presetId: "brick-paver", slabCount: 10 })

    expect(lineFor(mortar, "stone")).toBeUndefined()
    expect(mortar.mixDesign.stoneSizeMm).toBeNull()
    expect(lineFor(concrete, "stone")!.purchaseQuantity).toBeGreaterThan(0)
    expect(concrete.mixDesign.stoneSizeMm).toBe(13)
  })

  it("converts aggregate mass to the cubic metres it is sold in", () => {
    const result = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })
    const sand = lineFor(result, "sand")

    // 0.32 m3 x 1500 kg/m3 = 480 kg, at a 1600 kg/m3 bulk density = 0.3 m3.
    expect(sand?.requiredQuantity).toBe(480)
    expect(sand?.purchaseQuantity).toBe(0.3)
    expect(sand?.purchaseUnit).toBe("m3")
  })

  it("names white cement in the materials list when it is selected", () => {
    const grey = calculate({ presetId: "square-400", slabCount: 1 })
    const white = calculate({ presetId: "square-400", slabCount: 1, cementType: "white" })

    expect(lineFor(grey, "cement")?.label).toBe("Grey cement")
    expect(lineFor(white, "cement")?.label).toBe("White cement")
  })

  it("is pure: the same input yields a deep-equal result", () => {
    const body = { presetId: "large-500", slabCount: 37, colorIntensityId: "dark" }

    expect(calculate(body)).toEqual(calculate(body))
  })

  it("scales every material linearly with the slab count", () => {
    const one = calculate({ presetId: "square-400", slabCount: 10, wastePercent: 0 })
    const ten = calculate({ presetId: "square-400", slabCount: 100, wastePercent: 0 })

    // Compare ratios, not scaled absolutes: each line is rounded for display, so
    // round(x) * 10 drifts from round(10x) by up to half a display unit.
    for (const line of one.materials) {
      const scaled = ten.materials.find((other) => other.material === line.material)!
      expect(scaled.requiredQuantity / line.requiredQuantity).toBeCloseTo(10, 1)
    }
  })
})

describe("calculateConcreteMix costing", () => {
  it("costs cement by the bag and pigment by the kilograms actually bought", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      costs: { cement: 12000, pigment: 8995 },
    })

    // 3 bags x R120.00, plus 8 kg of pigment x R89.95.
    expect(lineFor(result, "cement")?.estimatedCostCents).toBe(36000)
    expect(lineFor(result, "pigment")?.estimatedCostCents).toBe(71960)
    expect(result.estimatedCostCents).toBe(107960)
  })

  it("costs reinforcement and admixtures off the same map", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      reinforcement: "fiber",
      admixtures: ["waterproofer"],
      costs: { fiber: 25000, waterproofer: 9500 },
    })

    expect(lineFor(result, "fiber")?.estimatedCostCents).toBe(25000)
    expect(lineFor(result, "waterproofer")?.estimatedCostCents).toBe(28500)
  })

  it("reports which purchased materials were left without a price", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 10,
      costs: { cement: 12000 },
    })

    expect(result.unpricedMaterials).toEqual(["sand", "pigment"])
  })

  it("returns a null total when no costs were supplied", () => {
    const result = calculate({ presetId: "square-400", slabCount: 10 })

    expect(result.estimatedCostCents).toBeNull()
    expect(lineFor(result, "cement")?.estimatedCostCents).toBeUndefined()
  })
})

describe("calculateConcreteMix warnings and notes", () => {
  it("warns when the dosage passes the saturation point", () => {
    const saturated = calculate({
      presetId: "square-400",
      slabCount: 1,
      pigmentDosagePercent: 12,
    })
    const normal = calculate({ presetId: "square-400", slabCount: 1 })

    expect(saturated.warnings.some((warning) => warning.includes("stops deepening"))).toBe(true)
    expect(normal.warnings).toEqual([])
  })

  it("warns when the stone is too coarse for the slab section", () => {
    const thin = calculate({
      dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 30 },
      slabCount: 1,
      mixDesignId: "paver-25",
    })
    const thick = calculate({ presetId: "brick-paver", slabCount: 1 })

    expect(thin.warnings.some((warning) => warning.includes("too coarse"))).toBe(true)
    expect(thick.warnings).toEqual([])
  })

  it("warns about shade drift once the batch outgrows a single mix", () => {
    const big = calculate({ presetId: "square-400", slabCount: 200, wastePercent: 0 })
    const small = calculate({ presetId: "square-400", slabCount: 20, wastePercent: 0 })

    // 200 slabs need 576 kg of cement, which cannot be mixed in one go.
    expect(big.warnings.some((warning) => warning.includes("different shades"))).toBe(true)
    expect(small.warnings).toEqual([])
  })

  it("suggests white cement only for pale colors cast in grey", () => {
    const mentionsWhiteCement = (notes: string[]) =>
      notes.some((note) => note.includes("white cement"))

    expect(
      mentionsWhiteCement(
        calculate({ presetId: "square-400", slabCount: 1, colorIntensityId: "light" }).notes
      )
    ).toBe(true)
    expect(
      mentionsWhiteCement(
        calculate({
          presetId: "square-400",
          slabCount: 1,
          colorIntensityId: "light",
          cementType: "white",
        }).notes
      )
    ).toBe(false)
    expect(
      mentionsWhiteCement(
        calculate({ presetId: "square-400", slabCount: 1, colorIntensityId: "dark" }).notes
      )
    ).toBe(false)
  })

  it("explains the plasticizer trade-off only when one is used", () => {
    const withAdmixture = calculate({
      presetId: "square-400",
      slabCount: 1,
      admixtures: ["plasticizer"],
    })
    const without = calculate({ presetId: "square-400", slabCount: 1 })

    expect(withAdmixture.notes.some((note) => note.includes("same workability"))).toBe(true)
    expect(without.notes.some((note) => note.includes("same workability"))).toBe(false)
  })

  it("always returns the curing and dosing guidance", () => {
    const result = calculate({ presetId: "square-400", slabCount: 1 })

    expect(result.notes.some((note) => note.includes("Weigh the pigment"))).toBe(true)
    expect(result.notes.some((note) => note.includes("7 days"))).toBe(true)
  })
})

describe("getConcreteMixOptions", () => {
  it("exposes every preset, mix design, cast method and intensity with the defaults", () => {
    const options = getConcreteMixOptions()

    expect(options.slabPresets.map((preset) => preset.id)).toEqual([
      "stepping-300",
      "square-400",
      "large-500",
      "brick-paver",
    ])
    expect(options.mixDesigns.map((design) => design.id)).toEqual([
      "garden-stone",
      "paver-25",
      "paver-30",
    ])
    expect(options.castMethods.map((method) => method.id)).toEqual(["wet", "dry"])
    expect(options.colorIntensities.map((intensity) => intensity.dosagePercent)).toEqual([
      3, 5, 8, 10,
    ])
    expect(options.reinforcements).toEqual(["none", "fiber", "mesh"])
    expect(options.admixtures).toEqual(["plasticizer", "waterproofer"])
    expect(options.defaults.mixDesignId).toBe("garden-stone")
    expect(options.defaults.castMethodId).toBe("wet")
    expect(options.limits.maxPigmentPercent).toBe(MAX_PIGMENT_PERCENT)
  })
})

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
