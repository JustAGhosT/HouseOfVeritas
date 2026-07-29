import { randomUUID } from "crypto"
import type { Collection } from "mongodb"
import { getCollection, isMongoConfigured } from "@/lib/db/mongodb"
import { logger } from "@/lib/logger"

export const RECIPE_MUTATION_LOCK_COLLECTION = "recipe_mutation_locks"

interface RecipeMutationLockDocument {
  _id: string
  ownerToken: string
  expiresAt: Date
}

const LOCK_LEASE_MS = 60_000
export const RECIPE_MUTATION_LOCK_RENEWAL_MS = 20_000
const inProcessLocks = new Set<string>()

export class RecipeMutationConflictError extends Error {}

export interface RecipeMutationLease {
  assertOwned: () => Promise<void>
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
    })
  } finally {
    inProcessLocks.delete(recipeId)
  }
}

async function acquireMongoLock(
  collection: Collection<RecipeMutationLockDocument>,
  recipeId: string,
  ownerToken: string
): Promise<void> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_LEASE_MS)

  try {
    const result = await collection.updateOne(
      {
        _id: recipeId,
        $or: [{ expiresAt: { $lte: now } }, { ownerToken }],
      },
      {
        $set: { ownerToken, expiresAt },
        $setOnInsert: { _id: recipeId },
      },
      { upsert: true }
    )
    if (result.matchedCount === 0 && result.upsertedCount === 0) {
      throw new RecipeMutationConflictError("Recipe is being changed by another request")
    }
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
  await acquireMongoLock(collection, normalizedRecipeId, ownerToken)

  let renewalFailure: unknown
  let renewalInFlight: Promise<void> | undefined
  const renewLease = () => {
    if (renewalInFlight || renewalFailure) return
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
  const renewalTimer = setInterval(renewLease, RECIPE_MUTATION_LOCK_RENEWAL_MS)
  renewalTimer.unref?.()

  try {
    const result = await operation({ assertOwned })
    if (renewalInFlight) await renewalInFlight
    if (renewalFailure) throw renewalFailure
    return result
  } finally {
    clearInterval(renewalTimer)
    if (renewalInFlight) await renewalInFlight
    await collection.deleteOne({ _id: normalizedRecipeId, ownerToken }).catch((error) => {
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
