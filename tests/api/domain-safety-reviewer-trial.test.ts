import { describe, expect, it } from "vitest"
import { GET, POST } from "@/app/api/reviewer-trials/domain-safety/route"
import {
  DOMAIN_SAFETY_CRITICAL_GATES,
  DOMAIN_SAFETY_QUALITY_DIMENSIONS,
} from "@/lib/reviewer-trials/domain-safety-trial"

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

function body() {
  return {
    schemaVersion: "domain-reviewer-lab-v1",
    mode: "synthetic_rehearsal",
    candidateId: "DSR-SIM-001",
    packVersion: "DSR-SYNTH-001-v1",
    profileVersion: "za-domestic-drainage-v1",
    variant: "B",
    dataClass: "synthetic",
    pirbVerification: { mode: "manual_preview_only", status: "not_performed" },
    externalEffects: {
      contacted: false,
      invited: false,
      recorded: false,
      paid: false,
      posted: false,
      productionAccess: false,
      registryCall: false,
    },
    criticalGates: Object.fromEntries(DOMAIN_SAFETY_CRITICAL_GATES.map(({ id }) => [id, "pass"])),
    qualityDimensions: Object.fromEntries(
      DOMAIN_SAFETY_QUALITY_DIMENSIONS.map(({ id }) => [id, "clear"])
    ),
    finding: null,
  }
}

function post(payload: unknown, headers = adminHeaders) {
  return POST(
    new Request("http://localhost/api/reviewer-trials/domain-safety", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
  )
}

describe("/api/reviewer-trials/domain-safety", () => {
  it("requires an authenticated admin", async () => {
    expect(
      await GET(new Request("http://localhost/api/reviewer-trials/domain-safety"))
    ).toMatchObject({ status: 401 })
    expect(
      await GET(
        new Request("http://localhost/api/reviewer-trials/domain-safety", {
          headers: operatorHeaders,
        })
      )
    ).toMatchObject({ status: 403 })
  })

  it("returns the synthetic contract without performing PIRB verification", async () => {
    const response = await GET(
      new Request("http://localhost/api/reviewer-trials/domain-safety", { headers: adminHeaders })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        packVersion: "DSR-SYNTH-001-v1",
        provider: {
          id: "pirb",
          integrationStatus: "manual_preview_only",
          verificationPerformed: false,
        },
      },
      summary: { persisted: false, externalEffects: false, o5Activation: false },
    })
  })

  it("evaluates a bounded rehearsal without persistence or eligibility claims", async () => {
    const response = await post(body())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        evaluation: {
          disposition: "ready_for_internal_replay",
          pirbEligibility: "not_evaluated",
          o5Activation: false,
          persisted: false,
        },
      },
      summary: { accepted: true, persisted: false, externalEffects: false },
    })
  })

  it("fails closed on restricted fields or attempted registry calls", async () => {
    const restricted = await post({ ...body(), candidateName: "Prohibited" })
    expect(restricted.status).toBe(400)
    expect(await restricted.json()).toMatchObject({
      error: "Restricted reviewer data is prohibited",
      prohibitedKey: "$.candidateName",
    })

    const external = body()
    external.externalEffects.registryCall = true
    const externalResponse = await post(external)
    expect(externalResponse.status).toBe(400)
    expect(await externalResponse.json()).toMatchObject({
      error: "Invalid synthetic reviewer rehearsal",
    })
  })

  it("returns a bounded client error for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/reviewer-trials/domain-safety", {
        method: "POST",
        headers: adminHeaders,
        body: "{",
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid JSON body" })
  })
})
