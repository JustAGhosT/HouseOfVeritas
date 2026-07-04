import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/stats/route"

describe("GET /api/stats", () => {
  it("returns 401 when no auth headers", async () => {
    const request = new Request("http://localhost/api/stats")
    const response = await GET(request, {})
    expect(response.status).toBe(401)
  })

  it("returns 200 with valid auth headers", async () => {
    const request = new Request("http://localhost/api/stats", {
      headers: {
        "x-user-id": "hans",
        "x-user-role": "admin",
        "x-user-email": "smit.jurie@gmail.com",
      },
    })
    const response = await GET(request, {})
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("dataSource")
    expect(data).toHaveProperty("users")
    expect(data).toHaveProperty("tasks")
    expect(data).toHaveProperty("expenses")
    expect(data).toHaveProperty("budget")
  })
})
