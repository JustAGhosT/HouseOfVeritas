import { beforeEach, describe, expect, it, vi } from "vitest"

const mongoMocks = vi.hoisted(() => ({
  configured: false,
  endSession: vi.fn(),
  findOneAndUpdate: vi.fn(),
  getCollection: vi.fn(),
  startMongoSession: vi.fn(),
  updateOne: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  getCollection: mongoMocks.getCollection,
  isMongoConfigured: () => mongoMocks.configured,
  startMongoSession: mongoMocks.startMongoSession,
}))

import {
  RECIPE_MUTATION_LOCK_COLLECTION,
  RECIPE_MUTATION_LOCK_RENEWAL_MS,
  RecipeMutationConflictError,
  resetRecipeMutationLocksForTests,
  withRecipeMutationLock,
} from "@/lib/repositories/recipe-mutation-lock"

describe("recipe mutation lock", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("CI", "")
    vi.stubEnv("E2E_TEST", "")
    mongoMocks.configured = false
    mongoMocks.findOneAndUpdate.mockReset().mockResolvedValue({
      _id: "recipe-1",
      ownerToken: "owner",
      expiresAt: new Date(),
      fence: 7,
    })
    mongoMocks.updateOne.mockReset().mockResolvedValue({ matchedCount: 1, upsertedCount: 0 })
    mongoMocks.withTransaction.mockReset().mockImplementation(async (operation) => operation())
    mongoMocks.endSession.mockReset().mockResolvedValue(undefined)
    mongoMocks.startMongoSession.mockReset().mockResolvedValue({
      withTransaction: mongoMocks.withTransaction,
      endSession: mongoMocks.endSession,
    })
    mongoMocks.getCollection.mockReset().mockResolvedValue({
      findOneAndUpdate: mongoMocks.findOneAndUpdate,
      updateOne: mongoMocks.updateOne,
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

    await expect(
      withRecipeMutationLock("recipe-1", async (lease) => ({
        value: "published",
        fence: lease.fence,
      }))
    ).resolves.toEqual({ value: "published", fence: 7 })

    expect(mongoMocks.getCollection).toHaveBeenCalledWith(RECIPE_MUTATION_LOCK_COLLECTION)
    expect(mongoMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "recipe-1" }),
      expect.objectContaining({
        $inc: { fence: 1 },
        $set: expect.objectContaining({
          ownerToken: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
      { upsert: true, returnDocument: "after", includeResultMetadata: false }
    )
    const ownerToken = mongoMocks.findOneAndUpdate.mock.calls[0][1].$set.ownerToken
    expect(mongoMocks.updateOne).toHaveBeenCalledWith(
      { _id: "recipe-1", ownerToken },
      { $set: { expiresAt: new Date(0) }, $unset: { ownerToken: "" } }
    )
  })

  it("maps an occupied Mongo lease to a retryable mutation conflict", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.findOneAndUpdate.mockRejectedValueOnce({ code: 11000 })

    await expect(withRecipeMutationLock("recipe-1", async () => "not-run")).rejects.toBeInstanceOf(
      RecipeMutationConflictError
    )
    expect(mongoMocks.updateOne).not.toHaveBeenCalled()
  })

  it("renews a live Mongo lease until a slow mutation finishes", async () => {
    vi.useFakeTimers()
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    let finish: (() => void) | undefined

    const mutation = withRecipeMutationLock(
      "recipe-1",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    await vi.waitFor(() => expect(mongoMocks.findOneAndUpdate).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(RECIPE_MUTATION_LOCK_RENEWAL_MS)
    expect(mongoMocks.updateOne).toHaveBeenCalledTimes(1)
    const ownerToken = mongoMocks.findOneAndUpdate.mock.calls[0][1].$set.ownerToken
    expect(mongoMocks.updateOne.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        _id: "recipe-1",
        ownerToken,
        expiresAt: { $gt: expect.any(Date) },
      })
    )

    finish?.()
    await mutation
    expect(mongoMocks.updateOne).toHaveBeenLastCalledWith(
      { _id: "recipe-1", ownerToken },
      { $set: { expiresAt: new Date(0) }, $unset: { ownerToken: "" } }
    )
  })

  it("fails closed before a guarded write when Mongo lease ownership is lost", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.updateOne.mockResolvedValueOnce({ matchedCount: 0, upsertedCount: 0 })
    const write = vi.fn()

    await expect(
      withRecipeMutationLock("recipe-1", async (lease) => {
        await lease.assertOwned()
        write()
      })
    ).rejects.toBeInstanceOf(RecipeMutationConflictError)

    expect(write).not.toHaveBeenCalled()
  })

  it("verifies the shared fence and target write in one Mongo transaction", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    const write = vi.fn().mockResolvedValue("updated")

    await expect(
      withRecipeMutationLock("recipe-1", (lease) => lease.runFencedWrite(write))
    ).resolves.toBe("updated")

    const ownerToken = mongoMocks.findOneAndUpdate.mock.calls[0][1].$set.ownerToken
    const session = await mongoMocks.startMongoSession.mock.results[0].value
    expect(mongoMocks.updateOne).toHaveBeenNthCalledWith(
      1,
      {
        _id: "recipe-1",
        ownerToken,
        fence: 7,
        expiresAt: { $gt: expect.any(Date) },
      },
      { $set: { expiresAt: expect.any(Date) } },
      { session }
    )
    expect(write).toHaveBeenCalledWith(session)
    expect(mongoMocks.endSession).toHaveBeenCalledOnce()
  })
})
