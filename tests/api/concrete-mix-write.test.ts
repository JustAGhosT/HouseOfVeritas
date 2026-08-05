import { describe, it, expect, vi, beforeEach } from "vitest"
import type { InventoryItem } from "@/lib/inventory-store"
import type { JobAllocation } from "@/lib/repositories/job-workspace-repository"

function stockItem(
  overrides: Pick<InventoryItem, "id" | "name" | "unit"> & Partial<InventoryItem>
): InventoryItem {
  return {
    category: "building_materials",
    currentStock: 50,
    minStock: 2,
    maxStock: 100,
    reorderPoint: 5,
    lastRestocked: "2026-01-01",
    averageConsumption: 1,
    location: "Workshop Store",
    supplier: "Cashbuild",
    unitCost: 0,
    totalValue: 0,
    consumptionHistory: [],
    ...overrides,
  }
}

let stock: InventoryItem[] = []
const createdAllocations: JobAllocation[] = []
const inngestEvents: Array<{ name: string }> = []
let project: { id: string; name: string } | null = null

function resetStock() {
  stock = [
    stockItem({
      id: "inv_cement",
      name: "Cement 50kg bags",
      unit: "bags",
      currentStock: 20,
      unitCost: 89.95,
    }),
    // Reorder point well under the stock, so only the tests that mean to trip
    // a low-stock alert trip one.
    stockItem({
      id: "inv_sand",
      name: "Plaster sand",
      unit: "m3",
      currentStock: 5,
      reorderPoint: 1,
      unitCost: 450,
    }),
    stockItem({
      id: "inv_pigment",
      name: "Oxide pigment terracotta",
      unit: "kg",
      currentStock: 25,
      unitCost: 89.95,
    }),
  ]
}

vi.mock("@/lib/repositories/inventory-repository", () => ({
  getInventoryRepository: vi.fn(async () => ({
    repository: {
      list: async () => stock,
      findById: async (id: string) => stock.find((entry) => entry.id === id),
      update: async (item: InventoryItem) => {
        stock = stock.map((entry) => (entry.id === item.id ? item : entry))
        return item
      },
    },
  })),
}))

vi.mock("@/lib/repositories/job-workspace-repository", () => ({
  createJobAllocation: vi.fn(async (allocation: JobAllocation) => {
    createdAllocations.push(allocation)
    return allocation
  }),
}))

vi.mock("@/lib/repositories/project-repository", () => ({
  findProjectById: vi.fn(async () => project),
}))

vi.mock("@/lib/workflows", () => ({
  routeToInngest: vi.fn(async (event: { name: string }) => {
    inngestEvents.push(event)
  }),
}))

// Static imports are safe here: every mock factory body is lazy, so none of
// them touch the module-scope fixtures before those are initialized.
import { POST as ALLOCATE } from "@/app/api/concrete-mix/allocate/route"
import { POST as CONSUME } from "@/app/api/concrete-mix/consume/route"

const operatorHeaders = {
  "x-user-id": "lucky",
  "x-user-role": "operator",
  "x-user-email": "lucky@houseofv.com",
  "Content-Type": "application/json",
}

const residentHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
  "Content-Type": "application/json",
}

function request(url: string, body: unknown, headers = operatorHeaders) {
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) })
}

/** 50 stones with no waste: 3 bags of cement, 0.3 m3 of sand, 8 kg of pigment. */
const BATCH = { presetId: "square-400", slabCount: 50, wastePercent: 0 }

beforeEach(() => {
  resetStock()
  createdAllocations.length = 0
  inngestEvents.length = 0
  project = { id: "proj_1", name: "Front garden path" }
})

describe("POST /api/concrete-mix/allocate", () => {
  it("books one material allocation per line, priced off inventory", async () => {
    const res = await ALLOCATE(
      request("http://localhost/api/concrete-mix/allocate", { ...BATCH, projectId: "proj_1" })
    )

    expect(res.status).toBe(200)
    const payload = await res.json()

    // Cement, sand and pigment. Water is not booked against a job.
    expect(payload.summary.allocationCount).toBe(3)
    expect(createdAllocations.map((entry) => entry.name)).toEqual([
      "Grey cement",
      "Plaster sand",
      "Oxide pigment",
    ])
    expect(createdAllocations.every((entry) => entry.type === "material")).toBe(true)
    expect(createdAllocations[0].costCents).toBe(26985)
    expect(payload.summary.estimatedCostCents).toBe(112445)
  })

  it("records the mix and colour on every line so the cost stays auditable", async () => {
    await ALLOCATE(
      request("http://localhost/api/concrete-mix/allocate", {
        ...BATCH,
        projectId: "proj_1",
        colorIntensityId: "dark",
      })
    )

    expect(createdAllocations[0].notes).toContain("Garden stone mortar")
    expect(createdAllocations[0].notes).toContain("pigment 8% of cement")
    expect(createdAllocations[0].notes).toContain("50 x 400x400x40mm")
  })

  it("carries the area through when one is given", async () => {
    await ALLOCATE(
      request("http://localhost/api/concrete-mix/allocate", {
        ...BATCH,
        projectId: "proj_1",
        areaId: "area_7",
      })
    )

    expect(createdAllocations.every((entry) => entry.areaId === "area_7")).toBe(true)
  })

  it("refuses to book against a project that does not exist", async () => {
    project = null
    const res = await ALLOCATE(
      request("http://localhost/api/concrete-mix/allocate", { ...BATCH, projectId: "ghost" })
    )

    expect(res.status).toBe(404)
    expect(createdAllocations).toEqual([])
  })

  it("requires a projectId and a valid batch", async () => {
    const noProject = await ALLOCATE(request("http://localhost/api/concrete-mix/allocate", BATCH))
    expect(noProject.status).toBe(400)

    const badBatch = await ALLOCATE(
      request("http://localhost/api/concrete-mix/allocate", {
        projectId: "proj_1",
        presetId: "square-400",
        slabCount: 0,
      })
    )
    expect(badBatch.status).toBe(400)
    expect(createdAllocations).toEqual([])
  })

  it("returns 403 for a resident and 401 without auth", async () => {
    const resident = await ALLOCATE(
      request(
        "http://localhost/api/concrete-mix/allocate",
        { ...BATCH, projectId: "proj_1" },
        residentHeaders
      )
    )
    expect(resident.status).toBe(403)

    const anonymous = await ALLOCATE(
      new Request("http://localhost/api/concrete-mix/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...BATCH, projectId: "proj_1" }),
      })
    )
    expect(anonymous.status).toBe(401)
    expect(createdAllocations).toEqual([])
  })
})

describe("POST /api/concrete-mix/consume", () => {
  it("draws every material down and records why", async () => {
    const res = await CONSUME(request("http://localhost/api/concrete-mix/consume", BATCH))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.summary.itemsConsumed).toBe(3)

    const cement = stock.find((entry) => entry.id === "inv_cement")!
    expect(cement.currentStock).toBe(17)
    expect(cement.consumptionHistory).toHaveLength(1)
    expect(cement.consumptionHistory[0].usedBy).toBe("lucky")
    expect(cement.consumptionHistory[0].purpose).toContain("Cast 50 garden stones")
    expect(cement.totalValue).toBeCloseTo(17 * 89.95, 2)
  })

  it("accepts an explicit purpose over the generated one", async () => {
    await CONSUME(
      request("http://localhost/api/concrete-mix/consume", {
        ...BATCH,
        purpose: "Path to the borehole",
      })
    )

    const cement = stock.find((entry) => entry.id === "inv_cement")!
    expect(cement.consumptionHistory[0].purpose).toBe("Path to the borehole")
  })

  it("refuses the whole batch when one material is short, touching nothing", async () => {
    stock = stock.map((entry) =>
      entry.id === "inv_pigment" ? { ...entry, currentStock: 1 } : entry
    )

    const res = await CONSUME(request("http://localhost/api/concrete-mix/consume", BATCH))

    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(payload.blockers[0]).toContain("need 8 kg, 1 in stock")
    // The cement was sufficient, but nothing moved.
    expect(stock.find((entry) => entry.id === "inv_cement")?.currentStock).toBe(20)
  })

  it("refuses when a material has no stock item at all", async () => {
    stock = stock.filter((entry) => entry.id !== "inv_pigment")

    const res = await CONSUME(request("http://localhost/api/concrete-mix/consume", BATCH))

    expect(res.status).toBe(409)
    expect(stock.find((entry) => entry.id === "inv_cement")?.currentStock).toBe(20)
  })

  it("fires the low-stock event when a draw-down crosses the reorder point", async () => {
    stock = stock.map((entry) =>
      entry.id === "inv_cement"
        ? { ...entry, currentStock: 6, reorderPoint: 5, minStock: 2 }
        : entry
    )

    const res = await CONSUME(request("http://localhost/api/concrete-mix/consume", BATCH))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.summary.alertCount).toBe(1)
    expect(inngestEvents.map((event) => event.name)).toContain(
      "house-of-veritas/inventory.low_stock"
    )
  })

  it("stays quiet when everything remains above its reorder point", async () => {
    await CONSUME(request("http://localhost/api/concrete-mix/consume", BATCH))

    expect(inngestEvents).toEqual([])
  })

  it("returns 403 for a resident and 401 without auth", async () => {
    const resident = await CONSUME(
      request("http://localhost/api/concrete-mix/consume", BATCH, residentHeaders)
    )
    expect(resident.status).toBe(403)

    const anonymous = await CONSUME(
      new Request("http://localhost/api/concrete-mix/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(BATCH),
      })
    )
    expect(anonymous.status).toBe(401)
    expect(stock.find((entry) => entry.id === "inv_cement")?.currentStock).toBe(20)
  })
})
