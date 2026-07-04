import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/payroll/route"

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

describe("GET /api/payroll", () => {
  it("returns 401 without auth headers", async () => {
    const request = new Request("http://localhost/api/payroll")
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it("returns 403 when non-admin", async () => {
    const request = new Request("http://localhost/api/payroll", {
      headers: operatorHeaders,
    })
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it("returns 200 when admin", async () => {
    const request = new Request("http://localhost/api/payroll", {
      headers: adminHeaders,
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("employees")
    expect(Array.isArray(data.employees)).toBe(true)
    expect(data).toHaveProperty("totals")
  })

  it("returns status when action=status", async () => {
    const request = new Request("http://localhost/api/payroll?action=status", {
      headers: adminHeaders,
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("quickbooks")
    expect(data).toHaveProperty("xero")
  })
})
