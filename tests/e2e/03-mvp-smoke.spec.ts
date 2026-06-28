import { test, expect } from "@playwright/test"

// The persona login helpers (UI password form + /api/auth/login) were removed
// by the Auth.js v5 + Mystira OIDC migration (PR #62). The persona/dashboard
// and task-page smoke checks below need a signed-in session, which now requires
// the OIDC IdP — they are test.fixme()'d pending a live/mocked Mystira provider
// (baton 7ad9342d + /team-testing). The unauthenticated smoke checks still run.

test.describe.configure({ timeout: 60000 })

test.describe("MVP smoke — daily todo list", () => {
  test("home page renders without errors", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page).toHaveTitle(/House of Veritas/i)
    expect(errors).toEqual([])
  })

  // Require a signed-in session (see file header) — pending live/mocked Mystira IdP.
  test.fixme("each persona lands on their own dashboard", async () => {})
  test.fixme("hans sees the tasks page with Today filter active", async () => {})
  test.fixme("create task API accepts a payload and tasks page renders", async () => {})

  test("kiosk page renders for unauthenticated visitors", async ({ page }) => {
    await page.goto("/kiosk")
    await expect(page.locator("body")).toBeVisible()
    expect(page.url()).toContain("/kiosk")
  })

  test("public assets serve (manifest, favicon)", async ({ request }) => {
    const manifest = await request.get("/manifest.json")
    expect(manifest.ok()).toBeTruthy()
    const json = await manifest.json()
    expect(json.name).toMatch(/Veritas/i)
  })

  test("api/health is reachable", async ({ request }) => {
    const res = await request.get("/api/health")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toMatch(/healthy|degraded/)
  })
})
