import { describe, expect, it } from "vitest"
import { STRICT_GATE_PROFILE, withGateDisabled, withGateEnabled } from "@/lib/knowledge/gates"
import {
  assertPublishable,
  builtinProfileForEntry,
  checkPublishable,
  profileIdForEntry,
} from "@/lib/knowledge/publication"
import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import { knowledgeEntrySchema, type KnowledgeEntry } from "@/lib/knowledge/types"

const copper = KNOWLEDGE_SEED[0]

const withKind = (entry: KnowledgeEntry, kind: KnowledgeEntry["guidance"]["kind"]) => ({
  ...entry,
  guidance: { ...entry.guidance, kind },
})

describe("profile selection", () => {
  it("keys on what the content does, not where it lives", () => {
    expect(profileIdForEntry(withKind(copper, "recipe"))).toBe("household-recipe")
    expect(profileIdForEntry(withKind(copper, "checklist"))).toBe("checklist")
    expect(profileIdForEntry(withKind(copper, "procedure"))).toBe("strict")
    expect(profileIdForEntry(withKind(copper, "troubleshooting"))).toBe("strict")
    expect(profileIdForEntry(withKind(copper, "safety"))).toBe("strict")
  })

  it("returns the profile object, not just an id", () => {
    expect(builtinProfileForEntry(copper)).toEqual(STRICT_GATE_PROFILE)
  })
})

describe("published seed entries", () => {
  it("every published entry clears its own gates", () => {
    for (const entry of KNOWLEDGE_SEED.filter((e) => e.status === "published")) {
      const check = checkPublishable(entry)
      expect(check.reasons).toEqual([])
      expect(check.publishable).toBe(true)
    }
  })

  it("every published entry carries a review naming a real profile", () => {
    for (const entry of KNOWLEDGE_SEED.filter((e) => e.status === "published")) {
      expect(entry.review).toBeDefined()
      expect(entry.review!.profileId).toBe(profileIdForEntry(entry))
      expect(entry.review!.reviewedBy).toMatch(/^[A-Za-z][A-Za-z0-9._-]*$/)
    }
  })
})

describe("the schema will not let an entry claim published without a review", () => {
  it("rejects published-without-review", () => {
    const { review: _review, ...withoutReview } = copper
    const parsed = knowledgeEntrySchema.safeParse(withoutReview)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("review"))).toBe(true)
    }
  })

  it("allows a draft entry with no review", () => {
    const { review: _review, ...withoutReview } = copper
    expect(knowledgeEntrySchema.safeParse({ ...withoutReview, status: "draft" }).success).toBe(true)
  })

  it("rejects a reviewer reference that looks like contact data", () => {
    const bad = { ...copper, review: { ...copper.review!, reviewedBy: "hans@example.test" } }
    expect(knowledgeEntrySchema.safeParse(bad).success).toBe(false)
  })

  it("rejects an unknown gate id in the recorded results", () => {
    const bad = {
      ...copper,
      review: { ...copper.review!, gateResults: { not_a_gate: "pass" } },
    }
    expect(knowledgeEntrySchema.safeParse(bad).success).toBe(false)
  })
})

describe("checkPublishable", () => {
  it("blocks an entry with no recorded review", () => {
    const { review: _review, ...withoutReview } = copper
    const check = checkPublishable(withoutReview as KnowledgeEntry)
    expect(check.publishable).toBe(false)
    expect(check.gates).toBeNull()
    expect(check.reasons).toEqual(["no recorded gate review"])
  })

  it("blocks an entry whose recorded review fails a gate", () => {
    const failing = {
      ...copper,
      review: {
        ...copper.review!,
        gateResults: { ...copper.review!.gateResults, irreversible_harm: "fail" as const },
      },
    }
    const check = checkPublishable(failing)
    expect(check.publishable).toBe(false)
    expect(check.gates!.outcome).toBe("rescope_as_safety")
    expect(check.reasons[0]).toContain("irreversible_harm")
  })

  it("blocks an entry with an untested gate", () => {
    const untested = {
      ...copper,
      review: {
        ...copper.review!,
        gateResults: { ...copper.review!.gateResults, data_boundary: "not_tested" as const },
      },
    }
    const check = checkPublishable(untested)
    expect(check.publishable).toBe(false)
    expect(check.gates!.outcome).toBe("hold_as_draft")
  })

  it("blocks an entry that declares no safety boundaries", () => {
    const unsafe = { ...copper, guidance: { ...copper.guidance, safety: [] } }
    const check = checkPublishable(unsafe)
    expect(check.publishable).toBe(false)
    expect(check.hasSafetyBoundaries).toBe(false)
    expect(check.reasons).toContain("guidance declares no safety boundaries")
  })

  it("re-checks against a stricter administrator profile, not the shipped one", () => {
    // The recipe built-in waives statutory_competence. An admin re-enabling it
    // must immediately block an entry whose review never tested that gate.
    const recipeEntry = {
      ...withKind(copper, "recipe"),
      review: {
        ...copper.review!,
        profileId: "household-recipe",
        gateResults: {
          irreversible_harm: "pass" as const,
          verifiable_ground_truth: "pass" as const,
          commercial_neutrality: "pass" as const,
          data_boundary: "pass" as const,
        },
      },
    }

    const asShipped = checkPublishable(recipeEntry, builtinProfileForEntry(recipeEntry))
    expect(asShipped.publishable).toBe(true)

    const tightened = withGateEnabled(builtinProfileForEntry(recipeEntry), "statutory_competence")
    const afterTightening = checkPublishable(recipeEntry, tightened, "stored")
    expect(afterTightening.publishable).toBe(false)
    expect(afterTightening.gates!.untestedGates).toContain("statutory_competence")
    expect(afterTightening.gates!.profileSource).toBe("stored")
  })

  it("lets a relaxed administrator profile skip a gate, and records the skip", () => {
    const missingOne = {
      ...copper,
      review: {
        ...copper.review!,
        gateResults: {
          ...copper.review!.gateResults,
          commercial_neutrality: "not_tested" as const,
        },
      },
    }
    expect(checkPublishable(missingOne).publishable).toBe(false)

    const relaxed = withGateDisabled(STRICT_GATE_PROFILE, "commercial_neutrality")
    const check = checkPublishable(missingOne, relaxed, "stored")
    expect(check.publishable).toBe(true)
    expect(check.gates!.skippedGates).toContain("commercial_neutrality")
  })
})

describe("assertPublishable", () => {
  it("throws for a published entry that does not clear", () => {
    const broken = {
      ...copper,
      review: { ...copper.review!, gateResults: { data_boundary: "fail" as const } },
    }
    expect(() => assertPublishable(broken)).toThrow(/does not clear its gates/)
    expect(() => assertPublishable(broken)).toThrow(copper.slug)
  })

  it("ignores a draft entry — gates govern publication, not authoring", () => {
    const { review: _review, ...withoutReview } = copper
    expect(() =>
      assertPublishable({ ...withoutReview, status: "draft" } as KnowledgeEntry)
    ).not.toThrow()
  })

  it("passes for the shipped seed", () => {
    for (const entry of KNOWLEDGE_SEED) {
      expect(() => assertPublishable(entry)).not.toThrow()
    }
  })
})
