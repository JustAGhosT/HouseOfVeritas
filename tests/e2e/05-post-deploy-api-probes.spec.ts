import { expect, test } from "@playwright/test"

const sessionToken = process.env.POST_DEPLOY_ADMIN_SESSION
const sessionCookieName =
  process.env.POST_DEPLOY_ADMIN_SESSION_COOKIE_NAME ?? "__Secure-authjs.session-token"
const baseUrl = process.env.BASE_URL

test.describe("Post-deployment API probes", () => {
  test.skip(
    process.env.POST_DEPLOY_PROBE !== "true" || !baseUrl || !sessionToken,
    "Requires POST_DEPLOY_PROBE, BASE_URL, and a short-lived admin session token."
  )

  test.beforeEach(async ({ context }) => {
    const hostname = new URL(baseUrl!).hostname
    await context.addCookies([
      {
        name: sessionCookieName,
        value: sessionToken!,
        domain: hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ])
  })

  test("loads scope projects", async ({ page }) => {
    const response = await page.request.get("/api/projects?type=scope")

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.projects)).toBe(true)
    expect(body.projects.every((project: { type?: string }) => project.type === "major")).toBe(true)
  })

  test("resolves each sampled management user by its served ID", async ({ page }) => {
    const usersResponse = await page.request.get("/api/users")

    expect(usersResponse.status()).toBe(200)
    const body = await usersResponse.json()
    expect(Array.isArray(body.users)).toBe(true)

    const users = body.users as Array<{ id?: string }>
    test.skip(users.length === 0, "No management users are configured in this environment.")

    for (const user of users.slice(0, 5)) {
      expect(typeof user.id).toBe("string")
      const response = await page.request.get(`/api/users/${encodeURIComponent(user.id!)}`)
      expect(response.status()).toBe(200)
    }
  })
})
