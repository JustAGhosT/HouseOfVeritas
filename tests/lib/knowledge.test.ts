import { describe, it, expect } from "vitest"
import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import { knowledgeEntrySchema, parseKnowledgeEntry } from "@/lib/knowledge/types"
import { findKnowledge, getKnowledgeBySlug, rankKnowledge } from "@/lib/knowledge/retrieval"
import { buildMaintenanceTaskDraft } from "@/lib/knowledge/task-draft"
import { hasGuidanceSafetyBoundaries } from "@/lib/guidance"

describe("knowledge seed", () => {
  it("every seed entry passes the schema", () => {
    for (const entry of KNOWLEDGE_SEED) {
      expect(knowledgeEntrySchema.safeParse(entry).success).toBe(true)
    }
  })

  it("has unique slugs", () => {
    const slugs = KNOWLEDGE_SEED.map((entry) => entry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("safety-bearing maintenance entries declare safety boundaries", () => {
    const copper = getKnowledgeBySlug("copper-pipe-condensation-wall-damp")
    expect(copper).not.toBeNull()
    expect(hasGuidanceSafetyBoundaries(copper!.guidance)).toBe(true)
  })

  it("rejects a malformed entry and parseKnowledgeEntry returns null", () => {
    const invalid = { ...KNOWLEDGE_SEED[0], slug: "Not Kebab Case" }
    expect(knowledgeEntrySchema.safeParse(invalid).success).toBe(false)
    expect(parseKnowledgeEntry(invalid)).toBeNull()
    expect(parseKnowledgeEntry({ slug: "x" })).toBeNull()
  })
})

describe("knowledge retrieval", () => {
  it("matches a colloquial symptom description to the copper pipe entry", () => {
    const matches = findKnowledge({
      text: "copper pipes in wall, could they cause condensation and wall damp",
    })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].entry.slug).toBe("copper-pipe-condensation-wall-damp")
    expect(matches[0].matchedTerms).toContain("copper")
  })

  it("matches on a verbatim symptom phrase even without keywords", () => {
    const matches = findKnowledge({ text: "there is blistering paint in the corner" })
    expect(matches.map((m) => m.entry.slug)).toContain("copper-pipe-condensation-wall-damp")
  })

  it("returns nothing for an unrelated query", () => {
    const matches = findKnowledge({ text: "how do I reset my email password" })
    expect(matches).toHaveLength(0)
  })

  it("honours the domain filter", () => {
    const query = { text: "copper condensation damp", domain: "vehicle" as const }
    expect(findKnowledge(query)).toHaveLength(0)
  })

  it("honours the locale filter", () => {
    const query = { text: "copper condensation damp", locale: "en" as const }
    expect(findKnowledge(query).map((m) => m.entry.guidance.locale)).toEqual(["en"])
  })

  it("matches an Afrikaans query to the Afrikaans entry only", () => {
    const matches = findKnowledge({ text: "koper pyp kondensasie muur klam", locale: "af" })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every((m) => m.entry.guidance.locale === "af")).toBe(true)
    expect(matches[0].entry.slug).toBe("copper-pipe-condensation-wall-damp-af")
  })

  it("excludes non-published entries", () => {
    const draftEntry = {
      ...KNOWLEDGE_SEED[0],
      slug: "unpublished-copy",
      status: "draft" as const,
    }
    const matches = rankKnowledge([draftEntry], { text: "copper condensation damp" })
    expect(matches).toHaveLength(0)
  })

  it("ranks higher scores first", () => {
    const strong = KNOWLEDGE_SEED[0]
    const weak = {
      ...KNOWLEDGE_SEED[0],
      slug: "weak-entry",
      symptoms: ["something"],
      keywords: ["cold"],
    }
    const matches = rankKnowledge([weak, strong], {
      text: "copper pipe condensation wall damp verdigris blistering",
    })
    expect(matches[0].entry.slug).toBe(strong.slug)
    expect(matches[0].score).toBeGreaterThan(matches[1].score)
  })

  it("adds asset-type weight when the query asset type matches (case-insensitive)", () => {
    const base = rankKnowledge(KNOWLEDGE_SEED, { text: "copper condensation damp", locale: "en" })[0]
    const withAsset = rankKnowledge(KNOWLEDGE_SEED, {
      text: "copper condensation damp",
      locale: "en",
      assetType: "Plumbing",
    })[0]
    expect(withAsset.score).toBe(base.score + 3)
    expect(withAsset.matchedTerms).toContain("Plumbing")
  })

  it("applies the minScore threshold at the boundary", () => {
    // "frost" is a single keyword (score 2) — below the default threshold of 3.
    expect(findKnowledge({ text: "frost" })).toHaveLength(0)
    // "corrosion" hits keyword (2) + symptom token (1) = 3 — meets the threshold.
    const atThreshold = findKnowledge({ text: "corrosion" })
    expect(atThreshold.length).toBeGreaterThan(0)
    expect(atThreshold[0].score).toBe(3)
  })

  it("isolates locales when a query matches entries in both", () => {
    const both = findKnowledge({ text: "wall muur", assetType: "plumbing" }).map((m) => m.entry.slug)
    expect(both).toContain("copper-pipe-condensation-wall-damp")
    expect(both).toContain("copper-pipe-condensation-wall-damp-af")

    const en = findKnowledge({ text: "wall muur", assetType: "plumbing", locale: "en" })
    expect(en.map((m) => m.entry.slug)).toEqual(["copper-pipe-condensation-wall-damp"])

    const af = findKnowledge({ text: "wall muur", assetType: "plumbing", locale: "af" })
    expect(af.map((m) => m.entry.slug)).toEqual(["copper-pipe-condensation-wall-damp-af"])
  })

  it("returns null for an unknown slug", () => {
    expect(getKnowledgeBySlug("does-not-exist")).toBeNull()
  })

  it("returns nothing for an empty or whitespace-only query", () => {
    expect(findKnowledge({ text: "" })).toHaveLength(0)
    expect(findKnowledge({ text: "   " })).toHaveLength(0)
  })
})

describe("knowledge → maintenance task draft", () => {
  it("maps an entry into a review-required task draft", () => {
    const entry = getKnowledgeBySlug("copper-pipe-condensation-wall-damp")!
    const draft = buildMaintenanceTaskDraft(entry)

    expect(draft.task.title).toBe(entry.guidance.title)
    expect(draft.task.status).toBe("Not Started")
    // Safety-bearing entry should not be created at low priority.
    expect(draft.task.priority).toBe("High")
    expect(draft.checklist.length).toBe(entry.guidance.steps.length)
    expect(draft.checklist[0]).toContain("Confirm condensation vs leak")
    expect(draft.safety.length).toBeGreaterThan(0)
    expect(draft.task.description).toContain(`knowledge/${entry.slug}`)
    expect(draft.knowledgeSlug).toBe(entry.slug)
  })

  it("respects context overrides", () => {
    const entry = getKnowledgeBySlug("copper-pipe-condensation-wall-damp")!
    const draft = buildMaintenanceTaskDraft(entry, {
      assignedToName: "charl",
      project: "Winter prep",
      priority: "Urgent",
    })
    expect(draft.task.assignedToName).toBe("charl")
    expect(draft.task.project).toBe("Winter prep")
    expect(draft.task.priority).toBe("Urgent")
  })

  it("defaults to Medium priority when the entry has no safety boundaries", () => {
    const entry = getKnowledgeBySlug("copper-pipe-condensation-wall-damp")!
    const withoutSafety = { ...entry, guidance: { ...entry.guidance, safety: [] } }
    const draft = buildMaintenanceTaskDraft(withoutSafety)
    expect(draft.task.priority).toBe("Medium")
  })

  it("orders the checklist by step order regardless of input order", () => {
    const entry = getKnowledgeBySlug("copper-pipe-condensation-wall-damp")!
    const shuffled = {
      ...entry,
      guidance: { ...entry.guidance, steps: [...entry.guidance.steps].reverse() },
    }
    const draft = buildMaintenanceTaskDraft(shuffled)
    expect(draft.checklist[0]).toContain("Confirm condensation vs leak")
  })
})
