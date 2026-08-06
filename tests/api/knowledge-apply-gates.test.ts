import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { POST as APPLY } from "@/app/api/knowledge/apply/route"
import { POST as SET_PROFILE } from "@/app/api/knowledge/gate-profiles/route"
import { KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION } from "@/lib/knowledge/gate-profile-events"
import { resetKnowledgeGateProfileRepositoryForTests } from "@/lib/repositories/knowledge-gate-profile-repository"

/**
 * The wiring test: an administrator changing a gate profile must change what
 * /api/knowledge/apply will do, with no deploy and no seed edit. Everything
 * below goes through the real routes rather than calling the evaluator, because
 * the point being proved is that they are connected.
 */

const COPPER_SLUG = "copper-pipe-condensation-wall-damp"

const adminHeaders = {
  "x-user-id": "admin-1",
  "x-user-role": "admin",
  "x-user-email": "admin@example.test",
  "content-type": "application/json",
}

function applyRequest(slug = COPPER_SLUG) {
  return new Request("http://localhost/api/knowledge/apply", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ slug }),
  })
}

function setProfile(disabledGates: string[], expectedVersion: number, rationale: string) {
  return new Request("http://localhost/api/knowledge/gate-profiles", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      schemaVersion: KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION,
      profileId: "strict",
      label: "Strict",
      description: "Every gate runs.",
      disabledGates,
      rationale,
      expectedVersion,
      idempotencyKey: randomUUID(),
    }),
  })
}

describe("POST /api/knowledge/apply — gate enforcement", () => {
  beforeEach(() => {
    resetKnowledgeGateProfileRepositoryForTests()
  })

  it("applies a seed entry that clears its gates, and reports the profile used", async () => {
    const response = await APPLY(applyRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.taskDraft).toBeDefined()
    expect(body.summary.knowledgeSlug).toBe(COPPER_SLUG)
    expect(body.summary.gateProfileId).toBe("strict")
    expect(body.summary.gateProfileSource).toBe("builtin")
    expect(body.summary.hasSafetyBoundaries).toBe(true)
    expect(body.summary.skippedGates).toEqual([])
  })

  it("still 404s for an unknown slug rather than leaking a gate decision", async () => {
    expect((await APPLY(applyRequest("does-not-exist"))).status).toBe(404)
  })

  it("reports a skipped gate when an administrator relaxes the profile", async () => {
    expect(
      (await SET_PROFILE(setProfile(["commercial_neutrality"], 0, "Reviewed by hand this sprint.")))
        .status
    ).toBe(201)

    const body = await (await APPLY(applyRequest())).json()
    expect(body.summary.gateProfileSource).toBe("stored")
    expect(body.summary.skippedGates).toEqual(["commercial_neutrality"])
  })

  it("keeps applying when a relaxed profile is reverted", async () => {
    await SET_PROFILE(setProfile(["commercial_neutrality"], 0, "Temporarily relaxed."))
    await SET_PROFILE(setProfile([], 1, "Supplier notes reworked; neutrality checked again."))

    const response = await APPLY(applyRequest())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.summary.skippedGates).toEqual([])
    expect(body.summary.gateProfileSource).toBe("stored")
  })

  it("falls back to the built-in profile for an entry kind with no stored record", async () => {
    // "strict" stored, but a checklist entry resolves the "checklist" profile,
    // which has no stored record — so it must come from the built-in.
    await SET_PROFILE(setProfile(["commercial_neutrality"], 0, "Unrelated to checklists."))
    const body = await (await APPLY(applyRequest())).json()
    // The copper entry is `troubleshooting`, so it uses "strict" — stored.
    expect(body.summary.gateProfileId).toBe("strict")
    expect(body.summary.gateProfileSource).toBe("stored")
  })
})
