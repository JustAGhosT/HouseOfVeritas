import { createHash, randomUUID } from "crypto"
import type { Collection } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import { logger } from "@/lib/logger"
import {
  resolveEffectiveProfile,
  type KnowledgeSafeguardProfileEvent,
  type KnowledgeSafeguardProfileRequest,
} from "@/lib/knowledge/safeguard-profile-events"
import {
  STRICT_SAFEGUARD_PROFILE,
  type KnowledgeSafeguardProfile,
  type KnowledgeSafeguardProfileSource,
} from "@/lib/knowledge/safeguards"

/**
 * Append-only store for knowledge safeguard profile changes.
 *
 * Deliberately its own collection rather than sharing `gate_governance_events`:
 * that collection carries the Gate 0 O1-O7 decision state machine and is
 * uniquely indexed on `(gateId, protocolVersion, decisionId, version)`. Knowledge
 * profiles have a different shape and an open-ended lifecycle, and mixing them
 * would force the Gate 0 projection to filter foreign events.
 */

const COLLECTION_NAME = "knowledge_safeguard_profile_events"

export class KnowledgeSafeguardProfileConflictError extends Error {}
export class KnowledgeSafeguardProfileIdempotencyError extends Error {}
export class KnowledgeSafeguardProfileStoreUnavailableError extends Error {}

const UNAVAILABLE_ERROR_NAMES = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongoTopologyClosedError",
  "MongoNotConnectedError",
])

function isStoreUnavailableError(error: unknown): boolean {
  return error instanceof Error && UNAVAILABLE_ERROR_NAMES.has(error.name)
}

async function withStoreAvailability<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (isStoreUnavailableError(error)) {
      throw new KnowledgeSafeguardProfileStoreUnavailableError(
        error instanceof Error
          ? error.message
          : "Knowledge safeguard profile datastore is unreachable"
      )
    }
    throw error
  }
}

export interface AppendSafeguardProfileInput {
  request: KnowledgeSafeguardProfileRequest
  actorId: string
  actorRole: "admin"
  createdAt?: string
}

export interface AppendSafeguardProfileResult {
  event: KnowledgeSafeguardProfileEvent
  created: boolean
}

export interface KnowledgeSafeguardProfileRepository {
  list(): Promise<KnowledgeSafeguardProfileEvent[]>
  append(input: AppendSafeguardProfileInput): Promise<AppendSafeguardProfileResult>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fingerprint(request: KnowledgeSafeguardProfileRequest): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex")
}

function createEvent(input: AppendSafeguardProfileInput): KnowledgeSafeguardProfileEvent {
  return {
    ...clone(input.request),
    id: randomUUID(),
    version: input.request.expectedVersion + 1,
    actorId: input.actorId,
    actorRole: input.actorRole,
    createdAt: input.createdAt ?? new Date().toISOString(),
    requestFingerprint: fingerprint(input.request),
  }
}

let memoryEvents: KnowledgeSafeguardProfileEvent[] = []

const memoryRepository: KnowledgeSafeguardProfileRepository = {
  async list() {
    return memoryEvents
      .slice()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone)
  },
  async append(input) {
    const requestFingerprint = fingerprint(input.request)
    const idempotent = memoryEvents.find(
      (event) => event.idempotencyKey === input.request.idempotencyKey
    )
    if (idempotent) {
      if (idempotent.requestFingerprint !== requestFingerprint) {
        throw new KnowledgeSafeguardProfileIdempotencyError("Idempotency key was reused")
      }
      return { event: clone(idempotent), created: false }
    }

    const currentVersion = memoryEvents
      .filter((event) => event.profileId === input.request.profileId)
      .reduce((maximum, event) => Math.max(maximum, event.version), 0)

    if (currentVersion !== input.request.expectedVersion) {
      throw new KnowledgeSafeguardProfileConflictError("Profile version changed")
    }

    const event = createEvent(input)
    memoryEvents.push(event)
    return { event: clone(event), created: true }
  },
}

async function createMongoRepository(): Promise<KnowledgeSafeguardProfileRepository> {
  const collection: Collection<KnowledgeSafeguardProfileEvent> = await withStoreAvailability(() =>
    getCollection<KnowledgeSafeguardProfileEvent>(COLLECTION_NAME)
  )
  await withStoreAvailability(() =>
    Promise.all([
      collection.createIndex({ id: 1 }, { unique: true }),
      collection.createIndex({ idempotencyKey: 1 }, { unique: true }),
      collection.createIndex({ profileId: 1, version: 1 }, { unique: true }),
    ])
  )

  return {
    async list() {
      const documents = await withStoreAvailability(() =>
        collection.find({}).sort({ createdAt: 1 }).toArray()
      )
      return documents.map(withoutMongoId)
    },
    async append(input) {
      const requestFingerprint = fingerprint(input.request)
      const idempotent = await withStoreAvailability(() =>
        collection.findOne({ idempotencyKey: input.request.idempotencyKey })
      )
      if (idempotent) {
        if (idempotent.requestFingerprint !== requestFingerprint) {
          throw new KnowledgeSafeguardProfileIdempotencyError("Idempotency key was reused")
        }
        return { event: withoutMongoId(idempotent), created: false }
      }

      const current = await withStoreAvailability(() =>
        collection.findOne({ profileId: input.request.profileId }, { sort: { version: -1 } })
      )
      if ((current?.version ?? 0) !== input.request.expectedVersion) {
        throw new KnowledgeSafeguardProfileConflictError("Profile version changed")
      }

      const event = createEvent(input)
      try {
        await withStoreAvailability(() => collection.insertOne(event))
        return { event, created: true }
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          const retry = await withStoreAvailability(() =>
            collection.findOne({ idempotencyKey: input.request.idempotencyKey })
          )
          if (retry) {
            if (retry.requestFingerprint !== requestFingerprint) {
              throw new KnowledgeSafeguardProfileIdempotencyError("Idempotency key was reused")
            }
            return { event: withoutMongoId(retry), created: false }
          }
          throw new KnowledgeSafeguardProfileConflictError("Profile version changed")
        }
        throw error
      }
    },
  }
}

let cachedRepository: KnowledgeSafeguardProfileRepository | null = null
let cachedMode: "mongodb" | "memory" | null = null

export async function getKnowledgeSafeguardProfileRepository(): Promise<{
  repository: KnowledgeSafeguardProfileRepository
  mode: "mongodb" | "memory"
}> {
  if (cachedRepository && cachedMode) return { repository: cachedRepository, mode: cachedMode }

  const testMode = process.env.NODE_ENV === "test" || process.env.E2E_TEST === "1"
  if (testMode) {
    cachedRepository = memoryRepository
    cachedMode = "memory"
    return { repository: cachedRepository, mode: cachedMode }
  }

  if (!isMongoConfigured()) {
    throw new KnowledgeSafeguardProfileStoreUnavailableError(
      "Knowledge safeguard profile datastore is not configured"
    )
  }

  cachedRepository = await createMongoRepository()
  cachedMode = "mongodb"
  return { repository: cachedRepository, mode: cachedMode }
}

/**
 * The profile the evaluator should use right now, for callers that safeguard content.
 *
 * Unlike the admin route, this NEVER throws on an unreachable store: it falls
 * back to `strict` and reports `builtin-fallback`. Refusing to evaluate would
 * not be safer — it would just move the failure — whereas running every safeguard is
 * the strictest available answer. The source is returned so the caller can
 * record that a configured relaxation was not applied.
 */
export async function loadEffectiveSafeguardProfile(
  profileId: string,
  /** Injectable so the outage path is testable — the memory store always answers. */
  loadEvents: () => Promise<KnowledgeSafeguardProfileEvent[]> = async () => {
    const { repository } = await getKnowledgeSafeguardProfileRepository()
    return repository.list()
  }
): Promise<{
  profile: KnowledgeSafeguardProfile
  source: KnowledgeSafeguardProfileSource
}> {
  try {
    const { profile, source, sanitizedSafeguards } = resolveEffectiveProfile(
      profileId,
      await loadEvents()
    )
    if (sanitizedSafeguards.length > 0) {
      // Only reachable if a record bypassed the request schema, so this is a
      // datastore-integrity alarm, not routine.
      logger.error("Stored safeguard profile tried to waive a non-waivable safeguard", {
        profileId,
        sanitizedSafeguards,
      })
    }
    return { profile, source }
  } catch (error) {
    // Narrow: an unreachable store is an expected operating condition, but a
    // bug in resolution is not. Swallowing everything would report programmer
    // errors as an outage and hide them behind a silently stricter profile.
    if (!(error instanceof KnowledgeSafeguardProfileStoreUnavailableError)) throw error
    logger.warn("Knowledge safeguard profile store unavailable; falling back to strict", {
      profileId,
      error: error.message,
    })
    return { profile: STRICT_SAFEGUARD_PROFILE, source: "builtin-fallback" }
  }
}

export function resetKnowledgeSafeguardProfileRepositoryForTests(): void {
  memoryEvents = []
  cachedRepository = null
  cachedMode = null
}
