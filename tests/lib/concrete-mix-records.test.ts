import { describe, it, expect } from "vitest"
import {
  applyRecordToBatchBody,
  canAcceptAnotherSample,
  isAllowedSamplePhotoUrl,
  validateConcreteMixRecordDraft,
  validateConcreteMixSampleDraft,
  MAX_SAMPLES_PER_RECORD,
  type ConcreteMixRecord,
} from "@/lib/concrete-mix-records"
import { calculateConcreteMix, validateConcreteMixInput } from "@/lib/concrete-mix"

const VALID_DRAFT = {
  name: "Our terracotta",
  mixDesignId: "garden-stone",
  castMethodId: "wet",
  pigmentDosagePercent: 6,
  cementType: "white",
  reinforcement: "fiber",
  admixtures: ["plasticizer"],
  pigmentProduct: "Powafix Cement Colour - Terracotta",
}

function record(overrides: Partial<ConcreteMixRecord> = {}): ConcreteMixRecord {
  return {
    id: "mix_1",
    name: "Our terracotta",
    mixDesignId: "garden-stone",
    castMethodId: "wet",
    pigmentDosagePercent: 6,
    colorIntensityId: null,
    cementType: "white",
    reinforcement: "fiber",
    admixtures: ["plasticizer"],
    samples: [],
    createdBy: "lucky",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function draftError(body: unknown): string {
  const result = validateConcreteMixRecordDraft(body)
  if (result.ok) throw new Error("Expected the draft to be rejected")
  return result.error
}

describe("validateConcreteMixRecordDraft", () => {
  it("accepts a fully specified mix", () => {
    const result = validateConcreteMixRecordDraft(VALID_DRAFT)

    expect(result.ok).toBe(true)
    expect(result.ok && result.value).toMatchObject({
      name: "Our terracotta",
      pigmentDosagePercent: 6,
      cementType: "white",
      reinforcement: "fiber",
      admixtures: ["plasticizer"],
      colorIntensityId: null,
    })
  })

  it("resolves a named intensity into an exact dosage", () => {
    const result = validateConcreteMixRecordDraft({
      ...VALID_DRAFT,
      pigmentDosagePercent: undefined,
      colorIntensityId: "dark",
    })

    expect(result.ok && result.value.pigmentDosagePercent).toBe(8)
    expect(result.ok && result.value.colorIntensityId).toBe("dark")
  })

  it("requires a name and a dosage it can pin down", () => {
    expect(draftError({ ...VALID_DRAFT, name: "   " })).toBe("name is required")
    expect(
      draftError({ ...VALID_DRAFT, pigmentDosagePercent: undefined, colorIntensityId: undefined })
    ).toContain("pigmentDosagePercent")
  })

  it("refuses to fall back to a default mix design or cast method", () => {
    // A saved mix that silently defaults would stop reproducing its own stones.
    expect(draftError({ ...VALID_DRAFT, mixDesignId: undefined })).toContain("mixDesignId")
    expect(draftError({ ...VALID_DRAFT, castMethodId: undefined })).toContain("castMethodId")
    expect(draftError({ ...VALID_DRAFT, mixDesignId: "screed" })).toContain("mixDesignId")
  })

  it("rejects an out-of-range dosage and unknown options", () => {
    expect(draftError({ ...VALID_DRAFT, pigmentDosagePercent: 20 })).toContain("15")
    expect(draftError({ ...VALID_DRAFT, pigmentDosagePercent: -1 })).toContain("0 or more")
    expect(draftError({ ...VALID_DRAFT, cementType: "beige" })).toContain("cementType")
    expect(draftError({ ...VALID_DRAFT, reinforcement: "bar" })).toContain("reinforcement")
    expect(draftError({ ...VALID_DRAFT, admixtures: ["retarder"] })).toContain("admixture")
  })

  it("trims text and drops empty optional fields", () => {
    const result = validateConcreteMixRecordDraft({
      ...VALID_DRAFT,
      name: "  Charcoal path  ",
      description: "   ",
    })

    expect(result.ok && result.value.name).toBe("Charcoal path")
    expect(result.ok && result.value.description).toBeUndefined()
  })

  it("rejects text that would overflow the stored field", () => {
    expect(draftError({ ...VALID_DRAFT, name: "x".repeat(81) })).toContain("80 characters")
  })

  it("defaults reinforcement, admixtures and cement type when they are left out", () => {
    const result = validateConcreteMixRecordDraft({
      name: "Plain grey",
      mixDesignId: "paver-25",
      castMethodId: "dry",
      pigmentDosagePercent: 0,
    })

    expect(result.ok && result.value).toMatchObject({
      cementType: "grey",
      reinforcement: "none",
      admixtures: [],
    })
  })
})

describe("cast samples", () => {
  it("accepts uploaded file references and https urls only", () => {
    expect(isAllowedSamplePhotoUrl("/api/uploads/abc123")).toBe(true)
    expect(isAllowedSamplePhotoUrl("/api/files/serve?id=abc")).toBe(true)
    expect(isAllowedSamplePhotoUrl("https://cdn.example.com/stone.jpg")).toBe(true)
    expect(isAllowedSamplePhotoUrl("http://cdn.example.com/stone.jpg")).toBe(false)
    expect(isAllowedSamplePhotoUrl("javascript:alert(1)")).toBe(false)
    expect(isAllowedSamplePhotoUrl("/etc/passwd")).toBe(false)
    expect(isAllowedSamplePhotoUrl(42)).toBe(false)
  })

  it("validates a sample with its shade and cure age", () => {
    const result = validateConcreteMixSampleDraft({
      photoUrl: "/api/uploads/stone-1",
      observedShade: "Deep rust, slightly mottled",
      cureAgeDays: 28,
      note: "Cast in overcast weather",
    })

    expect(result.ok && result.value).toEqual({
      photoUrl: "/api/uploads/stone-1",
      observedShade: "Deep rust, slightly mottled",
      cureAgeDays: 28,
      note: "Cast in overcast weather",
    })
  })

  it("rejects a photo url it will not serve", () => {
    const result = validateConcreteMixSampleDraft({ photoUrl: "http://example.com/x.jpg" })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("photoUrl")
  })

  it("rejects a nonsensical cure age", () => {
    expect(validateConcreteMixSampleDraft({ photoUrl: "/api/uploads/a", cureAgeDays: -1 }).ok).toBe(
      false
    )
    expect(
      validateConcreteMixSampleDraft({ photoUrl: "/api/uploads/a", cureAgeDays: 2.5 }).ok
    ).toBe(false)
    expect(
      validateConcreteMixSampleDraft({ photoUrl: "/api/uploads/a", cureAgeDays: 400 }).ok
    ).toBe(false)
    expect(validateConcreteMixSampleDraft({ photoUrl: "/api/uploads/a", cureAgeDays: 0 }).ok).toBe(
      true
    )
  })

  it("stops accepting samples once the record is full", () => {
    const empty = record()
    const full = record({
      samples: Array.from({ length: MAX_SAMPLES_PER_RECORD }, (_entry, index) => ({
        id: `sample_${index}`,
        photoUrl: `/api/uploads/${index}`,
        capturedBy: "lucky",
        capturedAt: "2026-01-01T00:00:00.000Z",
      })),
    })

    expect(canAcceptAnotherSample(empty)).toBe(true)
    expect(canAcceptAnotherSample(full)).toBe(false)
  })
})

describe("applyRecordToBatchBody", () => {
  function batchFrom(body: Record<string, unknown>) {
    const validation = validateConcreteMixInput(body)
    if (!validation.ok) throw new Error(validation.error)
    return calculateConcreteMix(validation.value)
  }

  it("drives a batch from the saved settings", () => {
    const merged = applyRecordToBatchBody(record(), {
      presetId: "square-400",
      slabCount: 10,
    })
    const result = batchFrom(merged)

    expect(result.pigment.dosagePercent).toBe(6)
    expect(result.castMethod.id).toBe("wet")
    expect(result.reinforcement).toBe("fiber")
    expect(result.admixtures).toEqual(["plasticizer"])
    expect(result.materials.find((line) => line.material === "cement")?.label).toBe("White cement")
  })

  it("lets the request override a setting for one batch", () => {
    const merged = applyRecordToBatchBody(record(), {
      presetId: "square-400",
      slabCount: 10,
      castMethodId: "dry",
      pigmentDosagePercent: 9,
    })
    const result = batchFrom(merged)

    expect(result.castMethod.id).toBe("dry")
    expect(result.pigment.dosagePercent).toBe(9)
    // Untouched settings still come from the record.
    expect(result.reinforcement).toBe("fiber")
  })

  it("does not let a stray intensity override the record's exact dosage", () => {
    const merged = applyRecordToBatchBody(record(), {
      presetId: "square-400",
      slabCount: 10,
      colorIntensityId: "light",
    })

    expect(merged.colorIntensityId).toBeUndefined()
    expect(batchFrom(merged).pigment.dosagePercent).toBe(6)
  })

  it("keeps an intensity when the request also gives an explicit dosage", () => {
    const merged = applyRecordToBatchBody(record(), {
      presetId: "square-400",
      slabCount: 10,
      colorIntensityId: "light",
      pigmentDosagePercent: 4,
    })

    expect(batchFrom(merged).pigment.dosagePercent).toBe(4)
  })

  it("leaves slab size and count to the request", () => {
    const merged = applyRecordToBatchBody(record(), {
      presetId: "large-500",
      coverage: { areaM2: 10 },
    })
    const result = batchFrom(merged)

    expect(result.slab.dimensions.lengthMm).toBe(500)
    expect(result.coverage?.requestedAreaM2).toBe(10)
  })
})
