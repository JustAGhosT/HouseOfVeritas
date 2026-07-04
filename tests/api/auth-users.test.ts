import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/auth/users/route"

describe("GET /api/auth/users", () => {
  it("returns 401 when no auth headers", async () => {
    const request = new Request("http://localhost/api/auth/users")
    const response = await GET(request, {})
    expect(response.status).toBe(401)
  })

  it("returns 403 when non-admin user", async () => {
    const request = new Request("http://localhost/api/auth/users", {
      headers: {
        "x-user-id": "charl",
        "x-user-role": "operator",
        "x-user-email": "charl@houseofv.com",
      },
    })
    const response = await GET(request, {})
    expect(response.status).toBe(403)
  })

  it("returns 200 when admin user", async () => {
    const request = new Request("http://localhost/api/auth/users", {
      headers: {
        "x-user-id": "hans",
        "x-user-role": "admin",
        "x-user-email": "smit.jurie@gmail.com",
      },
    })
    const response = await GET(request, {})
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("users")
    expect(Array.isArray(data.users)).toBe(true)
    expect(data).toHaveProperty("total")
  })
})
