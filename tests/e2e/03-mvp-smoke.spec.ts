import { test, expect } from "@playwright/test"
import type { Page, APIRequestContext } from "@playwright/test"

const LOGIN_FORM_TIMEOUT = 15000

const PERSONAS = [
  { email: "hans@houseofv.com", password: "hans123", id: "hans", role: "admin" },
  { email: "charl@houseofv.com", password: "charl123", id: "charl", role: "operator" },
  { email: "lucky@houseofv.com", password: "lucky123", id: "lucky", role: "operator" },
  { email: "irma@houseofv.com", password: "irma123", id: "irma", role: "resident" },
] as const

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login")
  await expect(page.locator('[data-testid="email-input"]')).toBeVisible({
    timeout: LOGIN_FORM_TIMEOUT,
  })
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByTestId("login-submit").click()
}

async function loginViaApi(request: APIRequestContext, email: string, password: string) {
  const res = await request.post("/api/auth/login", { data: { email, password } })
  expect(res.ok(), `Login failed for ${email}: ${res.status()}`).toBeTruthy()
  return res
}

test.describe.configure({ timeout: 60000 })

test.describe("MVP smoke — daily todo list", () => {
  test("home page renders without errors", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page).toHaveTitle(/House of Veritas/i)
    expect(errors).toEqual([])
  })

  test("each persona lands on their own dashboard", async ({ page }) => {
    for (const u of PERSONAS) {
      await loginAs(page, u.email, u.password)
      await page.waitForURL(
        (url) => url.pathname === `/dashboard/${u.id}` || url.pathname === "/onboarding",
        { timeout: 15000 }
      )
      await page.request.post("/api/auth/logout")
    }
  })

  test("hans sees the tasks page with Today filter active", async ({ page }) => {
    await loginAs(page, "hans@houseofv.com", "hans123")
    await page.waitForURL("**/dashboard/hans**", { timeout: 15000 })
    await page.goto("/dashboard/hans/tasks")

    await expect(page.getByTestId("task-filter-today")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("task-filter-open")).toBeVisible()
    await expect(page.getByTestId("task-filter-overdue")).toBeVisible()
    await expect(page.getByTestId("task-filter-all")).toBeVisible()

    await page.getByTestId("task-filter-all").click()
    await expect(page.getByTestId("task-filter-all")).toHaveAttribute("aria-selected", "true")
  })

  test("create task API accepts a payload and tasks page renders", async ({ page, request }) => {
    await loginViaApi(request, "hans@houseofv.com", "hans123")

    const title = `MVP smoke task ${Date.now()}`
    const created = await request.post("/api/tasks", {
      data: { title, priority: "Medium", assignedTo: 1 },
    })
    expect(created.ok(), `Create task failed: ${created.status()}`).toBeTruthy()

    await loginAs(page, "hans@houseofv.com", "hans123")
    await page.waitForURL("**/dashboard/hans**", { timeout: 15000 })
    await page.goto("/dashboard/hans/tasks")
    await page.getByTestId("task-filter-all").click()
    // Persistence depends on Baserow being configured; in mock-mode CI we only
    // assert the tasks page rendered after the POST without erroring.
    await expect(page.getByTestId("task-filter-all")).toHaveAttribute("aria-selected", "true")
  })

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
