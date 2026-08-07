import { describe, expect, it } from "vitest"
import { buildKnowledgeGrounding } from "@/lib/knowledge/grounding"
import { findKnowledge } from "@/lib/knowledge/retrieval"

const copperMatches = findKnowledge({
  text: "copper pipe condensation causing wall damp and blistering paint",
  locale: "en",
})

describe("knowledge grounding", () => {
  it("returns null when nothing matched so callers fall back to ungrounded generation", () => {
    expect(buildKnowledgeGrounding([])).toBeNull()
  })

  it("renders the curated title, summary, safety and ordered steps", () => {
    const grounding = buildKnowledgeGrounding(copperMatches)
    expect(grounding).not.toBeNull()

    const entry = copperMatches[0].entry
    expect(grounding!.text).toContain(entry.guidance.title)
    expect(grounding!.text).toContain(entry.guidance.summary)
    expect(grounding!.text).toContain("Safety boundaries:")
    expect(grounding!.text).toContain(entry.guidance.safety[0])
    expect(grounding!.text).toContain("1. Confirm condensation vs leak")
  })

  it("reports provenance refs for the entries it rendered", () => {
    const grounding = buildKnowledgeGrounding(copperMatches)
    expect(grounding!.refs).toHaveLength(Math.min(copperMatches.length, 2))
    expect(grounding!.refs[0]).toMatchObject({
      slug: "copper-pipe-condensation-wall-damp",
      title: copperMatches[0].entry.guidance.title,
    })
    expect(grounding!.refs[0].score).toBeGreaterThan(0)
  })

  it("caps the number of rendered entries", () => {
    const doubled = [...copperMatches, ...copperMatches, ...copperMatches]
    const grounding = buildKnowledgeGrounding(doubled, { maxEntries: 1 })
    expect(grounding!.refs).toHaveLength(1)
  })

  it("caps steps per entry to keep the prompt bounded", () => {
    const grounding = buildKnowledgeGrounding(copperMatches, { maxStepsPerEntry: 2 })
    const stepLines = grounding!.text.split("\n").filter((line) => /^\d+\. /.test(line))
    expect(stepLines).toHaveLength(2)
  })

  it("orders steps by their declared order, not array position", () => {
    const [match] = copperMatches
    const shuffled = {
      ...match,
      entry: {
        ...match.entry,
        guidance: {
          ...match.entry.guidance,
          steps: match.entry.guidance.steps.slice().reverse(),
        },
      },
    }
    const grounding = buildKnowledgeGrounding([shuffled])
    const orders = grounding!.text
      .split("\n")
      .filter((line) => /^\d+\. /.test(line))
      .map((line) => Number.parseInt(line, 10))
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })
})
