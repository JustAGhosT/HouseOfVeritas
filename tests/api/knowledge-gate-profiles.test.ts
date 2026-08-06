import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { GET, POST } from "@/app/api/knowledge/gate-profiles/route"
import { KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION } from "@/lib/knowledge/gate-profile-events"
import { resetKnowledgeGateProfileRepositoryForTests } from "@/lib/repositories/knowledge-gate-profile-repository"

const adminHeaders = {
  "x-user-id": "admin-1",
  "x-user-role": "admin",
  "x-user-email": "admin@example.test",
  "Content-Type": "application/json",
}

const operatorHeaders = {
  "x-user-id": "operator-1",
  "x-user-role": "operator",
  "x-user-email": "operator@example.test",
  "Content-Type": "application/json",
}

const ENDPOINT = "http://localhost/api/knowledge/gate-profiles"

function profileRequest(overrides: Record<string, unknown> = {}, headers = adminHeaders) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemaVersion: KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION,
      profileId: "checklist",
      label: "Checklist",
      description: "Inspect-and-record entries.",
      disabledGates: ["diagnosis_before_action"],
      rationale: "Checklists change nothing on the asset, so misdiagnosis is not a risk.",
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
      ...overrides,
    }),
  })
}

describe("/api/knowledge/gate-profiles", () => {
  beforeEach(() => {
    resetKnowledgeGateProfileRepositoryForTests()
  })

  it("requires an authenticated admin for reads and writes", async () => {
    expect(await GET(new Request(ENDPOINT))).toMatchObject({ status: 401 })
    expect(await GET(new Request(ENDPOINT, { headers: operatorHeaders }))).toMatchObject({
      status: 403,
    })
    expect(await POST(profileRequest({}, operatorHeaders))).toMatchObject({ status: 403 })
  })

  it("returns the built-in profiles before anything is stored", async () => {
    const response = await GET(new Request(ENDPOINT, { headers: adminHeaders }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.profiles.map((p: { profileId: string }) => p.profileId)).toEqual([
      "checklist",
      "household-recipe",
      "strict",
    ])
    expect(body.data.profiles.every((p: { source: string }) => p.source === "builtin")).toBe(true)
    expect(body.summary).toEqual({ total: 3, stored: 0, deviating: 0 })
  })

  it("advertises which gates can never be waived", async () => {
    const body = await (await GET(new Request(ENDPOINT, { headers: adminHeaders }))).json()
    expect(body.data.nonWaivableGates.sort()).toEqual(["data_boundary", "verifiable_ground_truth"])
  })

  it("records the authenticated actor and rejects client-supplied actor fields", async () => {
    const spoofed = await POST(profileRequest({ actorId: "spoofed-admin" }))
    expect(spoofed.status).toBe(400)

    const response = await POST(profileRequest())
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.data.event.actorId).toBe("admin-1")
    expect(body.data.event.actorRole).toBe("admin")
    expect(body.data.event.version).toBe(1)
  })

  it("refuses to waive a non-waivable gate, whatever the rationale", async () => {
    for (const gate of ["data_boundary", "verifiable_ground_truth"]) {
      const response = await POST(
        profileRequest({
          profileId: "loose",
          disabledGates: [gate],
          rationale: "The administrator has decided this is acceptable for now.",
        })
      )
      const body = await response.json()
      expect(response.status).toBe(400)
      expect(body.messages.join(" ")).toContain(`${gate} cannot be waived`)
    }
  })

  it("requires a rationale even when re-enabling every gate", async () => {
    const response = await POST(profileRequest({ disabledGates: [], rationale: "" }))
    expect(response.status).toBe(400)
  })

  it("enforces optimistic versioning", async () => {
    expect((await POST(profileRequest())).status).toBe(201)
    const stale = await POST(profileRequest({ expectedVersion: 0 }))
    expect(stale.status).toBe(409)

    const next = await POST(profileRequest({ expectedVersion: 1, disabledGates: [] }))
    expect(next.status).toBe(201)
    expect((await next.json()).data.event.version).toBe(2)
  })

  it("is idempotent for a repeated key and rejects a reused key with a changed payload", async () => {
    const key = randomUUID()
    const first = await POST(profileRequest({ idempotencyKey: key }))
    expect(first.status).toBe(201)

    const repeat = await POST(profileRequest({ idempotencyKey: key }))
    expect(repeat.status).toBe(200)
    expect((await repeat.json()).summary.created).toBe(false)

    const changed = await POST(
      profileRequest({ idempotencyKey: key, rationale: "A different reason entirely." })
    )
    expect(changed.status).toBe(409)
  })

  it("makes a stored profile the effective one and flags the deviation", async () => {
    await POST(
      profileRequest({
        profileId: "strict",
        label: "Strict",
        description: "Relaxed for a bounded content push.",
        disabledGates: ["commercial_neutrality"],
        rationale:
          "Supplier notes are being reworked; neutrality is reviewed manually this sprint.",
      })
    )

    const body = await (await GET(new Request(ENDPOINT, { headers: adminHeaders }))).json()
    const strict = body.data.profiles.find((p: { profileId: string }) => p.profileId === "strict")

    expect(strict.source).toBe("stored")
    expect(strict.effective.disabledGates).toEqual(["commercial_neutrality"])
    expect(strict.deviatesFromBuiltin).toBe(true)
    expect(strict.relaxedBeyondBuiltin).toEqual(["commercial_neutrality"])
    expect(body.summary).toMatchObject({ stored: 1, deviating: 1 })
  })

  it("separates a built-in waiver from an operator waiver", async () => {
    await POST(
      profileRequest({
        profileId: "household-recipe",
        label: "Household recipe",
        description: "Recipes.",
        // statutory_competence is already waived by the built-in; irreversible_harm is not.
        disabledGates: ["statutory_competence", "diagnosis_before_action", "irreversible_harm"],
        rationale: "Temporarily relaxed while allergen sourcing is re-verified by hand.",
      })
    )

    const body = await (await GET(new Request(ENDPOINT, { headers: adminHeaders }))).json()
    const recipe = body.data.profiles.find(
      (p: { profileId: string }) => p.profileId === "household-recipe"
    )
    expect(recipe.relaxedBeyondBuiltin).toEqual(["irreversible_harm"])
  })

  it("keeps full history for a profile", async () => {
    await POST(profileRequest({ idempotencyKey: randomUUID(), expectedVersion: 0 }))
    await POST(
      profileRequest({ idempotencyKey: randomUUID(), expectedVersion: 1, disabledGates: [] })
    )

    const body = await (await GET(new Request(ENDPOINT, { headers: adminHeaders }))).json()
    const checklist = body.data.profiles.find(
      (p: { profileId: string }) => p.profileId === "checklist"
    )
    expect(checklist.history).toHaveLength(2)
    expect(checklist.history.map((e: { version: number }) => e.version)).toEqual([1, 2])
    expect(checklist.current.version).toBe(2)
  })

  it("rejects unknown fields, unknown gates and malformed ids", async () => {
    expect((await POST(profileRequest({ surprise: true }))).status).toBe(400)
    expect((await POST(profileRequest({ disabledGates: ["not_a_gate"] }))).status).toBe(400)
    expect((await POST(profileRequest({ profileId: "Not Kebab" }))).status).toBe(400)
    expect((await POST(profileRequest({ idempotencyKey: "not-a-uuid" }))).status).toBe(400)
  })

  it("rejects a repeated gate in disabledGates", async () => {
    const response = await POST(
      profileRequest({ disabledGates: ["diagnosis_before_action", "diagnosis_before_action"] })
    )
    expect(response.status).toBe(400)
  })
})
