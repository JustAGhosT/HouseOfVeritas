import { randomUUID } from "crypto"
import type { Collection } from "mongodb"
import { getCollection, isMongoConfigured } from "@/lib/db/mongodb"
import { logger } from "@/lib/logger"

export const RECIPE_MUTATION_LOCK_COLLECTION = "recipe_mutation_locks"

interface RecipeMutationLockDocument {
  _id: string
  ownerToken?: string
  acquiredAt?: Date
  fence: number
}

const inProcessLocks = new Set<string>()

export class RecipeMutationConflictError extends Error {}
export class RecipeMutationLockAcquisitionError extends Error {}
export class RecipeMutationLockReleaseError extends Error {}

export interface RecipeMutationLease {
  assertOwned: () => Promise<void>
  fence?: number
  runFencedWrite: <T>(write: () => Promise<T>) => Promise<T>
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

function isConfirmedNoWriteError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "safeToReleaseMutationLock" in error &&
    error.safeToReleaseMutationLock === true
  )
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
  try {
    const document = await collection.findOneAndUpdate(
      {
        _id: recipeId,
        ownerToken: { $exists: false },
      },
      {
        $set: { ownerToken, acquiredAt: new Date() },
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

    let reconciliationError: unknown
    try {
      const document = await collection.findOne({ _id: recipeId, ownerToken })
      if (document && Number.isSafeInteger(document.fence) && document.fence >= 1) {
        return document.fence
      }
    } catch (readError) {
      reconciliationError = readError
    }

    logger.error("Recipe mutation lock acquisition outcome is ambiguous", {
      recipeId,
      ownerToken,
      acquisitionError: error instanceof Error ? error.message : String(error),
      reconciliationError:
        reconciliationError instanceof Error
          ? reconciliationError.message
          : reconciliationError === undefined
            ? undefined
            : String(reconciliationError),
    })
    throw new RecipeMutationLockAcquisitionError(
      "Recipe mutation lock acquisition could not be reconciled; operator recovery may be required",
      { cause: error }
    )
  }
}

async function assertMongoLockOwned(
  collection: Collection<RecipeMutationLockDocument>,
  recipeId: string,
  ownerToken: string,
  fence: number
): Promise<void> {
  const document = await collection.findOne({ _id: recipeId, ownerToken, fence })
  if (!document) {
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

  let retainLock = false
  let ownershipLost = false
  const assertOwned = async () => {
    try {
      await assertMongoLockOwned(collection, normalizedRecipeId, ownerToken, fence)
    } catch (error) {
      if (error instanceof RecipeMutationConflictError) ownershipLost = true
      throw error
    }
  }
  const runFencedWrite = async <T>(write: () => Promise<T>): Promise<T> => {
    await assertOwned()
    try {
      return await write()
    } catch (error) {
      if (!isConfirmedNoWriteError(error)) {
        retainLock = true
        logger.error("Recipe mutation lock retained after an ambiguous target-write failure", {
          recipeId: normalizedRecipeId,
          ownerToken,
          fence,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      throw error
    }
  }

  try {
    return await operation({ assertOwned, fence, runFencedWrite })
  } finally {
    if (!retainLock && !ownershipLost) {
      try {
        const release = await collection.updateOne(
          { _id: normalizedRecipeId, ownerToken, fence },
          { $unset: { ownerToken: "", acquiredAt: "" } }
        )
        if (release.matchedCount !== 1) {
          throw new Error("Owner-scoped recipe mutation lock release matched no record")
        }
      } catch (error) {
        logger.error("Failed to release recipe mutation lock", {
          recipeId: normalizedRecipeId,
          ownerToken,
          fence,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new RecipeMutationLockReleaseError(
          "Recipe update completed but its mutation lock could not be released; operator recovery is required",
          { cause: error }
        )
      }
    }
  }
}

export function resetRecipeMutationLocksForTests(): void {
  inProcessLocks.clear()
}
