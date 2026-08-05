import { describe, it, expect } from "vitest"
import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import { knowledgeEntrySchema } from "@/lib/knowledge/types"
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
    const query = { text: "copper condensation damp", locale: "af" as const }
    expect(findKnowledge(query)).toHaveLength(0)
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
})
