import { describe, it, expect, vi } from "vitest"
import type { InventoryItem } from "@/lib/inventory-store"
import { GET, POST } from "@/app/api/concrete-mix/route"

const STOCK: InventoryItem[] = [
  {
    id: "inv_cement",
    name: "Cement 50kg bags",
    category: "building_materials",
    unit: "bags",
    currentStock: 8,
    minStock: 5,
    maxStock: 20,
    reorderPoint: 5,
    lastRestocked: "2026-01-01",
    averageConsumption: 6,
    location: "Workshop Store",
    supplier: "Cashbuild",
    unitCost: 89.95,
    totalValue: 719.6,
    consumptionHistory: [],
  },
  {
    id: "inv_sand",
    name: "Plaster sand",
    category: "building_materials",
    unit: "m3",
    currentStock: 3,
    minStock: 1,
    maxStock: 6,
    reorderPoint: 1,
    lastRestocked: "2026-01-01",
    averageConsumption: 1,
    location: "Yard",
    supplier: "Cashbuild",
    unitCost: 450,
    totalValue: 1350,
    consumptionHistory: [],
  },
]

vi.mock("@/lib/repositories/inventory-repository", () => ({
  getInventoryRepository: vi.fn(async () => ({
    repository: { list: async () => STOCK },
  })),
}))

const adminHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
}

const operatorHeaders = {
  "x-user-id": "lucky",
  "x-user-role": "operator",
  "x-user-email": "lucky@houseofv.com",
}

const residentHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
}

function postRequest(body: unknown, headers: Record<string, string> = operatorHeaders) {
  return new Request("http://localhost/api/concrete-mix", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/concrete-mix", () => {
  it("returns the presets, mix designs and intensities for an operator", async () => {
    const res = await GET(
      new Request("http://localhost/api/concrete-mix", { headers: operatorHeaders })
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.slabPresets.length).toBeGreaterThan(0)
    expect(payload.data.mixDesigns.length).toBeGreaterThan(0)
    expect(payload.data.colorIntensities.length).toBe(4)
    expect(payload.data.defaults.wastePercent).toBe(10)
  })

  it("returns 401 without auth", async () => {
    const res = await GET(new Request("http://localhost/api/concrete-mix"))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a resident", async () => {
    const res = await GET(
      new Request("http://localhost/api/concrete-mix", { headers: residentHeaders })
    )
    expect(res.status).toBe(403)
  })
})

describe("POST /api/concrete-mix", () => {
  it("calculates a batch from a preset", async () => {
    const res = await POST(postRequest({ presetId: "square-400", slabCount: 20 }))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.summary.slabCount).toBe(20)
    expect(payload.summary.pigmentGramsPerSlab).toBe(144)
    expect(payload.summary.cementBags).toBeGreaterThan(0)
    expect(payload.summary.estimatedCostCents).toBeNull()
    expect(payload.data.materials.map((line: { material: string }) => line.material)).toEqual([
      "cement",
      "sand",
      "water",
      "pigment",
    ])
  })

  it("accepts admin as well as operator", async () => {
    const res = await POST(postRequest({ presetId: "brick-paver", slabCount: 100 }, adminHeaders))
    expect(res.status).toBe(200)
  })

  it("returns the cost total when unit prices are supplied", async () => {
    const res = await POST(
      postRequest({
        presetId: "square-400",
        slabCount: 50,
        wastePercent: 0,
        costs: { cement: 12000, pigment: 8995 },
      })
    )

    const payload = await res.json()
    expect(payload.summary.estimatedCostCents).toBe(107960)
  })

  it("accepts an area instead of a slab count and reports the coverage", async () => {
    const res = await POST(postRequest({ presetId: "square-400", coverage: { areaM2: 12 } }))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.summary.slabCount).toBe(75)
    expect(payload.summary.coveredAreaM2).toBeGreaterThan(12)
    expect(payload.data.coverage.requestedAreaM2).toBe(12)
  })

  it("returns a mixer plan when a drum capacity is given", async () => {
    const res = await POST(
      postRequest({
        presetId: "square-400",
        slabCount: 50,
        wastePercent: 0,
        mixerCapacityM3: 0.15,
      })
    )

    const payload = await res.json()
    expect(payload.summary.mixerLoadCount).toBe(3)
    expect(payload.data.mixerPlan.fullLoad.pigmentGrams).toBe(3375)
  })

  it("includes reinforcement and admixture lines when they are requested", async () => {
    const res = await POST(
      postRequest({
        presetId: "large-500",
        slabCount: 40,
        reinforcement: "mesh",
        admixtures: ["waterproofer"],
      })
    )

    const payload = await res.json()
    const materials = payload.data.materials.map((line: { material: string }) => line.material)
    expect(materials).toContain("mesh")
    expect(materials).toContain("waterproofer")
  })

  it("returns 400 when both slabCount and coverage are given", async () => {
    const res = await POST(
      postRequest({ presetId: "square-400", slabCount: 10, coverage: { areaM2: 12 } })
    )

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toContain("not both")
  })

  it("surfaces warnings in the summary count", async () => {
    const res = await POST(
      postRequest({
        dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 20 },
        slabCount: 5,
      })
    )

    const payload = await res.json()
    expect(payload.summary.warningCount).toBeGreaterThan(0)
    expect(payload.data.warnings.length).toBe(payload.summary.warningCount)
  })

  it("returns 400 with the validation reason for a bad slab count", async () => {
    const res = await POST(postRequest({ presetId: "square-400", slabCount: 0 }))

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toContain("slabCount")
  })

  it("returns 400 when neither preset nor dimensions are given", async () => {
    const res = await POST(postRequest({ slabCount: 5 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/concrete-mix", {
        method: "POST",
        headers: { ...operatorHeaders, "Content-Type": "application/json" },
        body: "not json",
      })
    )

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toContain("JSON")
  })

  it("returns 401 without auth", async () => {
    const res = await POST(
      new Request("http://localhost/api/concrete-mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "square-400", slabCount: 1 }),
      })
    )

    expect(res.status).toBe(401)
  })
})

describe("POST /api/concrete-mix with useInventory", () => {
  it("prices the batch off real stock and reports what is short", async () => {
    const res = await POST(
      postRequest({
        presetId: "square-400",
        slabCount: 50,
        wastePercent: 0,
        useInventory: true,
      })
    )

    expect(res.status).toBe(200)
    const payload = await res.json()

    // 3 bags at R89.95 and 0.3 m3 of sand at R450.00, from the estate's own prices.
    expect(payload.summary.estimatedCostCents).toBe(40485)
    expect(payload.data.materials[0].estimatedCostCents).toBe(26985)
    // Nothing in stock matches oxide pigment, so it cannot be counted as covered.
    expect(payload.inventory.unmatched).toEqual(["pigment"])
    expect(payload.summary.fullyStocked).toBe(false)
  })

  it("lets a caller-supplied price override the inventory price", async () => {
    const res = await POST(
      postRequest({
        presetId: "square-400",
        slabCount: 50,
        wastePercent: 0,
        useInventory: true,
        costs: { cement: 10000 },
      })
    )

    const payload = await res.json()
    // Caller's R100.00 a bag wins over the R89.95 on the stock record.
    expect(payload.data.materials[0].estimatedCostCents).toBe(30000)
    expect(payload.inventory.materials[0].unitCostCents).toBe(8995)
  })

  it("leaves the inventory block null when it was not asked for", async () => {
    const res = await POST(postRequest({ presetId: "square-400", slabCount: 50 }))

    const payload = await res.json()
    expect(payload.inventory).toBeNull()
    expect(payload.summary.fullyStocked).toBeNull()
    expect(payload.summary.shortfallCount).toBeNull()
  })
})
