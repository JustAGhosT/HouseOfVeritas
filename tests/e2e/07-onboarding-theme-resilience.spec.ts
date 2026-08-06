import { expect, test, type Page } from "@playwright/test"
import { seedSession } from "./helpers/auth"

/**
 * Onboarding saves the chosen workspace theme through an optional
 * `PATCH /api/users/me` call. That preference must never gate completion: a user
 * whose theme save fails still has to be able to finish onboarding and reach
 * their dashboard.
 *
 * The theme save is issued from the browser, so Playwright can fail it directly
 * without touching the server or any production state.
 *
 * Users resolve without Postgres in this environment, where every id except
 * `hans` reports onboardingStatus "pending" (lib/user-management.ts) — so a
 * seeded non-admin session lands on onboarding rather than being redirected past
 * it.
 */
const pendingUser = {
  id: "charl",
  role: "operator" as const,
  email: "charl@example.invalid",
}

async function failThemeSave(page: Page) {
  await page.route("**/api/users/me", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback()
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Update failed" }),
    })
  })
}

test.describe("onboarding survives a failed theme save", () => {
  test.beforeEach(async ({ context, page }) => {
    await seedSession(context, pendingUser)
    await failThemeSave(page)
  })

  test("completes onboarding and reaches the dashboard when the theme PATCH fails", async ({
    page,
  }) => {
    await page.goto("/onboarding")
    await expect(page.getByTestId("onboarding-page")).toBeVisible()

    const startTutorial = page.getByTestId("onboarding-start-tutorial")
    await expect(startTutorial).toBeDisabled()

    await page.locator("#confirm-role").click()
    await page.locator("#confirm-resp").click()
    await expect(startTutorial).toBeEnabled()

    const themeSave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/users/me") &&
        response.request().method() === "PATCH" &&
        response.status() === 500
    )

    await startTutorial.click()

    // Prove the failure actually happened rather than passing because the call
    // was never made.
    await themeSave

    await expect(page).toHaveURL(new RegExp(`/dashboard/${pendingUser.id}\\?tutorial=1$`))
  })

  test("leaves onboarding via Complete later when the theme PATCH fails", async ({ page }) => {
    await page.goto("/onboarding")
    await expect(page.getByTestId("onboarding-page")).toBeVisible()

    const themeSave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/users/me") &&
        response.request().method() === "PATCH" &&
        response.status() === 500
    )

    await page.getByTestId("onboarding-complete-later").click()
    await themeSave

    await expect(page).toHaveURL(new RegExp(`/dashboard/${pendingUser.id}$`))
  })
})
