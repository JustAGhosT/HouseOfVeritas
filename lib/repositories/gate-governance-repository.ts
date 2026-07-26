import { createHash, randomUUID } from "crypto"
import type { Collection } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import type { GateDecisionEvent, GateDecisionRequest } from "@/lib/governance/gate-definitions"

const COLLECTION_NAME = "gate_governance_events"

export class GateGovernanceConflictError extends Error {}
export class GateGovernanceIdempotencyError extends Error {}
export class GateGovernanceStoreUnavailableError extends Error {}

export interface AppendGateDecisionInput {
  request: GateDecisionRequest
  actorId: string
  actorRole: "admin"
  createdAt?: string
}

export interface AppendGateDecisionResult {
  event: GateDecisionEvent
  created: boolean
}

export interface GateGovernanceRepository {
  list(
    gateId: GateDecisionEvent["gateId"],
    protocolVersion: GateDecisionEvent["protocolVersion"]
  ): Promise<GateDecisionEvent[]>
  append(input: AppendGateDecisionInput): Promise<AppendGateDecisionResult>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fingerprintGateDecision(request: GateDecisionRequest): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex")
}

function createEvent(input: AppendGateDecisionInput): GateDecisionEvent {
  return {
    ...clone(input.request),
    id: randomUUID(),
    version: input.request.expectedVersion + 1,
    actorId: input.actorId,
    actorRole: input.actorRole,
    createdAt: input.createdAt ?? new Date().toISOString(),
    requestFingerprint: fingerprintGateDecision(input.request),
  }
}

let memoryEvents: GateDecisionEvent[] = []

const memoryRepository: GateGovernanceRepository = {
  async list(gateId, protocolVersion) {
    return memoryEvents
      .filter((event) => event.gateId === gateId && event.protocolVersion === protocolVersion)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone)
  },
  async append(input) {
    const fingerprint = fingerprintGateDecision(input.request)
    const idempotent = memoryEvents.find(
      (event) => event.idempotencyKey === input.request.idempotencyKey
    )
    if (idempotent) {
      if (idempotent.requestFingerprint !== fingerprint) {
        throw new GateGovernanceIdempotencyError("Idempotency key was reused")
      }
      return { event: clone(idempotent), created: false }
    }

    const currentVersion = memoryEvents
      .filter(
        (event) =>
          event.gateId === input.request.gateId &&
          event.protocolVersion === input.request.protocolVersion &&
          event.decisionId === input.request.decisionId
      )
      .reduce((maximum, event) => Math.max(maximum, event.version), 0)

    if (currentVersion !== input.request.expectedVersion) {
      throw new GateGovernanceConflictError("Decision version changed")
    }

    const event = createEvent(input)
    memoryEvents.push(event)
    return { event: clone(event), created: true }
  },
}

async function createMongoRepository(): Promise<GateGovernanceRepository> {
  const collection: Collection<GateDecisionEvent> =
    await getCollection<GateDecisionEvent>(COLLECTION_NAME)
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ idempotencyKey: 1 }, { unique: true }),
    collection.createIndex(
      { gateId: 1, protocolVersion: 1, decisionId: 1, version: 1 },
      { unique: true }
    ),
  ])

  return {
    async list(gateId, protocolVersion) {
      const documents = await collection
        .find({ gateId, protocolVersion })
        .sort({ createdAt: 1 })
        .toArray()
      return documents.map(withoutMongoId)
    },
    async append(input) {
      const fingerprint = fingerprintGateDecision(input.request)
      const idempotent = await collection.findOne({
        idempotencyKey: input.request.idempotencyKey,
      })
      if (idempotent) {
        if (idempotent.requestFingerprint !== fingerprint) {
          throw new GateGovernanceIdempotencyError("Idempotency key was reused")
        }
        return { event: withoutMongoId(idempotent), created: false }
      }

      const current = await collection.findOne(
        {
          gateId: input.request.gateId,
          protocolVersion: input.request.protocolVersion,
          decisionId: input.request.decisionId,
        },
        { sort: { version: -1 } }
      )
      if ((current?.version ?? 0) !== input.request.expectedVersion) {
        throw new GateGovernanceConflictError("Decision version changed")
      }

      const event = createEvent(input)
      try {
        await collection.insertOne(event)
        return { event, created: true }
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          const retry = await collection.findOne({
            idempotencyKey: input.request.idempotencyKey,
          })
          if (retry) {
            if (retry.requestFingerprint !== fingerprint) {
              throw new GateGovernanceIdempotencyError("Idempotency key was reused")
            }
            return { event: withoutMongoId(retry), created: false }
          }
          throw new GateGovernanceConflictError("Decision version changed")
        }
        throw error
      }
    },
  }
}

let cachedRepository: GateGovernanceRepository | null = null
let cachedMode: "mongodb" | "memory" | null = null

export async function getGateGovernanceRepository(): Promise<{
  repository: GateGovernanceRepository
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
    throw new GateGovernanceStoreUnavailableError("Gate governance datastore is not configured")
  }

  cachedRepository = await createMongoRepository()
  cachedMode = "mongodb"
  return { repository: cachedRepository, mode: cachedMode }
}

export function resetGateGovernanceRepositoryForTests(): void {
  memoryEvents = []
  cachedRepository = null
  cachedMode = null
}
