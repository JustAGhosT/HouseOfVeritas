import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import {
  KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION,
  knowledgeGateProfileRequestSchema,
  latestEventFor,
  parseKnowledgeGateProfileRequest,
  projectGateProfiles,
  relaxedBeyondBuiltin,
  resolveEffectiveProfile,
  type KnowledgeGateProfileEvent,
} from "@/lib/knowledge/gate-profile-events"
import {
  evaluateKnowledgeCandidate,
  KNOWLEDGE_PUBLICATION_GATES,
  NON_WAIVABLE_GATE_IDS,
  STRICT_GATE_PROFILE,
  type KnowledgeGateId,
} from "@/lib/knowledge/gates"
import {
  getKnowledgeGateProfileRepository,
  KnowledgeGateProfileConflictError,
  KnowledgeGateProfileStoreUnavailableError,
  loadEffectiveGateProfile,
  resetKnowledgeGateProfileRepositoryForTests,
} from "@/lib/repositories/knowledge-gate-profile-repository"

function event(
  profileId: string,
  version: number,
  disabledGates: KnowledgeGateId[],
  createdAt = "2026-08-06T00:00:00.000Z"
): KnowledgeGateProfileEvent {
  return {
    schemaVersion: KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION,
    profileId,
    label: profileId,
    description: "test",
    disabledGates,
    rationale: "test rationale",
    expectedVersion: version - 1,
    idempotencyKey: randomUUID(),
    id: randomUUID(),
    version,
    actorId: "admin-1",
    actorRole: "admin",
    createdAt,
    requestFingerprint: "fingerprint",
  }
}

describe("gate profile schema", () => {
  const valid = {
    schemaVersion: KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION,
    profileId: "checklist",
    label: "Checklist",
    description: "Inspect-and-record.",
    disabledGates: ["diagnosis_before_action"],
    rationale: "Changes nothing on the asset.",
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
  }

  it("accepts a well-formed request", () => {
    expect(parseKnowledgeGateProfileRequest(valid)).not.toBeNull()
  })

  it("blocks every non-waivable gate", () => {
    expect(NON_WAIVABLE_GATE_IDS.slice().sort()).toEqual([
      "data_boundary",
      "verifiable_ground_truth",
    ])
    for (const gate of NON_WAIVABLE_GATE_IDS) {
      expect(
        knowledgeGateProfileRequestSchema.safeParse({ ...valid, disabledGates: [gate] }).success
      ).toBe(false)
    }
  })

  it("allows every waivable gate", () => {
    const waivable = KNOWLEDGE_PUBLICATION_GATES.filter((gate) => gate.waivable).map(
      (gate) => gate.id
    )
    expect(
      knowledgeGateProfileRequestSchema.safeParse({ ...valid, disabledGates: waivable }).success
    ).toBe(true)
  })

  it("rejects duplicates, bad ids and missing rationale", () => {
    expect(
      knowledgeGateProfileRequestSchema.safeParse({
        ...valid,
        disabledGates: ["diagnosis_before_action", "diagnosis_before_action"],
      }).success
    ).toBe(false)
    expect(
      knowledgeGateProfileRequestSchema.safeParse({ ...valid, profileId: "Bad Id" }).success
    ).toBe(false)
    expect(knowledgeGateProfileRequestSchema.safeParse({ ...valid, rationale: "" }).success).toBe(
      false
    )
  })
})

describe("resolution", () => {
  it("prefers a stored record over the built-in of the same id", () => {
    const events = [event("strict", 1, ["commercial_neutrality"])]
    const resolved = resolveEffectiveProfile("strict", events)
    expect(resolved.source).toBe("stored")
    expect(resolved.profile.disabledGates).toEqual(["commercial_neutrality"])
  })

  it("uses the built-in when nothing is stored", () => {
    const resolved = resolveEffectiveProfile("household-recipe", [])
    expect(resolved.source).toBe("builtin")
    expect(resolved.profile.disabledGates).toContain("statutory_competence")
  })

  it("falls back to strict for an unknown id rather than throwing", () => {
    const resolved = resolveEffectiveProfile("does-not-exist", [])
    expect(resolved.profile).toEqual(STRICT_GATE_PROFILE)
  })

  it("takes the highest version, not the last inserted", () => {
    const events = [event("strict", 2, []), event("strict", 1, ["commercial_neutrality"])]
    expect(latestEventFor("strict", events)!.version).toBe(2)
    expect(resolveEffectiveProfile("strict", events).profile.disabledGates).toEqual([])
  })

  it("strips a non-waivable gate from a stored record and reports it", () => {
    // Only reachable if a record bypassed the request schema — a direct write to
    // the collection, or corruption in place. The invariant must survive it.
    const rogue = event("strict", 1, [
      "data_boundary",
      "verifiable_ground_truth",
      "commercial_neutrality",
    ])
    const resolved = resolveEffectiveProfile("strict", [rogue])

    expect(resolved.profile.disabledGates).toEqual(["commercial_neutrality"])
    expect(resolved.sanitizedGates.slice().sort()).toEqual([
      "data_boundary",
      "verifiable_ground_truth",
    ])
  })

  it("reports nothing sanitized for an honest record", () => {
    const resolved = resolveEffectiveProfile("strict", [event("strict", 1, ["irreversible_harm"])])
    expect(resolved.sanitizedGates).toEqual([])
  })
})

describe("projection", () => {
  it("includes built-ins and stored-only profiles, sorted", () => {
    const projections = projectGateProfiles([event("custom-one", 1, [])])
    expect(projections.map((p) => p.profileId)).toEqual([
      "checklist",
      "custom-one",
      "household-recipe",
      "strict",
    ])
  })

  it("flags deviation only when the effective set differs from the built-in", () => {
    const unchanged = projectGateProfiles([event("checklist", 1, ["diagnosis_before_action"])])
    expect(unchanged.find((p) => p.profileId === "checklist")!.deviatesFromBuiltin).toBe(false)

    const changed = projectGateProfiles([event("checklist", 1, [])])
    expect(changed.find((p) => p.profileId === "checklist")!.deviatesFromBuiltin).toBe(true)
  })

  it("separates operator relaxation from built-in waivers", () => {
    const projections = projectGateProfiles([
      event("household-recipe", 1, [
        "statutory_competence",
        "diagnosis_before_action",
        "irreversible_harm",
      ]),
    ])
    const recipe = projections.find((p) => p.profileId === "household-recipe")!
    expect(relaxedBeyondBuiltin(recipe)).toEqual(["irreversible_harm"])
  })

  it("reports no relaxation for a stored profile matching its built-in", () => {
    const projections = projectGateProfiles([
      event("household-recipe", 1, ["statutory_competence"]),
    ])
    expect(
      relaxedBeyondBuiltin(projections.find((p) => p.profileId === "household-recipe")!)
    ).toEqual([])
  })
})

describe("repository", () => {
  beforeEach(() => resetKnowledgeGateProfileRepositoryForTests())

  it("appends with a monotonic version and rejects a stale expectedVersion", async () => {
    const { repository } = await getKnowledgeGateProfileRepository()
    const base = {
      schemaVersion: KNOWLEDGE_GATE_PROFILE_SCHEMA_VERSION,
      profileId: "checklist",
      label: "Checklist",
      description: "d",
      disabledGates: [] as KnowledgeGateId[],
      rationale: "reason enough",
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    }

    const first = await repository.append({ request: base, actorId: "admin-1", actorRole: "admin" })
    expect(first.event.version).toBe(1)
    expect(first.created).toBe(true)

    await expect(
      repository.append({
        request: { ...base, idempotencyKey: randomUUID() },
        actorId: "admin-1",
        actorRole: "admin",
      })
    ).rejects.toBeInstanceOf(KnowledgeGateProfileConflictError)
  })

  it("falls back to strict when the store is unreachable, and says so", async () => {
    const resolved = await loadEffectiveGateProfile("household-recipe", () => {
      throw new KnowledgeGateProfileStoreUnavailableError("unreachable")
    })
    // household-recipe normally waives two gates; the outage must not preserve that.
    expect(resolved.source).toBe("builtin-fallback")
    expect(resolved.profile).toEqual(STRICT_GATE_PROFILE)
    expect(resolved.profile.disabledGates).toEqual([])
  })

  it("rethrows a programmer error instead of disguising it as an outage", async () => {
    // Swallowing everything would report a bug as `builtin-fallback` and hide it
    // behind a silently stricter profile.
    await expect(
      loadEffectiveGateProfile("strict", () => {
        throw new TypeError("cannot read properties of undefined")
      })
    ).rejects.toBeInstanceOf(TypeError)
  })

  it("uses the real store when it is reachable", async () => {
    const resolved = await loadEffectiveGateProfile("household-recipe")
    expect(resolved.source).toBe("builtin")
    expect(resolved.profile.disabledGates).toContain("statutory_competence")
  })
})

describe("evaluation records where its profile came from", () => {
  it("defaults to builtin", () => {
    const result = evaluateKnowledgeCandidate({
      candidateId: "x",
      gateResults: {},
      facts: null,
    })
    expect(result.profileSource).toBe("builtin")
  })

  it("carries a stored or fallback source through to the evaluation", () => {
    const stored = evaluateKnowledgeCandidate(
      { candidateId: "x", gateResults: {}, facts: null },
      { profileSource: "stored" }
    )
    expect(stored.profileSource).toBe("stored")

    const fallback = evaluateKnowledgeCandidate(
      { candidateId: "x", gateResults: {}, facts: null },
      { profileSource: "builtin-fallback" }
    )
    expect(fallback.profileSource).toBe("builtin-fallback")
  })
})
