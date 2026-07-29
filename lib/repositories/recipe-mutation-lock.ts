import { randomUUID } from "crypto"
import type { ClientSession, Collection } from "mongodb"
import { getCollection, isMongoConfigured, startMongoSession } from "@/lib/db/mongodb"
import { logger } from "@/lib/logger"

export const RECIPE_MUTATION_LOCK_COLLECTION = "recipe_mutation_locks"

interface RecipeMutationLockDocument {
  _id: string
  ownerToken?: string
  expiresAt: Date
  fence: number
}

const LOCK_LEASE_MS = 60_000
export const RECIPE_MUTATION_LOCK_RENEWAL_MS = 20_000
const inProcessLocks = new Set<string>()

export class RecipeMutationConflictError extends Error {}

export interface RecipeMutationLease {
  assertOwned: () => Promise<void>
  fence?: number
  runFencedWrite: <T>(write: (session?: ClientSession) => Promise<T>) => Promise<T>
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

async function withInProcessLock<T>(
  recipeId: string,
  operation: (lease: RecipeMutationLease) => Promise<T>
): Promise<T> {
  if (inProcessLocks.has(recipeId)) {
    throw new RecipeMutationConflictError("Recipe is being changed by another request")
  }

  inProcessLocks.add(recipeId)
  try {
    return await operation({
      assertOwned: async () => {
        if (!inProcessLocks.has(recipeId)) {
          throw new RecipeMutationConflictError("Recipe mutation lock ownership was lost")
        }
      },
      runFencedWrite: async (write) => write(),
    })
  } finally {
    inProcessLocks.delete(recipeId)
  }
}

async function acquireMongoLock(
  collection: Collection<RecipeMutationLockDocument>,
  recipeId: string,
  ownerToken: string
): Promise<number> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_LEASE_MS)

  try {
    const document = await collection.findOneAndUpdate(
      {
        _id: recipeId,
        $or: [{ expiresAt: { $lte: now } }, { ownerToken }],
      },
      {
        $set: { ownerToken, expiresAt },
        $setOnInsert: { _id: recipeId },
        $inc: { fence: 1 },
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: false }
    )
    if (!document || !Number.isSafeInteger(document.fence) || document.fence < 1) {
      throw new RecipeMutationConflictError("Recipe is being changed by another request")
    }
    return document.fence
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new RecipeMutationConflictError("Recipe is being changed by another request")
    }
    throw error
  }
}

async function renewMongoLock(
  collection: Collection<RecipeMutationLockDocument>,
  recipeId: string,
  ownerToken: string
): Promise<void> {
  const now = new Date()
  const result = await collection.updateOne(
    {
      _id: recipeId,
      ownerToken,
      expiresAt: { $gt: now },
    },
    {
      $set: { expiresAt: new Date(now.getTime() + LOCK_LEASE_MS) },
    }
  )
  if (result.matchedCount !== 1) {
    throw new RecipeMutationConflictError("Recipe mutation lock ownership was lost")
  }
}

export async function withRecipeMutationLock<T>(
  recipeId: string,
  operation: (lease: RecipeMutationLease) => Promise<T>
): Promise<T> {
  const normalizedRecipeId = recipeId.trim()
  if (!normalizedRecipeId) {
    throw new RecipeMutationConflictError("Recipe ID is required for mutation locking")
  }

  const usesInProcessLock =
    process.env.NODE_ENV === "test" ||
    process.env.E2E_TEST === "1" ||
    process.env.CI === "true" ||
    !isMongoConfigured()
  if (usesInProcessLock) return withInProcessLock(normalizedRecipeId, operation)

  const collection = await getCollection<RecipeMutationLockDocument>(
    RECIPE_MUTATION_LOCK_COLLECTION
  )
  const ownerToken = randomUUID()
  const fence = await acquireMongoLock(collection, normalizedRecipeId, ownerToken)

  let renewalFailure: unknown
  let renewalInFlight: Promise<void> | undefined
  let fencedWriteActive = false
  const renewLease = () => {
    if (fencedWriteActive || renewalInFlight || renewalFailure) return
    renewalInFlight = renewMongoLock(collection, normalizedRecipeId, ownerToken)
      .catch((error) => {
        renewalFailure = error
        logger.error("Failed to renew recipe mutation lock", {
          recipeId: normalizedRecipeId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        renewalInFlight = undefined
      })
  }
  const assertOwned = async () => {
    if (renewalInFlight) await renewalInFlight
    if (renewalFailure) throw renewalFailure
    renewLease()
    if (renewalInFlight) await renewalInFlight
    if (renewalFailure) throw renewalFailure
  }
  const runFencedWrite = async <T>(write: (session?: ClientSession) => Promise<T>): Promise<T> => {
    if (fencedWriteActive) {
      throw new RecipeMutationConflictError("A fenced recipe write is already active")
    }
    fencedWriteActive = true
    if (renewalInFlight) await renewalInFlight
    if (renewalFailure) throw renewalFailure

    let session: ClientSession | undefined
    let result: T | undefined
    try {
      session = await startMongoSession()
      await session.withTransaction(async () => {
        const now = new Date()
        const leaseResult = await collection.updateOne(
          {
            _id: normalizedRecipeId,
            ownerToken,
            fence,
            expiresAt: { $gt: now },
          },
          { $set: { expiresAt: new Date(now.getTime() + LOCK_LEASE_MS) } },
          { session }
        )
        if (leaseResult.matchedCount !== 1) {
          throw new RecipeMutationConflictError("Recipe mutation lock ownership was lost")
        }
        result = await write(session)
      })
      return result as T
    } finally {
      if (session) await session.endSession()
      fencedWriteActive = false
    }
  }
  const renewalTimer = setInterval(renewLease, RECIPE_MUTATION_LOCK_RENEWAL_MS)
  renewalTimer.unref?.()

  try {
    const result = await operation({ assertOwned, fence, runFencedWrite })
    if (renewalInFlight) await renewalInFlight
    if (renewalFailure) throw renewalFailure
    return result
  } finally {
    clearInterval(renewalTimer)
    if (renewalInFlight) await renewalInFlight
    await collection
      .updateOne(
        { _id: normalizedRecipeId, ownerToken },
        { $set: { expiresAt: new Date(0) }, $unset: { ownerToken: "" } }
      )
      .catch((error) => {
        logger.error("Failed to release recipe mutation lock", {
          recipeId: normalizedRecipeId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }
}

export function resetRecipeMutationLocksForTests(): void {
  inProcessLocks.clear()
}
