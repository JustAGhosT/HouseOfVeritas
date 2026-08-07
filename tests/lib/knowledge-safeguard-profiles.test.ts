import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import {
  KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
  knowledgeSafeguardProfileRequestSchema,
  latestEventFor,
  parseKnowledgeSafeguardProfileRequest,
  projectSafeguardProfiles,
  relaxedBeyondBuiltin,
  resolveEffectiveProfile,
  type KnowledgeSafeguardProfileEvent,
} from "@/lib/knowledge/safeguard-profile-events"
import {
  evaluateKnowledgeCandidate,
  KNOWLEDGE_PUBLICATION_SAFEGUARDS,
  NON_WAIVABLE_SAFEGUARD_IDS,
  STRICT_SAFEGUARD_PROFILE,
  type KnowledgeSafeguardId,
} from "@/lib/knowledge/safeguards"
import {
  getKnowledgeSafeguardProfileRepository,
  KnowledgeSafeguardProfileConflictError,
  KnowledgeSafeguardProfileStoreUnavailableError,
  loadEffectiveSafeguardProfile,
  resetKnowledgeSafeguardProfileRepositoryForTests,
} from "@/lib/repositories/knowledge-safeguard-profile-repository"

function event(
  profileId: string,
  version: number,
  disabledSafeguards: KnowledgeSafeguardId[],
  createdAt = "2026-08-06T00:00:00.000Z"
): KnowledgeSafeguardProfileEvent {
  return {
    schemaVersion: KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
    profileId,
    label: profileId,
    description: "test",
    disabledSafeguards,
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

describe("safeguard profile schema", () => {
  const valid = {
    schemaVersion: KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
    profileId: "checklist",
    label: "Checklist",
    description: "Inspect-and-record.",
    disabledSafeguards: ["diagnosis_before_action"],
    rationale: "Changes nothing on the asset.",
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
  }

  it("accepts a well-formed request", () => {
    expect(parseKnowledgeSafeguardProfileRequest(valid)).not.toBeNull()
  })

  it("blocks every non-waivable safeguard", () => {
    expect(NON_WAIVABLE_SAFEGUARD_IDS.slice().sort()).toEqual([
      "data_boundary",
      "verifiable_ground_truth",
    ])
    for (const safeguard of NON_WAIVABLE_SAFEGUARD_IDS) {
      expect(
        knowledgeSafeguardProfileRequestSchema.safeParse({
          ...valid,
          disabledSafeguards: [safeguard],
        }).success
      ).toBe(false)
    }
  })

  it("allows every waivable safeguard", () => {
    const waivable = KNOWLEDGE_PUBLICATION_SAFEGUARDS.filter((safeguard) => safeguard.waivable).map(
      (safeguard) => safeguard.id
    )
    expect(
      knowledgeSafeguardProfileRequestSchema.safeParse({ ...valid, disabledSafeguards: waivable })
        .success
    ).toBe(true)
  })

  it("rejects duplicates, bad ids and missing rationale", () => {
    expect(
      knowledgeSafeguardProfileRequestSchema.safeParse({
        ...valid,
        disabledSafeguards: ["diagnosis_before_action", "diagnosis_before_action"],
      }).success
    ).toBe(false)
    expect(
      knowledgeSafeguardProfileRequestSchema.safeParse({ ...valid, profileId: "Bad Id" }).success
    ).toBe(false)
    expect(
      knowledgeSafeguardProfileRequestSchema.safeParse({ ...valid, rationale: "" }).success
    ).toBe(false)
  })
})

describe("resolution", () => {
  it("prefers a stored record over the built-in of the same id", () => {
    const events = [event("strict", 1, ["commercial_neutrality"])]
    const resolved = resolveEffectiveProfile("strict", events)
    expect(resolved.source).toBe("stored")
    expect(resolved.profile.disabledSafeguards).toEqual(["commercial_neutrality"])
  })

  it("uses the built-in when nothing is stored", () => {
    const resolved = resolveEffectiveProfile("household-recipe", [])
    expect(resolved.source).toBe("builtin")
    expect(resolved.profile.disabledSafeguards).toContain("statutory_competence")
  })

  it("falls back to strict for an unknown id rather than throwing", () => {
    const resolved = resolveEffectiveProfile("does-not-exist", [])
    expect(resolved.profile).toEqual(STRICT_SAFEGUARD_PROFILE)
  })

  it("takes the highest version, not the last inserted", () => {
    const events = [event("strict", 2, []), event("strict", 1, ["commercial_neutrality"])]
    expect(latestEventFor("strict", events)!.version).toBe(2)
    expect(resolveEffectiveProfile("strict", events).profile.disabledSafeguards).toEqual([])
  })

  it("strips a non-waivable safeguard from a stored record and reports it", () => {
    // Only reachable if a record bypassed the request schema — a direct write to
    // the collection, or corruption in place. The invariant must survive it.
    const rogue = event("strict", 1, [
      "data_boundary",
      "verifiable_ground_truth",
      "commercial_neutrality",
    ])
    const resolved = resolveEffectiveProfile("strict", [rogue])

    expect(resolved.profile.disabledSafeguards).toEqual(["commercial_neutrality"])
    expect(resolved.sanitizedSafeguards.slice().sort()).toEqual([
      "data_boundary",
      "verifiable_ground_truth",
    ])
  })

  it("reports nothing sanitized for an honest record", () => {
    const resolved = resolveEffectiveProfile("strict", [event("strict", 1, ["irreversible_harm"])])
    expect(resolved.sanitizedSafeguards).toEqual([])
  })
})

describe("projection", () => {
  it("includes built-ins and stored-only profiles, sorted", () => {
    const projections = projectSafeguardProfiles([event("custom-one", 1, [])])
    expect(projections.map((p) => p.profileId)).toEqual([
      "checklist",
      "custom-one",
      "household-recipe",
      "strict",
    ])
  })

  it("flags deviation only when the effective set differs from the built-in", () => {
    const unchanged = projectSafeguardProfiles([event("checklist", 1, ["diagnosis_before_action"])])
    expect(unchanged.find((p) => p.profileId === "checklist")!.deviatesFromBuiltin).toBe(false)

    const changed = projectSafeguardProfiles([event("checklist", 1, [])])
    expect(changed.find((p) => p.profileId === "checklist")!.deviatesFromBuiltin).toBe(true)
  })

  it("separates operator relaxation from built-in waivers", () => {
    const projections = projectSafeguardProfiles([
      event("household-recipe", 1, [
        "statutory_competence",
        "diagnosis_before_action",
        "irreversible_harm",
      ]),
    ])
    const recipe = projections.find((p) => p.profileId === "household-recipe")!
    expect(relaxedBeyondBuiltin(recipe)).toEqual({
      kind: "vs-builtin",
      safeguards: ["irreversible_harm"],
    })
  })

  it("reports no relaxation for a stored profile matching its built-in", () => {
    const projections = projectSafeguardProfiles([
      event("household-recipe", 1, ["statutory_competence"]),
    ])
    expect(
      relaxedBeyondBuiltin(projections.find((p) => p.profileId === "household-recipe")!)
    ).toEqual({ kind: "vs-builtin", safeguards: [] })
  })

  it("does not claim a custom profile is relaxed beyond a baseline it never had", () => {
    // With no built-in of the same id there is no baseline, so calling every
    // disabled safeguard "relaxed beyond the default" would be misleading.
    const projections = projectSafeguardProfiles([event("custom-one", 1, ["irreversible_harm"])])
    const custom = projections.find((p) => p.profileId === "custom-one")!
    expect(custom.builtin).toBeNull()
    expect(relaxedBeyondBuiltin(custom)).toEqual({
      kind: "no-baseline",
      safeguards: ["irreversible_harm"],
    })
  })
})

describe("repository", () => {
  beforeEach(() => resetKnowledgeSafeguardProfileRepositoryForTests())

  it("appends with a monotonic version and rejects a stale expectedVersion", async () => {
    const { repository } = await getKnowledgeSafeguardProfileRepository()
    const base = {
      schemaVersion: KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
      profileId: "checklist",
      label: "Checklist",
      description: "d",
      disabledSafeguards: [] as KnowledgeSafeguardId[],
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
    ).rejects.toBeInstanceOf(KnowledgeSafeguardProfileConflictError)
  })

  it("falls back to strict when the store is unreachable, and says so", async () => {
    const resolved = await loadEffectiveSafeguardProfile("household-recipe", () => {
      throw new KnowledgeSafeguardProfileStoreUnavailableError("unreachable")
    })
    // household-recipe normally waives two safeguards; the outage must not preserve that.
    expect(resolved.source).toBe("builtin-fallback")
    expect(resolved.profile).toEqual(STRICT_SAFEGUARD_PROFILE)
    expect(resolved.profile.disabledSafeguards).toEqual([])
  })

  it("rethrows a programmer error instead of disguising it as an outage", async () => {
    // Swallowing everything would report a bug as `builtin-fallback` and hide it
    // behind a silently stricter profile.
    await expect(
      loadEffectiveSafeguardProfile("strict", () => {
        throw new TypeError("cannot read properties of undefined")
      })
    ).rejects.toBeInstanceOf(TypeError)
  })

  it("uses the real store when it is reachable", async () => {
    const resolved = await loadEffectiveSafeguardProfile("household-recipe")
    expect(resolved.source).toBe("builtin")
    expect(resolved.profile.disabledSafeguards).toContain("statutory_competence")
  })
})

describe("evaluation records where its profile came from", () => {
  it("defaults to builtin", () => {
    const result = evaluateKnowledgeCandidate({
      candidateId: "x",
      safeguardResults: {},
      facts: null,
    })
    expect(result.profileSource).toBe("builtin")
  })

  it("carries a stored or fallback source through to the evaluation", () => {
    const stored = evaluateKnowledgeCandidate(
      { candidateId: "x", safeguardResults: {}, facts: null },
      { profileSource: "stored" }
    )
    expect(stored.profileSource).toBe("stored")

    const fallback = evaluateKnowledgeCandidate(
      { candidateId: "x", safeguardResults: {}, facts: null },
      { profileSource: "builtin-fallback" }
    )
    expect(fallback.profileSource).toBe("builtin-fallback")
  })
})
