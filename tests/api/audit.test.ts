import { describe, it, expect } from "vitest"
import { GET, POST } from "@/app/api/audit/route"

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

describe("GET /api/audit", () => {
  it("returns 401 without auth headers", async () => {
    const request = new Request("http://localhost/api/audit")
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it("returns 403 when non-admin", async () => {
    const request = new Request("http://localhost/api/audit", {
      headers: operatorHeaders,
    })
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it("returns 200 when admin", async () => {
    const request = new Request("http://localhost/api/audit", {
      headers: adminHeaders,
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("logs")
    expect(data).toHaveProperty("total")
    expect(data).toHaveProperty("summary")
    expect(Array.isArray(data.logs)).toBe(true)
  })
})

describe("POST /api/audit", () => {
  it("returns 400 when required fields missing", async () => {
    const request = new Request("http://localhost/api/audit", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "hans" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("returns 200 when creating audit entry", async () => {
    const request = new Request("http://localhost/api/audit", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "hans",
        userName: "Hans",
        action: "task_completed",
        resourceType: "task",
        resourceId: "task_1",
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("success", true)
    expect(data).toHaveProperty("entry")
    expect(data.entry).toHaveProperty("action", "task_completed")
  })
})
