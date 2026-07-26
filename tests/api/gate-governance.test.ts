import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { GET, POST } from "@/app/api/governance/gates/route"
import {
  GATE_ZERO_ID,
  GATE_ZERO_PROTOCOL_VERSION,
  type GateDecisionStatus,
} from "@/lib/governance/gate-definitions"
import { resetGateGovernanceRepositoryForTests } from "@/lib/repositories/gate-governance-repository"

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
}

function decisionRequest(
  decisionId: "O1" | "O2" | "O3" | "O4" | "O5" | "O6" | "O7",
  status: GateDecisionStatus,
  expectedVersion: number,
  overrides: Record<string, unknown> = {}
) {
  return new Request("http://localhost/api/governance/gates", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      gateId: GATE_ZERO_ID,
      protocolVersion: GATE_ZERO_PROTOCOL_VERSION,
      decisionId,
      status,
      rationale: "Owner accepted the bounded recommendation.",
      evidenceRefs: [],
      expectedVersion,
      idempotencyKey: randomUUID(),
      ...overrides,
    }),
  })
}

describe("/api/governance/gates", () => {
  beforeEach(() => {
    resetGateGovernanceRepositoryForTests()
  })

  it("requires an authenticated admin for reads", async () => {
    expect(await GET(new Request("http://localhost/api/governance/gates"))).toMatchObject({
      status: 401,
    })
    expect(
      await GET(new Request("http://localhost/api/governance/gates", { headers: operatorHeaders }))
    ).toMatchObject({ status: 403 })
  })

  it("returns the empty seven-decision projection to an admin", async () => {
    const response = await GET(
      new Request("http://localhost/api/governance/gates", { headers: adminHeaders })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.decisions).toHaveLength(7)
    expect(body.data.decisions[0].current).toBeNull()
    expect(body.summary).toEqual({ total: 7, active: 0, approvedInPrinciple: 0 })
  })

  it("records the authenticated actor and rejects client-supplied actor fields", async () => {
    const invalid = await POST(
      decisionRequest("O1", "approved_in_principle", 0, { actorId: "spoofed-admin" })
    )
    expect(invalid.status).toBe(400)

    const response = await POST(decisionRequest("O1", "approved_in_principle", 0))
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.data.event).toMatchObject({ actorId: "admin-1", actorRole: "admin", version: 1 })
  })

  it("returns the original event for an identical idempotent retry", async () => {
    const payload = {
      gateId: GATE_ZERO_ID,
      protocolVersion: GATE_ZERO_PROTOCOL_VERSION,
      decisionId: "O2",
      status: "approved_in_principle",
      rationale: "Owner accepted the bounded recommendation.",
      evidenceRefs: [],
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    }
    const makeRequest = () =>
      new Request("http://localhost/api/governance/gates", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify(payload),
      })

    const first = await POST(makeRequest())
    const firstBody = await first.json()
    const retry = await POST(makeRequest())
    const retryBody = await retry.json()

    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    expect(retryBody.summary.created).toBe(false)
    expect(retryBody.data.event.id).toBe(firstBody.data.event.id)
  })

  it("requires approval in principle before activation", async () => {
    const response = await POST(decisionRequest("O3", "active", 0))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ currentStatus: "pending" })
  })

  it("fails O5 activation closed until candidate and evidence references are present", async () => {
    expect(await POST(decisionRequest("O5", "approved_in_principle", 0))).toMatchObject({
      status: 201,
    })

    const blocked = await POST(decisionRequest("O5", "active", 1))
    expect(blocked.status).toBe(422)
    expect(await blocked.json()).toMatchObject({
      missingPrerequisites: ["reviewerCandidateId", "evidenceRefs"],
    })

    const activated = await POST(
      decisionRequest("O5", "active", 1, {
        evidenceRefs: ["restricted-reviewer-record:R1/eligibility-v1"],
        prerequisites: { reviewerCandidateId: "R1" },
      })
    )
    expect(activated.status).toBe(201)
  })

  it("fails O6 activation closed until every governance prerequisite is present", async () => {
    expect(await POST(decisionRequest("O6", "approved_in_principle", 0))).toMatchObject({
      status: 201,
    })
    const blocked = await POST(
      decisionRequest("O6", "active", 1, {
        prerequisites: { restrictedStoreApproved: true },
      })
    )
    expect(blocked.status).toBe(422)
    const body = await blocked.json()
    expect(body.missingPrerequisites).toContain("responsiblePartyId")
    expect(body.missingPrerequisites).toContain("incidentOwnerId")

    const activated = await POST(
      decisionRequest("O6", "active", 1, {
        prerequisites: {
          responsiblePartyId: "responsible-party-1",
          privacyReviewerId: "privacy-reviewer-1",
          researchOwnerId: "research-owner-1",
          restrictedStoreApproved: true,
          authorizedResearcherIds: ["researcher-1"],
          retentionDeletionDeadline: "2026-12-31",
          correctionDeletionOwnerId: "deletion-owner-1",
          incidentOwnerId: "incident-owner-1",
        },
      })
    )
    expect(activated.status).toBe(201)
  })
})
