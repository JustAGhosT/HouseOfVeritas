import { beforeEach, describe, expect, it, vi } from "vitest"

const mongoMocks = vi.hoisted(() => ({
  configured: false,
  deleteOne: vi.fn(),
  getCollection: vi.fn(),
  updateOne: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  getCollection: mongoMocks.getCollection,
  isMongoConfigured: () => mongoMocks.configured,
}))

import {
  RECIPE_MUTATION_LOCK_COLLECTION,
  RecipeMutationConflictError,
  resetRecipeMutationLocksForTests,
  withRecipeMutationLock,
} from "@/lib/repositories/recipe-mutation-lock"

describe("recipe mutation lock", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    mongoMocks.configured = false
    mongoMocks.deleteOne.mockReset().mockResolvedValue({ deletedCount: 1 })
    mongoMocks.updateOne.mockReset().mockResolvedValue({ matchedCount: 0, upsertedCount: 1 })
    mongoMocks.getCollection.mockReset().mockResolvedValue({
      updateOne: mongoMocks.updateOne,
      deleteOne: mongoMocks.deleteOne,
    })
    resetRecipeMutationLocksForTests()
  })

  it("rejects a concurrent mutation for the same recipe and releases after completion", async () => {
    let release: (() => void) | undefined
    const first = withRecipeMutationLock(
      "recipe-1",
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    await Promise.resolve()

    await expect(withRecipeMutationLock("recipe-1", async () => "second")).rejects.toBeInstanceOf(
      RecipeMutationConflictError
    )

    release?.()
    await first
    await expect(withRecipeMutationLock("recipe-1", async () => "third")).resolves.toBe("third")
  })

  it("allows different recipes to mutate independently", async () => {
    await expect(
      Promise.all([
        withRecipeMutationLock("recipe-1", async () => "first"),
        withRecipeMutationLock("recipe-2", async () => "second"),
      ])
    ).resolves.toEqual(["first", "second"])
  })

  it("uses an expiring Mongo lease and owner-scoped release in live mode", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true

    await expect(withRecipeMutationLock("recipe-1", async () => "published")).resolves.toBe(
      "published"
    )

    expect(mongoMocks.getCollection).toHaveBeenCalledWith(RECIPE_MUTATION_LOCK_COLLECTION)
    expect(mongoMocks.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "recipe-1" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          ownerToken: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
      { upsert: true }
    )
    const ownerToken = mongoMocks.updateOne.mock.calls[0][1].$set.ownerToken
    expect(mongoMocks.deleteOne).toHaveBeenCalledWith({ _id: "recipe-1", ownerToken })
  })

  it("maps an occupied Mongo lease to a retryable mutation conflict", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.updateOne.mockRejectedValueOnce({ code: 11000 })

    await expect(withRecipeMutationLock("recipe-1", async () => "not-run")).rejects.toBeInstanceOf(
      RecipeMutationConflictError
    )
    expect(mongoMocks.deleteOne).not.toHaveBeenCalled()
  })
})
