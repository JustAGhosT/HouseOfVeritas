import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { withRole } from "@/lib/auth/rbac"
import {
  GATE_ZERO_DECISIONS,
  GATE_ZERO_ID,
  GATE_ZERO_PROTOCOL_VERSION,
  gateDecisionRequestSchema,
  getMissingActivationPrerequisites,
  isAllowedTransition,
  type GateDecisionEvent,
  type GateDecisionProjection,
} from "@/lib/governance/gate-definitions"
import { logger } from "@/lib/logger"
import {
  GateGovernanceConflictError,
  GateGovernanceIdempotencyError,
  GateGovernanceStoreUnavailableError,
  getGateGovernanceRepository,
} from "@/lib/repositories/gate-governance-repository"

function projectDecisions(events: GateDecisionEvent[]): GateDecisionProjection[] {
  return GATE_ZERO_DECISIONS.map((definition) => {
    const history = events.filter((event) => event.decisionId === definition.id)
    const current = history.at(-1) ?? null
    return {
      definition,
      current,
      history,
      missingPrerequisites: current ? getMissingActivationPrerequisites(current) : [],
    }
  })
}

function storeUnavailableResponse() {
  return NextResponse.json({ error: "Gate governance datastore is unavailable" }, { status: 503 })
}

export const GET = withRole("admin")(async () => {
  try {
    const { repository, mode } = await getGateGovernanceRepository()
    const events = await repository.list(GATE_ZERO_ID, GATE_ZERO_PROTOCOL_VERSION)
    const decisions = projectDecisions(events)
    return NextResponse.json({
      data: {
        gate: {
          id: GATE_ZERO_ID,
          name: "Under-sink leak Gate 0",
          protocolVersion: GATE_ZERO_PROTOCOL_VERSION,
        },
        decisions,
        storage: mode,
      },
      summary: {
        total: decisions.length,
        active: decisions.filter((decision) => decision.current?.status === "active").length,
        approvedInPrinciple: decisions.filter(
          (decision) => decision.current?.status === "approved_in_principle"
        ).length,
      },
    })
  } catch (error) {
    if (error instanceof GateGovernanceStoreUnavailableError) return storeUnavailableResponse()
    logger.error("Gate governance read failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to load Gate decisions" }, { status: 500 })
  }
})

export const POST = withRole("admin")(async (request, context) => {
  try {
    const parsed = gateDecisionRequestSchema.parse(await request.json())
    const { repository, mode } = await getGateGovernanceRepository()
    const events = await repository.list(parsed.gateId, parsed.protocolVersion)
    if (events.some((event) => event.idempotencyKey === parsed.idempotencyKey)) {
      const result = await repository.append({
        request: parsed,
        actorId: context.userId,
        actorRole: "admin",
      })
      return NextResponse.json({
        data: { event: result.event, storage: mode },
        summary: { created: false },
      })
    }

    const current = events
      .filter((event) => event.decisionId === parsed.decisionId)
      .sort((left, right) => left.version - right.version)
      .at(-1)

    if (!isAllowedTransition(current?.status ?? null, parsed.status)) {
      return NextResponse.json(
        { error: "Invalid Gate decision transition", currentStatus: current?.status ?? "pending" },
        { status: 409 }
      )
    }

    if (parsed.status === "active") {
      const missingPrerequisites = getMissingActivationPrerequisites(parsed)
      if (missingPrerequisites.length > 0) {
        return NextResponse.json(
          { error: "Activation prerequisites are incomplete", missingPrerequisites },
          { status: 422 }
        )
      }
    }

    const result = await repository.append({
      request: parsed,
      actorId: context.userId,
      actorRole: "admin",
    })
    return NextResponse.json(
      {
        data: { event: result.event, storage: mode },
        summary: { created: result.created },
      },
      { status: result.created ? 201 : 200 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid Gate decision",
          issues: error.issues.map((issue) => issue.path.join(".")),
        },
        { status: 400 }
      )
    }
    if (error instanceof GateGovernanceStoreUnavailableError) return storeUnavailableResponse()
    if (error instanceof GateGovernanceConflictError) {
      return NextResponse.json({ error: "Gate decision version changed" }, { status: 409 })
    }
    if (error instanceof GateGovernanceIdempotencyError) {
      return NextResponse.json({ error: "Idempotency key was reused" }, { status: 409 })
    }
    logger.error("Gate governance mutation failed", {
      traceId: randomUUID(),
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to record Gate decision" }, { status: 500 })
  }
})
