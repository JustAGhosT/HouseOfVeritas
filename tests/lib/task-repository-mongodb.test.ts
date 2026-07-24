import { beforeEach, describe, expect, it, vi } from "vitest"

const mongoMocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  getCollection: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  getCollection: mongoMocks.getCollection,
}))

import { getTaskRepository, resetTaskRepositoryForTests } from "@/lib/repositories/task-repository"

describe("Mongo task repository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTaskRepositoryForTests()
    mongoMocks.createIndex.mockResolvedValue("index")
    mongoMocks.getCollection.mockResolvedValue({
      createIndex: mongoMocks.createIndex,
    })
  })

  it("creates the compound index required by the default Cosmos sort", async () => {
    await getTaskRepository("mongodb")

    expect(mongoMocks.createIndex).toHaveBeenCalledWith({ createdDate: -1, id: -1 })
  })
})
