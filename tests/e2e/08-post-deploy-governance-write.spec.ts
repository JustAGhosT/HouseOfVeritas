import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test"
import { seedSession } from "./helpers/auth"
import { productionSessionCookies, type SessionCookie } from "./helpers/production-session"

/**
 * Durable-write acceptance for the Gate governance store.
 *
 * This is the only probe in the suite that MUTATES production. It appends one
 * real, append-only governance record, so the decision it records is supplied by
 * the operator at run time rather than hardcoded here — a probe must not assert a
 * governance position on the owner's behalf.
 *
 * Supply POST_DEPLOY_GOVERNANCE_DECISION as JSON, e.g.
 *   {"decisionId":"O1","status":"approved_in_principle","rationale":"...","evidenceRefs":[]}
 * Without it the probe skips rather than inventing a decision.
 *
 * Exactly one new record is written. The idempotent replay returns the existing
 * event, and the stale-version case is rejected before any insert, so neither
 * adds history.
 *
 * Restart persistence is deliberately NOT covered here: it needs an app restart
 * between two reads, which is an operator step outside a single Playwright run.
 * Re-running the read-only assertions after a restart completes that leg.
 */
const baseUrl = process.env.BASE_URL
const isPostDeployProbe = process.env.POST_DEPLOY_PROBE === "true"
const adminSessionCookies = productionSessionCookies("admin")

const GATE_ID = "under-sink-leak-gate-0"
const PROTOCOL_VERSION = "v1-draft"

type OperatorDecision = {
  decisionId: "O1" | "O2" | "O3" | "O4" | "O7"
  status: "approved_in_principle" | "rejected" | "superseded"
  rationale: string
  evidenceRefs?: string[]
}

/**
 * Reject anything that could activate a decision or touch the reviewer (O5) and
 * privacy-protocol (O6) decisions, whose activation carries recruitment and
 * personal-data consequences. Those must stay inactive, so this probe refuses
 * them outright rather than relying on the server to fail closed.
 */
function parseOperatorDecision(): OperatorDecision | null {
  const raw = process.env.POST_DEPLOY_GOVERNANCE_DECISION
  if (!raw) return null

  const parsed = JSON.parse(raw) as OperatorDecision

  if (parsed.decisionId === ("O5" as string) || parsed.decisionId === ("O6" as string)) {
    throw new Error(
      "This probe refuses O5 and O6. Activating either has recruitment or personal-data consequences and must not be driven by an automated probe."
    )
  }
  if ((parsed.status as string) === "active") {
    throw new Error(
      "This probe refuses status 'active'. Activation must never be triggered automatically."
    )
  }
  if (!parsed.rationale || parsed.rationale.trim().length < 3) {
    throw new Error("A rationale is required so the recorded decision is self-explaining.")
  }

  return parsed
}

const operatorDecision = (() => {
  try {
    return parseOperatorDecision()
  } catch (error) {
    // Surface a misconfigured decision as a failure at run time, not a silent skip.
    return error as Error
  }
})()

async function addSessionCookies(context: BrowserContext, sessionCookies: SessionCookie[]) {
  const hostname = new URL(baseUrl!).hostname
  await context.addCookies(
    sessionCookies.map(({ name, value }) => ({
      name,
      value,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }))
  )
}

async function readDecision(request: APIRequestContext, decisionId: string) {
  const response = await request.get("/api/governance/gates")
  expect(
    response.status(),
    "Governance read must succeed before a write is attempted. 503 means the datastore is unreachable — stop and fix that first."
  ).toBe(200)

  const body = await response.json()
  const projection = body.data.decisions.find(
    (entry: { definition: { id: string } }) => entry.definition.id === decisionId
  )
  expect(projection, `Decision ${decisionId} must exist in the projection`).toBeTruthy()
  return projection as { current: { version: number; id: string; status: string } | null }
}

test.describe("Post-deployment Gate governance durable write", () => {
  test.skip(
    !isPostDeployProbe || !baseUrl || adminSessionCookies.length === 0,
    "Requires POST_DEPLOY_PROBE, BASE_URL, and a legitimate short-lived admin session."
  )
  test.skip(
    operatorDecision === null,
    "Requires POST_DEPLOY_GOVERNANCE_DECISION describing the decision the owner is recording."
  )

  test.beforeEach(async ({ context }) => {
    if (isPostDeployProbe) {
      await addSessionCookies(context, adminSessionCookies)
      return
    }
    await seedSession(context, { id: "hans", role: "admin", email: "admin@example.invalid" })
  })

  test("persists an appended decision and survives a re-read", async ({ page }) => {
    if (operatorDecision instanceof Error) throw operatorDecision
    const decision = operatorDecision!

    const before = await readDecision(page.request, decision.decisionId)
    const expectedVersion = before.current?.version ?? 0
    const idempotencyKey = crypto.randomUUID()

    const body = {
      gateId: GATE_ID,
      protocolVersion: PROTOCOL_VERSION,
      decisionId: decision.decisionId,
      status: decision.status,
      rationale: decision.rationale,
      evidenceRefs: decision.evidenceRefs ?? [],
      expectedVersion,
      idempotencyKey,
    }

    // 1. Append — the single mutating call in this suite.
    const created = await page.request.post("/api/governance/gates", { data: body })
    expect(created.status(), await created.text()).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.summary.created).toBe(true)
    expect(createdBody.data.storage).toBe("mongodb")
    expect(createdBody.data.event.version).toBe(expectedVersion + 1)
    // The actor must come from the session, never from the request body.
    expect(createdBody.data.event.actorRole).toBe("admin")
    expect(createdBody.data.event.actorId).toBeTruthy()

    // 2. Durable read-back through a fresh request.
    const after = await readDecision(page.request, decision.decisionId)
    expect(after.current?.version).toBe(expectedVersion + 1)
    expect(after.current?.status).toBe(decision.status)
    expect(after.current?.id).toBe(createdBody.data.event.id)

    // 3. Idempotent replay must return the same event and write nothing new.
    const replay = await page.request.post("/api/governance/gates", { data: body })
    expect(replay.status()).toBe(200)
    const replayBody = await replay.json()
    expect(replayBody.summary.created).toBe(false)
    expect(replayBody.data.event.id).toBe(createdBody.data.event.id)

    // 4. A stale expectedVersion must be rejected before any insert.
    const stale = await page.request.post("/api/governance/gates", {
      data: { ...body, expectedVersion, idempotencyKey: crypto.randomUUID() },
    })
    expect(stale.status()).toBe(409)

    // 5. History grew by exactly one.
    const final = await readDecision(page.request, decision.decisionId)
    expect(final.current?.version).toBe(expectedVersion + 1)
    expect(final.current?.id).toBe(createdBody.data.event.id)
  })
})
