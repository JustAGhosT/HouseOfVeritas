import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/knowledge/apply/route"
import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import type { KnowledgeEntry } from "@/lib/knowledge/types"

/**
 * The 409 branch of /api/knowledge/apply.
 *
 * Every seed entry clears its safeguards by construction — `assertPublishable()`
 * refuses to let the seed import otherwise — so the blocked path cannot be
 * reached with real data. Retrieval is mocked to hand the route an entry that
 * does not clear, which is the only way to prove the route actually refuses
 * rather than merely computing a verdict and ignoring it.
 */

const blocked = vi.hoisted(() => ({ entry: null as KnowledgeEntry | null }))

vi.mock("@/lib/knowledge/retrieval", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge/retrieval")>()
  return {
    ...actual,
    getKnowledgeBySlug: (slug: string) => blocked.entry ?? actual.getKnowledgeBySlug(slug),
  }
})

const adminHeaders = {
  "x-user-id": "admin-1",
  "x-user-role": "admin",
  "x-user-email": "admin@example.test",
  "content-type": "application/json",
}

const applyRequest = () =>
  new Request("http://localhost/api/knowledge/apply", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ slug: "copper-pipe-condensation-wall-damp" }),
  })

const base = KNOWLEDGE_SEED[0]

describe("POST /api/knowledge/apply — refuses entries that do not clear", () => {
  beforeEach(() => {
    blocked.entry = null
  })

  it("returns 409 and no task draft when a safeguard failed", async () => {
    blocked.entry = {
      ...base,
      review: {
        ...base.review!,
        safeguardResults: { ...base.review!.safeguardResults, irreversible_harm: "fail" },
      },
    }

    const response = await POST(applyRequest())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.data).toBeUndefined()
    expect(body.reasons[0]).toContain("irreversible_harm")
    expect(body.safeguards.outcome).toBe("rescope_as_safety")
  })

  it("returns 409 when a safeguard was never tested", async () => {
    blocked.entry = {
      ...base,
      review: {
        ...base.review!,
        safeguardResults: { ...base.review!.safeguardResults, data_boundary: "not_tested" },
      },
    }

    const response = await POST(applyRequest())
    expect(response.status).toBe(409)
    expect((await response.json()).safeguards.outcome).toBe("hold_as_draft")
  })

  it("returns 409 when the entry carries no recorded review at all", async () => {
    const { review: _review, ...withoutReview } = base
    blocked.entry = withoutReview as KnowledgeEntry

    const response = await POST(applyRequest())
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.reasons).toEqual(["no recorded safeguard review"])
  })

  it("returns 409 when the guidance declares no safety boundaries", async () => {
    blocked.entry = { ...base, guidance: { ...base.guidance, safety: [] } }

    const response = await POST(applyRequest())
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.reasons).toContain("guidance declares no safety boundaries")
  })

  it("does not leak the entry body in a refusal", async () => {
    blocked.entry = {
      ...base,
      review: { ...base.review!, safeguardResults: { data_boundary: "fail" } },
    }
    const raw = await (await POST(applyRequest())).text()
    expect(raw).not.toContain("dry-and-watch")
    expect(raw).not.toContain("Armaflex")
  })
})
