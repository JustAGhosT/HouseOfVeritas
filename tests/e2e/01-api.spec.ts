import { test, expect } from "@playwright/test"

test.describe("API Routes", () => {
  test("health check returns 200", async ({ request }) => {
    const res = await request.get("/api/health")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toMatch(/healthy|degraded/)
    expect(body.services).toBeDefined()
  })

  test("protected routes return 401 without auth", async ({ request }) => {
    const protectedRoutes = [
      "/api/tasks",
      "/api/expenses",
      "/api/payroll",
      "/api/audit",
      "/api/reports",
      "/api/stats",
    ]

    for (const route of protectedRoutes) {
      const res = await request.get(route)
      expect(res.status()).toBe(401)
    }
  })

  // The bcrypt /api/auth/login endpoint (JWT cookie, login rate-limiting) was
  // removed by the Auth.js v5 + Mystira OIDC migration (PR #62) — Auth.js owns
  // /api/auth/* now and rejects the old `login` action. Establishing an
  // authenticated session requires the OIDC IdP, so these need a live/mocked
  // Mystira provider; tracked under baton 7ad9342d + /team-testing.
  test.fixme("authenticated requests succeed (requires Mystira OIDC session)", async () => {})
})
