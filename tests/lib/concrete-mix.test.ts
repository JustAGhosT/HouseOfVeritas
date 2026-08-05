import { describe, it, expect } from "vitest"
import {
  CEMENT_BAG_KG,
  MAX_PIGMENT_PERCENT,
  MAX_SLAB_COUNT,
  calculateConcreteMix,
  getConcreteMixOptions,
  validateConcreteMixInput,
  type ConcreteMixInput,
} from "@/lib/concrete-mix"

/** Validates a body and fails the test loudly if it was rejected. */
function validated(body: unknown): ConcreteMixInput {
  const result = validateConcreteMixInput(body)
  if (!result.ok) throw new Error(`Expected valid input, got: ${result.error}`)
  return result.value
}

function calculate(body: unknown) {
  return calculateConcreteMix(validated(body))
}

function lineFor(materials: ReturnType<typeof calculate>["materials"], material: string) {
  return materials.find((line) => line.material === material)
}

describe("validateConcreteMixInput", () => {
  it("accepts a preset and inherits its dimensions and mix design", () => {
    const input = validated({ presetId: "brick-paver", slabCount: 10 })

    expect(input.dimensions).toEqual({ lengthMm: 220, widthMm: 110, thicknessMm: 50 })
    expect(input.mixDesignId).toBe("paver-25")
    expect(input.presetId).toBe("brick-paver")
  })

  it("defaults to a medium color at 5% of cement mass with 10% waste", () => {
    const input = validated({ presetId: "square-400", slabCount: 1 })

    expect(input.colorIntensityId).toBe("medium")
    expect(input.pigmentDosagePercent).toBe(5)
    expect(input.wastePercent).toBe(10)
    expect(input.cementType).toBe("grey")
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
    const result = validateConcreteMixInput({ slabCount: 5 })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("presetId or dimensions")
  })

  it("rejects unknown preset, mix design and intensity ids", () => {
    expect(validateConcreteMixInput({ presetId: "hexagon", slabCount: 1 }).ok).toBe(false)
    expect(
      validateConcreteMixInput({ presetId: "square-400", slabCount: 1, mixDesignId: "screed" }).ok
    ).toBe(false)
    expect(
      validateConcreteMixInput({
        presetId: "square-400",
        slabCount: 1,
        colorIntensityId: "neon",
      }).ok
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
    const tooThin = validateConcreteMixInput({
      dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 5 },
      slabCount: 1,
    })
    expect(tooThin.ok).toBe(false)
    expect(tooThin.ok === false && tooThin.error).toContain("thicknessMm")

    const tooWide = validateConcreteMixInput({
      dimensions: { lengthMm: 5000, widthMm: 400, thicknessMm: 40 },
      slabCount: 1,
    })
    expect(tooWide.ok).toBe(false)

    const notANumber = validateConcreteMixInput({
      dimensions: { lengthMm: "400", widthMm: 400, thicknessMm: 40 },
      slabCount: 1,
    })
    expect(notANumber.ok).toBe(false)
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
      validateConcreteMixInput({
        presetId: "square-400",
        slabCount: 1,
        pigmentDosagePercent: -1,
      }).ok
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

  it("drops malformed cost entries and keeps the valid ones", () => {
    const input = validated({
      presetId: "square-400",
      slabCount: 1,
      costs: { cementPerBagCents: 12000, pigmentPerKgCents: -5, sandPerM3Cents: "cheap" },
    })

    expect(input.costs).toEqual({ cementPerBagCents: 12000 })
  })

  it("treats a costs object with nothing usable as no costs at all", () => {
    const input = validated({
      presetId: "square-400",
      slabCount: 1,
      costs: { cementPerBagCents: Number.NaN },
    })

    expect(input.costs).toBeNull()
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

  it("rounds cement up to whole 50 kg bags", () => {
    const result = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })
    const cement = lineFor(result.materials, "cement")

    // 0.32 m3 x 450 kg/m3 = 144 kg, which is three bags with 6 kg spare.
    expect(cement?.massKg).toBe(144)
    expect(cement?.quantity).toBe(3)
    expect(cement?.unit).toBe(`${CEMENT_BAG_KG} kg bags`)
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

    expect(lineFor(mortar.materials, "stone")).toBeUndefined()
    expect(mortar.mixDesign.stoneSizeMm).toBeNull()
    expect(lineFor(concrete.materials, "stone")?.quantity).toBeGreaterThan(0)
    expect(concrete.mixDesign.stoneSizeMm).toBe(13)
  })

  it("converts aggregate mass to the cubic metres it is sold in", () => {
    const result = calculate({ presetId: "square-400", slabCount: 50, wastePercent: 0 })
    const sand = lineFor(result.materials, "sand")

    // 0.32 m3 x 1500 kg/m3 = 480 kg, at a 1600 kg/m3 bulk density = 0.3 m3.
    expect(sand?.massKg).toBe(480)
    expect(sand?.quantity).toBe(0.3)
    expect(sand?.unit).toBe("m3")
  })

  it("names white cement in the materials list when it is selected", () => {
    const grey = calculate({ presetId: "square-400", slabCount: 1 })
    const white = calculate({ presetId: "square-400", slabCount: 1, cementType: "white" })

    expect(lineFor(grey.materials, "cement")?.label).toBe("Grey cement")
    expect(lineFor(white.materials, "cement")?.label).toBe("White cement")
  })

  it("is pure: the same input yields a deep-equal result", () => {
    const body = { presetId: "large-500", slabCount: 37, colorIntensityId: "dark" }

    expect(calculate(body)).toEqual(calculate(body))
  })
})

describe("calculateConcreteMix costing", () => {
  it("costs cement by the bag and pigment by the kilograms actually bought", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 50,
      wastePercent: 0,
      costs: { cementPerBagCents: 12000, pigmentPerKgCents: 8995 },
    })

    // 3 bags x R120.00, plus 8 kg of pigment x R89.95.
    expect(lineFor(result.materials, "cement")?.estimatedCostCents).toBe(36000)
    expect(lineFor(result.materials, "pigment")?.estimatedCostCents).toBe(71960)
    expect(result.estimatedCostCents).toBe(107960)
  })

  it("reports which purchased materials were left without a price", () => {
    const result = calculate({
      presetId: "square-400",
      slabCount: 10,
      costs: { cementPerBagCents: 12000 },
    })

    expect(result.unpricedMaterials).toEqual(["sand", "pigment"])
  })

  it("returns a null total when no costs were supplied", () => {
    const result = calculate({ presetId: "square-400", slabCount: 10 })

    expect(result.estimatedCostCents).toBeNull()
    expect(lineFor(result.materials, "cement")?.estimatedCostCents).toBeUndefined()
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

  it("warns when a slab is too thin to survive being stripped from the form", () => {
    const result = calculate({
      dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 20 },
      slabCount: 1,
    })

    expect(result.warnings.some((warning) => warning.includes("crack"))).toBe(true)
  })

  it("warns about shade drift once the batch outgrows a single mix", () => {
    const big = calculate({ presetId: "square-400", slabCount: 200, wastePercent: 0 })
    const small = calculate({ presetId: "square-400", slabCount: 20, wastePercent: 0 })

    // 200 slabs need 576 kg of cement, which cannot be mixed in one go.
    expect(big.warnings.some((warning) => warning.includes("different shades"))).toBe(true)
    expect(small.warnings).toEqual([])
  })

  it("suggests white cement only for pale colors cast in grey", () => {
    const paleGrey = calculate({
      presetId: "square-400",
      slabCount: 1,
      colorIntensityId: "light",
    })
    const paleWhite = calculate({
      presetId: "square-400",
      slabCount: 1,
      colorIntensityId: "light",
      cementType: "white",
    })
    const darkGrey = calculate({
      presetId: "square-400",
      slabCount: 1,
      colorIntensityId: "dark",
    })

    const mentionsWhiteCement = (notes: string[]) =>
      notes.some((note) => note.includes("white cement"))

    expect(mentionsWhiteCement(paleGrey.notes)).toBe(true)
    expect(mentionsWhiteCement(paleWhite.notes)).toBe(false)
    expect(mentionsWhiteCement(darkGrey.notes)).toBe(false)
  })

  it("always returns the curing and dosing guidance", () => {
    const result = calculate({ presetId: "square-400", slabCount: 1 })

    expect(result.notes.some((note) => note.includes("Weigh the pigment"))).toBe(true)
    expect(result.notes.some((note) => note.includes("7 days"))).toBe(true)
  })
})

describe("getConcreteMixOptions", () => {
  it("exposes every preset, mix design and intensity with the defaults", () => {
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
    expect(options.colorIntensities.map((intensity) => intensity.dosagePercent)).toEqual([
      3, 5, 8, 10,
    ])
    expect(options.defaults.mixDesignId).toBe("garden-stone")
    expect(options.limits.maxPigmentPercent).toBe(MAX_PIGMENT_PERCENT)
  })
})
