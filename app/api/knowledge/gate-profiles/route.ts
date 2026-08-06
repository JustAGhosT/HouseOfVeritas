import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { withRole } from "@/lib/auth/rbac"
import {
  knowledgeGateProfileRequestSchema,
  projectGateProfiles,
  relaxedBeyondBuiltin,
} from "@/lib/knowledge/gate-profile-events"
import { KNOWLEDGE_PUBLICATION_GATES, NON_WAIVABLE_GATE_IDS } from "@/lib/knowledge/gates"
import { logger } from "@/lib/logger"
import {
  getKnowledgeGateProfileRepository,
  KnowledgeGateProfileConflictError,
  KnowledgeGateProfileIdempotencyError,
  KnowledgeGateProfileStoreUnavailableError,
} from "@/lib/repositories/knowledge-gate-profile-repository"

function storeUnavailableResponse() {
  return NextResponse.json(
    { error: "Knowledge gate profile datastore is unavailable" },
    { status: 503 }
  )
}

export const GET = withRole("admin")(async () => {
  try {
    const { repository, mode } = await getKnowledgeGateProfileRepository()
    const events = await repository.list()
    const profiles = projectGateProfiles(events)

    return NextResponse.json({
      data: {
        gates: KNOWLEDGE_PUBLICATION_GATES,
        nonWaivableGates: NON_WAIVABLE_GATE_IDS,
        profiles: profiles.map((profile) => ({
          ...profile,
          relaxedBeyondBuiltin: relaxedBeyondBuiltin(profile),
        })),
        storage: mode,
      },
      summary: {
        total: profiles.length,
        stored: profiles.filter((profile) => profile.source === "stored").length,
        deviating: profiles.filter((profile) => profile.deviatesFromBuiltin).length,
      },
    })
  } catch (error) {
    if (error instanceof KnowledgeGateProfileStoreUnavailableError) {
      return storeUnavailableResponse()
    }
    logger.error("Knowledge gate profile read failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to load knowledge gate profiles" }, { status: 500 })
  }
})

export const POST = withRole("admin")(async (request, context) => {
  try {
    const parsed = knowledgeGateProfileRequestSchema.parse(await request.json())
    const { repository, mode } = await getKnowledgeGateProfileRepository()
    const result = await repository.append({
      request: parsed,
      actorId: context.userId,
      actorRole: "admin",
    })

    // Relaxing a gate is the event worth finding later, so it is logged
    // explicitly rather than left to be reconstructed from the collection.
    if (result.created && parsed.disabledGates.length > 0) {
      logger.warn("Knowledge gate profile disabled gates", {
        profileId: parsed.profileId,
        disabledGates: parsed.disabledGates,
        version: result.event.version,
        actorId: context.userId,
      })
    }

    return NextResponse.json(
      { data: { event: result.event, storage: mode }, summary: { created: result.created } },
      { status: result.created ? 201 : 200 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid knowledge gate profile",
          issues: error.issues.map((issue) => issue.path.join(".")),
          messages: error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      )
    }
    if (error instanceof KnowledgeGateProfileStoreUnavailableError) {
      return storeUnavailableResponse()
    }
    if (error instanceof KnowledgeGateProfileConflictError) {
      return NextResponse.json({ error: "Knowledge gate profile version changed" }, { status: 409 })
    }
    if (error instanceof KnowledgeGateProfileIdempotencyError) {
      return NextResponse.json({ error: "Idempotency key was reused" }, { status: 409 })
    }
    logger.error("Knowledge gate profile mutation failed", {
      traceId: randomUUID(),
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to record knowledge gate profile" }, { status: 500 })
  }
})
