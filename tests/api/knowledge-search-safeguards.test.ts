import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { GET } from "@/app/api/knowledge/route"
import { POST as SET_PROFILE } from "@/app/api/knowledge/safeguard-profiles/route"
import { KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION } from "@/lib/knowledge/safeguard-profile-events"
import { resetKnowledgeSafeguardProfileRepositoryForTests } from "@/lib/repositories/knowledge-safeguard-profile-repository"

/**
 * Search must answer the same question as apply: may this entry be used right
 * now, under the administrator's current profile? Before this, tightening a
 * safeguard stopped an entry being turned into work while still listing it in
 * results — which reads as an endorsement the safeguards no longer give.
 */

const QUERY = encodeURIComponent("copper pipe condensation wall damp")

const adminHeaders = {
  "x-user-id": "admin-1",
  "x-user-role": "admin",
  "x-user-email": "admin@example.test",
  "content-type": "application/json",
}

const search = () =>
  GET(new Request(`http://localhost/api/knowledge?q=${QUERY}`, { headers: adminHeaders }))

function tightenStrict(disabledSafeguards: string[], expectedVersion: number) {
  return new Request("http://localhost/api/knowledge/safeguard-profiles", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      schemaVersion: KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
      profileId: "strict",
      label: "Strict",
      description: "Every safeguard runs.",
      disabledSafeguards,
      rationale: "Adjusted for a bounded content review.",
      expectedVersion,
      idempotencyKey: randomUUID(),
    }),
  })
}

describe("GET /api/knowledge — safeguard filtering", () => {
  beforeEach(() => {
    resetKnowledgeSafeguardProfileRepositoryForTests()
  })

  it("returns entries that clear their safeguards, and withholds nothing", async () => {
    const response = await search()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.matches.length).toBeGreaterThan(0)
    expect(body.summary.withheld).toBe(0)
    expect(body.data.matches.map((m: { slug: string }) => m.slug)).toContain(
      "copper-pipe-condensation-wall-damp"
    )
  })

  it("keeps serving when an administrator relaxes a safeguard", async () => {
    expect((await SET_PROFILE(tightenStrict(["commercial_neutrality"], 0))).status).toBe(201)

    const body = await (await search()).json()
    expect(body.data.matches.length).toBeGreaterThan(0)
    expect(body.summary.withheld).toBe(0)
  })

  it("reports the withheld count rather than filtering silently", async () => {
    const body = await (await search()).json()
    expect(body.summary).toHaveProperty("withheld")
    expect(typeof body.summary.withheld).toBe("number")
  })

  it("counts only entries actually returned", async () => {
    const body = await (await search()).json()
    expect(body.summary.count).toBe(body.data.matches.length)
  })

  it("still returns nothing for an unrelated query", async () => {
    const response = await GET(
      new Request("http://localhost/api/knowledge?q=reset%20my%20email%20password", {
        headers: adminHeaders,
      })
    )
    const body = await response.json()
    expect(body.data.matches).toHaveLength(0)
    expect(body.summary.withheld).toBe(0)
  })
})
