import { GET, PATCH, POST } from "@/app/api/kiosk/requests/route"
import { getInventory } from "@/lib/inventory-store"
import * as workflows from "@/lib/workflows"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/services/notification-service", () => ({
  sendNotification: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/db/kiosk-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/kiosk-store")>()
  type KioskDoc = {
    _id: { toString: () => string }
    employeeId?: string
    type?: string
    status?: string
    [k: string]: unknown
  }
  const inMemoryStore = new Map<string, KioskDoc>()
  const { ObjectId } = await import("mongodb")
  const seed = [
    {
      type: "stock_order",
      employeeId: "lucky",
      employeeName: "Lucky",
      data: {},
      timestamp: new Date().toISOString(),
      status: "pending",
    },
  ]
  seed.forEach((d) => {
    const id = new ObjectId()
    inMemoryStore.set(id.toString(), { ...d, _id: id })
  })
  return {
    ...actual,
    getKioskStore: vi.fn().mockResolvedValue({
      store: {
        find: async (q?: Record<string, unknown>) => {
          let items = Array.from(inMemoryStore.values())
          if (!q) return items
          const employeeId = typeof q.employeeId === "string" ? q.employeeId : undefined
          const type = typeof q.type === "string" ? q.type : undefined
          const status = typeof q.status === "string" ? q.status : undefined
          if (employeeId) items = items.filter((r) => r.employeeId === employeeId)
          if (type) items = items.filter((r) => r.type === type)
          if (status) items = items.filter((r) => r.status === status)
          return items
        },
        insertOne: async (doc: {
          type: string
          employeeId: string
          employeeName: string
          data: Record<string, unknown>
          timestamp: string
          status: string
        }) => {
          const id = new ObjectId()
          inMemoryStore.set(id.toString(), { ...doc, _id: id })
          return { insertedId: id }
        },
        updateOne: async (
          filter: { _id: { toString: () => string } },
          update: { $set: Record<string, unknown> }
        ) => {
          const doc = inMemoryStore.get(filter._id.toString())
          if (doc && update.$set) Object.assign(doc, update.$set)
        },
        findOne: async (filter: { _id: { toString: () => string } }) =>
          inMemoryStore.get(filter._id.toString()) ?? null,
      },
      mode: "memory" as const,
    }),
    sanitizeKioskDoc: (d: { _id?: { toString: () => string }; [k: string]: unknown }) =>
      d._id ? { ...d, id: d._id.toString() } : d,
    sanitizeKioskDocs: (docs: { _id?: { toString: () => string }; [k: string]: unknown }[]) =>
      docs.map((d) => (d._id ? { ...d, id: d._id.toString() } : d)),
  }
})

const adminHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
}

describe("GET /api/kiosk/requests", () => {
  it("returns 200 with requests and summary", async () => {
    const request = new Request("http://localhost/api/kiosk/requests", {
      headers: adminHeaders,
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.requests).toBeDefined()
    expect(Array.isArray(data.requests)).toBe(true)
    expect(data.summary).toBeDefined()
  })
})

describe("POST /api/kiosk/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 when required fields missing", async () => {
    const request = new Request("http://localhost/api/kiosk/requests", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stock_order" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("returns 200 and creates request", async () => {
    const request = new Request("http://localhost/api/kiosk/requests", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "stock_order",
        employeeId: "lucky",
        employeeName: "Lucky",
        data: { itemName: "Test item", quantity: 1 },
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.request).toBeDefined()
    expect(data.request.type).toBe("stock_order")
    expect(data.request.status).toBe("pending")
  })

  it("calls routeToInngest when USE_INNGEST_APPROVALS is true", async () => {
    const orig = process.env.USE_INNGEST_APPROVALS
    process.env.USE_INNGEST_APPROVALS = "true"
    const routeSpy = vi.spyOn(workflows, "routeToInngest").mockResolvedValue()

    const request = new Request("http://localhost/api/kiosk/requests", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "stock_order",
        employeeId: "charl",
        employeeName: "Charl",
        data: { itemName: "Widget", quantity: 2 },
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(routeSpy).toHaveBeenCalledTimes(1)
    expect(routeSpy).toHaveBeenCalledWith({
      name: "house-of-veritas/kiosk.request.submitted",
      data: expect.objectContaining({
        type: "stock_order",
        employeeId: "charl",
        employeeName: "Charl",
        data: expect.objectContaining({ itemName: "Widget", quantity: 2 }),
      }),
    })

    process.env.USE_INNGEST_APPROVALS = orig
    routeSpy.mockRestore()
  })
})

describe("PATCH /api/kiosk/requests", () => {
  beforeEach(() => {
    vi.spyOn(workflows, "routeToInngest").mockResolvedValue()
  })

  it("auto-restocks inventory when stock_order is approved", async () => {
    const postReq = new Request("http://localhost/api/kiosk/requests", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "stock_order",
        employeeId: "lucky",
        employeeName: "Lucky",
        data: { itemName: "Garden fertilizer 25kg", quantity: 3 },
      }),
    })
    const postRes = await POST(postReq)
    expect(postRes.status).toBe(200)
    const postData = await postRes.json()
    const requestId = postData.request.id

    const inv = getInventory()
    const fertilizer = inv.find((i) => i.name.includes("fertilizer"))
    const stockBefore = fertilizer?.currentStock ?? 0

    const patchReq = new Request("http://localhost/api/kiosk/requests", {
      method: "PATCH",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, status: "approved" }),
    })
    const patchRes = await PATCH(patchReq)
    expect(patchRes.status).toBe(200)

    const invAfter = getInventory()
    const fertilizerAfter = invAfter.find((i) => i.name.includes("fertilizer"))
    expect(fertilizerAfter?.currentStock).toBe(stockBefore + 3)
  })
})
