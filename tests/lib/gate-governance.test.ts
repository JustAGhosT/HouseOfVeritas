import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  GATE_ZERO_ID,
  GATE_ZERO_PROTOCOL_VERSION,
  getMissingActivationPrerequisites,
  isAllowedTransition,
  type GateDecisionRequest,
} from "@/lib/governance/gate-definitions"
import {
  GateGovernanceConflictError,
  GateGovernanceIdempotencyError,
  GateGovernanceStoreUnavailableError,
  getGateGovernanceRepository,
  resetGateGovernanceRepositoryForTests,
} from "@/lib/repositories/gate-governance-repository"

function request(overrides: Partial<GateDecisionRequest> = {}): GateDecisionRequest {
  return {
    gateId: GATE_ZERO_ID,
    protocolVersion: GATE_ZERO_PROTOCOL_VERSION,
    decisionId: "O1",
    status: "approved_in_principle",
    rationale: "Owner accepted the bounded recommendation.",
    evidenceRefs: [],
    expectedVersion: 0,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    ...overrides,
  }
}

describe("Gate governance rules", () => {
  it("requires approval in principle before activation", () => {
    expect(isAllowedTransition(null, "active")).toBe(false)
    expect(isAllowedTransition(null, "approved_in_principle")).toBe(true)
    expect(isAllowedTransition("approved_in_principle", "active")).toBe(true)
    expect(isAllowedTransition("active", "rejected")).toBe(false)
    expect(isAllowedTransition("active", "superseded")).toBe(true)
  })

  it("fails O5 activation closed without a candidate and evidence reference", () => {
    expect(
      getMissingActivationPrerequisites(
        request({ decisionId: "O5", status: "active", evidenceRefs: [] })
      )
    ).toEqual(["reviewerCandidateId", "evidenceRefs"])
  })

  it("fails O6 activation closed until every accountability field is present", () => {
    expect(
      getMissingActivationPrerequisites(
        request({
          decisionId: "O6",
          status: "active",
          prerequisites: { restrictedStoreApproved: true },
        })
      )
    ).toEqual([
      "responsiblePartyId",
      "privacyReviewerId",
      "researchOwnerId",
      "authorizedResearcherIds",
      "retentionDeletionDeadline",
      "correctionDeletionOwnerId",
      "incidentOwnerId",
    ])
  })
})

describe("Gate governance repository", () => {
  beforeEach(() => {
    resetGateGovernanceRepositoryForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetGateGovernanceRepositoryForTests()
  })

  it("fails closed outside explicit test modes when MongoDB is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("MONGODB_URI", "")
    vi.stubEnv("MONGO_URL", "")

    await expect(getGateGovernanceRepository()).rejects.toBeInstanceOf(
      GateGovernanceStoreUnavailableError
    )
  })

  it("appends immutable versions and derives the stored actor from the server input", async () => {
    const { repository, mode } = await getGateGovernanceRepository()
    expect(mode).toBe("memory")

    const result = await repository.append({
      request: request(),
      actorId: "admin-1",
      actorRole: "admin",
      createdAt: "2026-07-26T12:00:00.000Z",
    })

    expect(result.created).toBe(true)
    expect(result.event).toMatchObject({ version: 1, actorId: "admin-1", actorRole: "admin" })
    expect(await repository.list(GATE_ZERO_ID, GATE_ZERO_PROTOCOL_VERSION)).toHaveLength(1)
  })

  it("returns the original event for an identical idempotent retry", async () => {
    const { repository } = await getGateGovernanceRepository()
    const input = { request: request(), actorId: "admin-1", actorRole: "admin" as const }
    const first = await repository.append(input)
    const retry = await repository.append(input)

    expect(retry.created).toBe(false)
    expect(retry.event.id).toBe(first.event.id)
  })

  it("rejects stale versions and idempotency-key reuse with a changed payload", async () => {
    const { repository } = await getGateGovernanceRepository()
    await repository.append({ request: request(), actorId: "admin-1", actorRole: "admin" })

    await expect(
      repository.append({
        request: request({
          decisionId: "O2",
          idempotencyKey: "00000000-0000-4000-8000-000000000002",
        }),
        actorId: "admin-1",
        actorRole: "admin",
      })
    ).resolves.toMatchObject({ created: true })

    await expect(
      repository.append({
        request: request({
          idempotencyKey: "00000000-0000-4000-8000-000000000003",
        }),
        actorId: "admin-1",
        actorRole: "admin",
      })
    ).rejects.toBeInstanceOf(GateGovernanceConflictError)

    await expect(
      repository.append({
        request: request({ rationale: "A different decision body." }),
        actorId: "admin-1",
        actorRole: "admin",
      })
    ).rejects.toBeInstanceOf(GateGovernanceIdempotencyError)
  })
})
