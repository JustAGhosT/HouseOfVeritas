import { createHash, randomUUID } from "crypto"
import type { Collection } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import {
  resolveEffectiveProfile,
  type KnowledgeGateProfileEvent,
  type KnowledgeGateProfileRequest,
} from "@/lib/knowledge/gate-profile-events"
import {
  STRICT_GATE_PROFILE,
  type KnowledgeGateProfile,
  type KnowledgeGateProfileSource,
} from "@/lib/knowledge/gates"

/**
 * Append-only store for knowledge gate profile changes.
 *
 * Deliberately its own collection rather than sharing `gate_governance_events`:
 * that collection carries the Gate 0 O1-O7 decision state machine and is
 * uniquely indexed on `(gateId, protocolVersion, decisionId, version)`. Knowledge
 * profiles have a different shape and an open-ended lifecycle, and mixing them
 * would force the Gate 0 projection to filter foreign events.
 */

const COLLECTION_NAME = "knowledge_gate_profile_events"

export class KnowledgeGateProfileConflictError extends Error {}
export class KnowledgeGateProfileIdempotencyError extends Error {}
export class KnowledgeGateProfileStoreUnavailableError extends Error {}

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
      throw new KnowledgeGateProfileStoreUnavailableError(
        error instanceof Error ? error.message : "Knowledge gate profile datastore is unreachable"
      )
    }
    throw error
  }
}

export interface AppendGateProfileInput {
  request: KnowledgeGateProfileRequest
  actorId: string
  actorRole: "admin"
  createdAt?: string
}

export interface AppendGateProfileResult {
  event: KnowledgeGateProfileEvent
  created: boolean
}

export interface KnowledgeGateProfileRepository {
  list(): Promise<KnowledgeGateProfileEvent[]>
  append(input: AppendGateProfileInput): Promise<AppendGateProfileResult>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fingerprint(request: KnowledgeGateProfileRequest): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex")
}

function createEvent(input: AppendGateProfileInput): KnowledgeGateProfileEvent {
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

let memoryEvents: KnowledgeGateProfileEvent[] = []

const memoryRepository: KnowledgeGateProfileRepository = {
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
        throw new KnowledgeGateProfileIdempotencyError("Idempotency key was reused")
      }
      return { event: clone(idempotent), created: false }
    }

    const currentVersion = memoryEvents
      .filter((event) => event.profileId === input.request.profileId)
      .reduce((maximum, event) => Math.max(maximum, event.version), 0)

    if (currentVersion !== input.request.expectedVersion) {
      throw new KnowledgeGateProfileConflictError("Profile version changed")
    }

    const event = createEvent(input)
    memoryEvents.push(event)
    return { event: clone(event), created: true }
  },
}

async function createMongoRepository(): Promise<KnowledgeGateProfileRepository> {
  const collection: Collection<KnowledgeGateProfileEvent> = await withStoreAvailability(() =>
    getCollection<KnowledgeGateProfileEvent>(COLLECTION_NAME)
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
          throw new KnowledgeGateProfileIdempotencyError("Idempotency key was reused")
        }
        return { event: withoutMongoId(idempotent), created: false }
      }

      const current = await withStoreAvailability(() =>
        collection.findOne({ profileId: input.request.profileId }, { sort: { version: -1 } })
      )
      if ((current?.version ?? 0) !== input.request.expectedVersion) {
        throw new KnowledgeGateProfileConflictError("Profile version changed")
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
              throw new KnowledgeGateProfileIdempotencyError("Idempotency key was reused")
            }
            return { event: withoutMongoId(retry), created: false }
          }
          throw new KnowledgeGateProfileConflictError("Profile version changed")
        }
        throw error
      }
    },
  }
}

let cachedRepository: KnowledgeGateProfileRepository | null = null
let cachedMode: "mongodb" | "memory" | null = null

export async function getKnowledgeGateProfileRepository(): Promise<{
  repository: KnowledgeGateProfileRepository
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
    throw new KnowledgeGateProfileStoreUnavailableError(
      "Knowledge gate profile datastore is not configured"
    )
  }

  cachedRepository = await createMongoRepository()
  cachedMode = "mongodb"
  return { repository: cachedRepository, mode: cachedMode }
}

/**
 * The profile the evaluator should use right now, for callers that gate content.
 *
 * Unlike the admin route, this NEVER throws on an unreachable store: it falls
 * back to `strict` and reports `builtin-fallback`. Refusing to evaluate would
 * not be safer — it would just move the failure — whereas running every gate is
 * the strictest available answer. The source is returned so the caller can
 * record that a configured relaxation was not applied.
 */
export async function loadEffectiveGateProfile(
  profileId: string,
  /** Injectable so the outage path is testable — the memory store always answers. */
  loadEvents: () => Promise<KnowledgeGateProfileEvent[]> = async () => {
    const { repository } = await getKnowledgeGateProfileRepository()
    return repository.list()
  }
): Promise<{
  profile: KnowledgeGateProfile
  source: KnowledgeGateProfileSource
}> {
  try {
    return resolveEffectiveProfile(profileId, await loadEvents())
  } catch {
    return { profile: STRICT_GATE_PROFILE, source: "builtin-fallback" }
  }
}

export function resetKnowledgeGateProfileRepositoryForTests(): void {
  memoryEvents = []
  cachedRepository = null
  cachedMode = null
}
