import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/knowledge/route"
import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import type { KnowledgeEntry, KnowledgeMatch } from "@/lib/knowledge/types"

/**
 * The withheld branch of GET /api/knowledge.
 *
 * `assertPublishable()` refuses to let the seed import an entry that does not
 * clear, so no real match can be withheld. Retrieval is mocked to return one
 * that does not, which is the only way to show the route actually drops it
 * rather than computing a verdict and serving the entry anyway.
 */

const injected = vi.hoisted(() => ({ matches: null as KnowledgeMatch[] | null }))

vi.mock("@/lib/knowledge/retrieval", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge/retrieval")>()
  return {
    ...actual,
    findKnowledge: (...args: Parameters<typeof actual.findKnowledge>) =>
      injected.matches ?? actual.findKnowledge(...args),
  }
})

const adminHeaders = {
  "x-user-id": "admin-1",
  "x-user-role": "admin",
  "x-user-email": "admin@example.test",
}

const search = () =>
  GET(
    new Request("http://localhost/api/knowledge?q=copper%20pipe%20condensation", {
      headers: adminHeaders,
    })
  )

const base = KNOWLEDGE_SEED[0]
const asMatch = (entry: KnowledgeEntry): KnowledgeMatch => ({
  entry,
  score: 10,
  matchedTerms: ["copper"],
})

describe("GET /api/knowledge — withholds entries that do not clear", () => {
  beforeEach(() => {
    injected.matches = null
  })

  it("drops a match whose safeguard review has a failure", async () => {
    injected.matches = [
      asMatch({
        ...base,
        review: {
          ...base.review!,
          safeguardResults: { ...base.review!.safeguardResults, irreversible_harm: "fail" },
        },
      }),
    ]

    const body = await (await search()).json()
    expect(body.data.matches).toHaveLength(0)
    expect(body.summary.count).toBe(0)
    expect(body.summary.withheld).toBe(1)
  })

  it("drops a match with an untested safeguard", async () => {
    injected.matches = [
      asMatch({
        ...base,
        review: {
          ...base.review!,
          safeguardResults: { ...base.review!.safeguardResults, data_boundary: "not_tested" },
        },
      }),
    ]
    const body = await (await search()).json()
    expect(body.data.matches).toHaveLength(0)
    expect(body.summary.withheld).toBe(1)
  })

  it("keeps the clearing entries and withholds only the rest", async () => {
    const blocked = {
      ...base,
      slug: "blocked-entry",
      review: { ...base.review!, safeguardResults: { data_boundary: "fail" as const } },
    }
    injected.matches = [asMatch(base), asMatch(blocked)]

    const body = await (await search()).json()
    expect(body.data.matches.map((m: { slug: string }) => m.slug)).toEqual([base.slug])
    expect(body.summary.withheld).toBe(1)
    expect(body.summary.count).toBe(1)
  })

  it("does not leak the withheld entry's body", async () => {
    injected.matches = [
      asMatch({
        ...base,
        review: { ...base.review!, safeguardResults: { data_boundary: "fail" as const } },
      }),
    ]
    const raw = await (await search()).text()
    expect(raw).not.toContain("dry-and-watch")
    expect(raw).not.toContain("Armaflex")
  })
})
