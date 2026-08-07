import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { withRole } from "@/lib/auth/rbac"
import {
  knowledgeSafeguardProfileRequestSchema,
  projectSafeguardProfiles,
  relaxedBeyondBuiltin,
} from "@/lib/knowledge/safeguard-profile-events"
import {
  KNOWLEDGE_PUBLICATION_SAFEGUARDS,
  NON_WAIVABLE_SAFEGUARD_IDS,
} from "@/lib/knowledge/safeguards"
import { logger } from "@/lib/logger"
import {
  getKnowledgeSafeguardProfileRepository,
  KnowledgeSafeguardProfileConflictError,
  KnowledgeSafeguardProfileIdempotencyError,
  KnowledgeSafeguardProfileStoreUnavailableError,
} from "@/lib/repositories/knowledge-safeguard-profile-repository"

function storeUnavailableResponse() {
  return NextResponse.json(
    { error: "Knowledge safeguard profile datastore is unavailable" },
    { status: 503 }
  )
}

export const GET = withRole("admin")(async () => {
  try {
    const { repository, mode } = await getKnowledgeSafeguardProfileRepository()
    const events = await repository.list()
    const profiles = projectSafeguardProfiles(events)

    return NextResponse.json({
      data: {
        safeguards: KNOWLEDGE_PUBLICATION_SAFEGUARDS,
        nonWaivableSafeguards: NON_WAIVABLE_SAFEGUARD_IDS,
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
    if (error instanceof KnowledgeSafeguardProfileStoreUnavailableError) {
      return storeUnavailableResponse()
    }
    logger.error("Knowledge safeguard profile read failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Failed to load knowledge safeguard profiles" },
      { status: 500 }
    )
  }
})

export const POST = withRole("admin")(async (request, context) => {
  try {
    const parsed = knowledgeSafeguardProfileRequestSchema.parse(await request.json())
    const { repository, mode } = await getKnowledgeSafeguardProfileRepository()
    const result = await repository.append({
      request: parsed,
      actorId: context.userId,
      actorRole: "admin",
    })

    // Relaxing a safeguard is the event worth finding later, so it is logged
    // explicitly rather than left to be reconstructed from the collection.
    if (result.created && parsed.disabledSafeguards.length > 0) {
      logger.warn("Knowledge safeguard profile disabled safeguards", {
        profileId: parsed.profileId,
        disabledSafeguards: parsed.disabledSafeguards,
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
          error: "Invalid knowledge safeguard profile",
          issues: error.issues.map((issue) => issue.path.join(".")),
          messages: error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      )
    }
    if (error instanceof KnowledgeSafeguardProfileStoreUnavailableError) {
      return storeUnavailableResponse()
    }
    if (error instanceof KnowledgeSafeguardProfileConflictError) {
      return NextResponse.json(
        { error: "Knowledge safeguard profile version changed" },
        { status: 409 }
      )
    }
    if (error instanceof KnowledgeSafeguardProfileIdempotencyError) {
      return NextResponse.json({ error: "Idempotency key was reused" }, { status: 409 })
    }
    logger.error("Knowledge safeguard profile mutation failed", {
      traceId: randomUUID(),
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Failed to record knowledge safeguard profile" },
      { status: 500 }
    )
  }
})
