import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getInventoryRepository,
  resetInventoryRepositoryForTests,
} from "@/lib/repositories/inventory-repository"

describe("inventory repository", () => {
  beforeEach(() => {
    vi.stubEnv("MONGODB_URI", "")
    vi.stubEnv("MONGO_URL", "")
    vi.stubEnv("E2E_TEST", "1")
    resetInventoryRepositoryForTests()
  })

  it("persists inventory mutations through the repository contract", async () => {
    const { repository, mode } = await getInventoryRepository()
    const item = {
      id: "inv_repository_test",
      name: "Repository test item",
      category: "other" as const,
      unit: "units",
      currentStock: 2,
      minStock: 1,
      maxStock: 5,
      reorderPoint: 1,
      lastRestocked: "2026-07-24",
      averageConsumption: 0,
      location: "Test Store",
      unitCost: 10,
      totalValue: 20,
      consumptionHistory: [],
    }

    expect(mode).toBe("memory")
    await repository.create(item)
    expect(await repository.findById(item.id)).toEqual(item)

    const updated = (await repository.findById(item.id))!
    updated.currentStock = 4
    updated.totalValue = 40
    await repository.update(updated)
    expect((await repository.findByName("repository test"))?.currentStock).toBe(4)

    const restocked = await repository.restockByName("Repository test item", 1)
    expect(restocked).toMatchObject({ currentStock: 5, totalValue: 50 })
  })
})
