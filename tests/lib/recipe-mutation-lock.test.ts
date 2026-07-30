import { beforeEach, describe, expect, it, vi } from "vitest"

const mongoMocks = vi.hoisted(() => ({
  configured: false,
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
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
    mongoMocks.findOneAndUpdate.mockReset().mockResolvedValue({
      _id: "recipe-1",
      ownerToken: "owner",
      acquiredAt: new Date(),
      fence: 7,
    })
    mongoMocks.findOne.mockReset().mockResolvedValue({
      _id: "recipe-1",
      ownerToken: "owner",
      acquiredAt: new Date(),
      fence: 7,
    })
    mongoMocks.updateOne.mockReset().mockResolvedValue({ matchedCount: 1 })
    mongoMocks.getCollection.mockReset().mockResolvedValue({
      findOne: mongoMocks.findOne,
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

  it("uses a persistent Mongo owner lock and owner-scoped release in live mode", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true

    await expect(withRecipeMutationLock("recipe-1", async (lock) => lock.fence)).resolves.toBe(7)

    expect(mongoMocks.getCollection).toHaveBeenCalledWith(RECIPE_MUTATION_LOCK_COLLECTION)
    expect(mongoMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "recipe-1", ownerToken: { $exists: false } },
      expect.objectContaining({
        $inc: { fence: 1 },
        $set: { ownerToken: expect.any(String), acquiredAt: expect.any(Date) },
      }),
      { upsert: true, returnDocument: "after", includeResultMetadata: false }
    )
    const ownerToken = mongoMocks.findOneAndUpdate.mock.calls[0][1].$set.ownerToken
    expect(mongoMocks.updateOne).toHaveBeenCalledWith(
      { _id: "recipe-1", ownerToken, fence: 7 },
      { $unset: { ownerToken: "", acquiredAt: "" } }
    )
  })

  it("maps an occupied Mongo owner lock to a retryable conflict", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.findOneAndUpdate.mockRejectedValueOnce({ code: 11000 })

    await expect(withRecipeMutationLock("recipe-1", async () => "not-run")).rejects.toBeInstanceOf(
      RecipeMutationConflictError
    )
    expect(mongoMocks.updateOne).not.toHaveBeenCalled()
  })

  it("fails closed before a guarded write when owner lock evidence is lost", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    mongoMocks.findOne.mockResolvedValueOnce(null)
    const write = vi.fn()

    await expect(
      withRecipeMutationLock("recipe-1", (lock) => lock.runFencedWrite(write))
    ).rejects.toBeInstanceOf(RecipeMutationConflictError)
    expect(write).not.toHaveBeenCalled()
  })

  it("runs a guarded target write and releases after confirmed success", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    const write = vi.fn().mockResolvedValue("updated")

    await expect(
      withRecipeMutationLock("recipe-1", (lock) => lock.runFencedWrite(write))
    ).resolves.toBe("updated")
    expect(write).toHaveBeenCalledOnce()
    expect(mongoMocks.updateOne).toHaveBeenCalledOnce()
  })

  it("retains the owner lock after an ambiguous target-write failure", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true

    await expect(
      withRecipeMutationLock("recipe-1", (lock) =>
        lock.runFencedWrite(async () => {
          throw new Error("Mongo timeout")
        })
      )
    ).rejects.toThrow("Mongo timeout")
    expect(mongoMocks.updateOne).not.toHaveBeenCalled()
  })

  it("releases after a target write reports a confirmed no-write conflict", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mongoMocks.configured = true
    const conflict = Object.assign(new Error("Compare-and-swap conflict"), {
      safeToReleaseMutationLock: true,
    })

    await expect(
      withRecipeMutationLock("recipe-1", (lock) =>
        lock.runFencedWrite(async () => {
          throw conflict
        })
      )
    ).rejects.toBe(conflict)
    expect(mongoMocks.updateOne).toHaveBeenCalledOnce()
  })
})
