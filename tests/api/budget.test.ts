import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "@/app/api/budget/route"

vi.mock("@/lib/services/baserow", () => ({
  getBudgets: vi.fn().mockResolvedValue([{ id: 1, category: "Supplies", amount: 5000 }]),
  createBudget: vi.fn().mockResolvedValue({ id: 1, category: "Materials", amount: 3000 }),
  updateBudget: vi.fn().mockResolvedValue({ id: 1, category: "Materials", amount: 4000 }),
  isBaserowConfigured: vi.fn().mockReturnValue(false),
}))

const adminHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
}

const operatorHeaders = {
  "x-user-id": "charl",
  "x-user-role": "operator",
  "x-user-email": "charl@houseofv.com",
}

describe("GET /api/budget", () => {
  it("returns 200 with budgets for admin", async () => {
    const req = new Request("http://localhost/api/budget", { headers: adminHeaders })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("budgets")
    expect(Array.isArray(data.budgets)).toBe(true)
  })

  it("returns 200 for operator", async () => {
    const req = new Request("http://localhost/api/budget", { headers: operatorHeaders })
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/budget")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})

describe("POST /api/budget", () => {
  it("creates budget with valid body", async () => {
    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ category: "Materials", amount: 3000 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("budget")
  })

  it("returns 400 when category missing", async () => {
    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1000 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Category")
  })

  it("returns 400 when amount invalid", async () => {
    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ category: "Materials", amount: -1 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 403 for operator", async () => {
    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { ...operatorHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ category: "Materials", amount: 1000 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
