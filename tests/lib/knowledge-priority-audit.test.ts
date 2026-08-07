import { describe, expect, it } from "vitest"
import { assertPublishable, auditRecordedPriority } from "@/lib/knowledge/publication"
import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import { knowledgeEntrySchema, type KnowledgeEntry } from "@/lib/knowledge/types"

const copper = KNOWLEDGE_SEED[0]

describe("recorded Tier-1 priority", () => {
  it("is present on the shipped seed and matches the spec's worked example", () => {
    expect(copper.review?.tier1).toBeDefined()
    expect(copper.review!.tier1!.composite).toBe(8)
    expect(copper.review!.tier1!.priority).toBe("P0")
  })

  it("still follows from the recorded facts under the current rubric", () => {
    for (const entry of KNOWLEDGE_SEED) {
      const audit = auditRecordedPriority(entry)
      if (!audit) continue
      expect(audit.drifted).toBe(false)
      expect(audit.currentPriority).toBe(audit.recordedPriority)
    }
  })

  it("returns null when a review records no Tier-1 block", () => {
    const { tier1: _tier1, ...withoutTier1 } = copper.review!
    expect(auditRecordedPriority({ ...copper, review: withoutTier1 })).toBeNull()
  })
})

describe("drift detection", () => {
  /** Same facts, a priority nobody could derive from them. */
  const fabricated: KnowledgeEntry = {
    ...copper,
    review: {
      ...copper.review!,
      tier1: { ...copper.review!.tier1!, composite: 4, priority: "P2" },
    },
  }

  it("flags a recorded score that does not follow from the recorded facts", () => {
    const audit = auditRecordedPriority(fabricated)!
    expect(audit.drifted).toBe(true)
    expect(audit.recordedPriority).toBe("P2")
    expect(audit.currentPriority).toBe("P0")
    expect(audit.currentComposite).toBeCloseTo(8, 5)
  })

  it("fails the entry at import rather than trusting either number", () => {
    expect(() => assertPublishable(fabricated)).toThrow(/records priority P2/)
    expect(() => assertPublishable(fabricated)).toThrow(/Re-review the entry/)
  })

  it("tolerates float noise but not a real difference", () => {
    const noise: KnowledgeEntry = {
      ...copper,
      review: {
        ...copper.review!,
        tier1: { ...copper.review!.tier1!, composite: 8.0001 },
      },
    }
    expect(auditRecordedPriority(noise)!.drifted).toBe(false)

    const real: KnowledgeEntry = {
      ...copper,
      review: { ...copper.review!, tier1: { ...copper.review!.tier1!, composite: 8.5 } },
    }
    expect(auditRecordedPriority(real)!.drifted).toBe(true)
  })

  it("ignores a drifted draft — Tier 1 explains priority, it does not gate", () => {
    expect(() => assertPublishable({ ...fabricated, status: "draft" })).not.toThrow()
  })
})

describe("schema", () => {
  it("accepts an entry with no Tier-1 block", () => {
    const { tier1: _tier1, ...withoutTier1 } = copper.review!
    expect(knowledgeEntrySchema.safeParse({ ...copper, review: withoutTier1 }).success).toBe(true)
  })

  it("rejects a composite outside the 0-10 scale", () => {
    const bad = {
      ...copper,
      review: { ...copper.review!, tier1: { ...copper.review!.tier1!, composite: 11 } },
    }
    expect(knowledgeEntrySchema.safeParse(bad).success).toBe(false)
  })

  it("rejects an unknown priority band", () => {
    const bad = {
      ...copper,
      review: { ...copper.review!, tier1: { ...copper.review!.tier1!, priority: "P9" } },
    }
    expect(knowledgeEntrySchema.safeParse(bad).success).toBe(false)
  })

  it("rejects incomplete facts — Tier 1 has no neutral fallback", () => {
    const { recurrencePerYear: _r, ...partialFacts } = copper.review!.tier1!.facts
    const bad = {
      ...copper,
      review: { ...copper.review!, tier1: { ...copper.review!.tier1!, facts: partialFacts } },
    }
    expect(knowledgeEntrySchema.safeParse(bad).success).toBe(false)
  })
})
