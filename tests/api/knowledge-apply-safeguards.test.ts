import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { POST as APPLY } from "@/app/api/knowledge/apply/route"
import { POST as SET_PROFILE } from "@/app/api/knowledge/safeguard-profiles/route"
import { KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION } from "@/lib/knowledge/safeguard-profile-events"
import { resetKnowledgeSafeguardProfileRepositoryForTests } from "@/lib/repositories/knowledge-safeguard-profile-repository"

/**
 * The wiring test: an administrator changing a safeguard profile must change what
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

function setProfile(disabledSafeguards: string[], expectedVersion: number, rationale: string) {
  return new Request("http://localhost/api/knowledge/safeguard-profiles", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      schemaVersion: KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
      profileId: "strict",
      label: "Strict",
      description: "Every safeguard runs.",
      disabledSafeguards,
      rationale,
      expectedVersion,
      idempotencyKey: randomUUID(),
    }),
  })
}

describe("POST /api/knowledge/apply — safeguard enforcement", () => {
  beforeEach(() => {
    resetKnowledgeSafeguardProfileRepositoryForTests()
  })

  it("applies a seed entry that clears its safeguards, and reports the profile used", async () => {
    const response = await APPLY(applyRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.taskDraft).toBeDefined()
    expect(body.summary.knowledgeSlug).toBe(COPPER_SLUG)
    expect(body.summary.safeguardProfileId).toBe("strict")
    expect(body.summary.safeguardProfileSource).toBe("builtin")
    expect(body.summary.hasSafetyBoundaries).toBe(true)
    expect(body.summary.skippedSafeguards).toEqual([])
  })

  it("still 404s for an unknown slug rather than leaking a safeguard decision", async () => {
    expect((await APPLY(applyRequest("does-not-exist"))).status).toBe(404)
  })

  it("reports a skipped safeguard when an administrator relaxes the profile", async () => {
    expect(
      (await SET_PROFILE(setProfile(["commercial_neutrality"], 0, "Reviewed by hand this sprint.")))
        .status
    ).toBe(201)

    const body = await (await APPLY(applyRequest())).json()
    expect(body.summary.safeguardProfileSource).toBe("stored")
    expect(body.summary.skippedSafeguards).toEqual(["commercial_neutrality"])
  })

  it("keeps applying when a relaxed profile is reverted", async () => {
    await SET_PROFILE(setProfile(["commercial_neutrality"], 0, "Temporarily relaxed."))
    await SET_PROFILE(setProfile([], 1, "Supplier notes reworked; neutrality checked again."))

    const response = await APPLY(applyRequest())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.summary.skippedSafeguards).toEqual([])
    expect(body.summary.safeguardProfileSource).toBe("stored")
  })

  it("falls back to the built-in profile for an entry kind with no stored record", async () => {
    // "strict" stored, but a checklist entry resolves the "checklist" profile,
    // which has no stored record — so it must come from the built-in.
    await SET_PROFILE(setProfile(["commercial_neutrality"], 0, "Unrelated to checklists."))
    const body = await (await APPLY(applyRequest())).json()
    // The copper entry is `troubleshooting`, so it uses "strict" — stored.
    expect(body.summary.safeguardProfileId).toBe("strict")
    expect(body.summary.safeguardProfileSource).toBe("stored")
  })
})
