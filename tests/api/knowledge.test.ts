import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/knowledge/route"
import { POST } from "@/app/api/knowledge/apply/route"

/**
 * Route + RBAC coverage for the knowledge API. These routes call no external
 * services (retrieval is over the in-memory seed; apply only builds a draft),
 * so no mocking is required — auth resolves from the x-user-* header fallback,
 * mirroring tests/api/guidance.test.ts.
 */

function headersFor(role: string, id = role): Record<string, string> {
  return {
    "x-user-id": id,
    "x-user-role": role,
    "x-user-email": `${id}@example.com`,
  }
}

function getRequest(query: string, headers?: Record<string, string>): Request {
  return new Request(`http://localhost/api/knowledge?${query}`, {
    headers: headers ?? {},
  })
}

function applyRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/knowledge/apply", {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  })
}

const COPPER_SLUG = "copper-pipe-condensation-wall-damp"

describe("GET /api/knowledge", () => {
  it("returns ranked matches for a symptom query", async () => {
    const response = await GET(
      getRequest(`q=${encodeURIComponent("copper pipe condensation wall damp")}`, headersFor("operator"))
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.matches.length).toBeGreaterThan(0)
    expect(json.data.matches[0].slug).toBe(COPPER_SLUG)
    expect(json.summary.count).toBe(json.data.matches.length)
    expect(json.summary.query).toContain("copper")
  })

  it("is readable by a resident and honours the locale filter", async () => {
    const response = await GET(
      getRequest(
        `q=${encodeURIComponent("koper pyp kondensasie muur klam")}&locale=af`,
        headersFor("resident", "irma")
      )
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.matches.length).toBeGreaterThan(0)
    expect(
      json.data.matches.every((m: { guidance: { locale: string } }) => m.guidance.locale === "af")
    ).toBe(true)
  })

  it("passes the domain filter through (empty when the domain mismatches)", async () => {
    const response = await GET(
      getRequest(`q=${encodeURIComponent("copper condensation damp")}&domain=vehicle`, headersFor("operator"))
    )

    expect(response.status).toBe(200)
    expect((await response.json()).summary.count).toBe(0)
  })

  it("rejects a query shorter than 2 characters with 400", async () => {
    const response = await GET(getRequest("q=a", headersFor("operator")))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/at least 2/i)
  })

  it("requires authentication (401 without an auth context)", async () => {
    const response = await GET(getRequest("q=copper"))
    expect(response.status).toBe(401)
  })
})

describe("POST /api/knowledge/apply", () => {
  it("returns a review-required draft for an admin without persisting", async () => {
    const response = await POST(applyRequest({ slug: COPPER_SLUG }, headersFor("admin", "hans")))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.taskDraft.task.title).toBeTruthy()
    expect(json.data.taskDraft.task.status).toBe("Not Started")
    expect(json.data.taskDraft.knowledgeSlug).toBe(COPPER_SLUG)
    expect(json.summary.requiresHumanReview).toBe(true)
    expect(json.summary.hasSafetyBoundaries).toBe(true)
    expect(json.summary.knowledgeSlug).toBe(COPPER_SLUG)
  })

  it("allows an operator to apply", async () => {
    const response = await POST(applyRequest({ slug: COPPER_SLUG }, headersFor("operator", "charl")))
    expect(response.status).toBe(200)
  })

  it("forbids a resident (403)", async () => {
    const response = await POST(applyRequest({ slug: COPPER_SLUG }, headersFor("resident", "irma")))
    expect(response.status).toBe(403)
  })

  it("forbids an employee (403)", async () => {
    const response = await POST(applyRequest({ slug: COPPER_SLUG }, headersFor("employee", "sam")))
    expect(response.status).toBe(403)
  })

  it("rejects a malformed slug with 400", async () => {
    const response = await POST(applyRequest({ slug: "Not A Slug!" }, headersFor("operator")))
    expect(response.status).toBe(400)
  })

  it("returns 404 for a valid but unknown slug", async () => {
    const response = await POST(applyRequest({ slug: "does-not-exist" }, headersFor("operator")))
    expect(response.status).toBe(404)
  })

  it("requires authentication (401 without an auth context)", async () => {
    const response = await POST(applyRequest({ slug: COPPER_SLUG }))
    expect(response.status).toBe(401)
  })
})
