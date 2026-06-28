import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"

const LOGIN_RENDER_TIMEOUT = 15000

// The Auth.js v5 + Mystira OIDC migration (PR #62) removed the local
// bcrypt/JWT password form. /login is now a single "Continue with Mystira"
// button that redirects to the Mystira OIDC provider. Only the cases that
// don't require completing a sign-in can run in CI; the credential round-trip
// cases need a live (or mocked) Mystira IdP and are test.fixme()'d below —
// tracked under baton 7ad9342d (browser sign-in flow) + /team-testing for
// mocked-IdP OIDC E2E coverage.
async function waitForLoginButton(page: Page) {
  await expect(page.getByTestId("login-card")).toBeVisible({ timeout: LOGIN_RENDER_TIMEOUT })
  await expect(page.getByTestId("login-submit")).toBeVisible({ timeout: LOGIN_RENDER_TIMEOUT })
}

test.describe.configure({ timeout: 60000 })

test.describe("Authentication", () => {
  test("login page renders the Mystira sign-in button", async ({ page }) => {
    await page.goto("/login")
    await waitForLoginButton(page)
    await expect(page.getByRole("heading", { name: "House of Veritas" })).toBeVisible()
    await expect(page.getByTestId("login-submit")).toContainText("Continue with Mystira")
  })

  test("redirects unauthenticated users to the login page", async ({ page }) => {
    await page.goto("/dashboard/hans")
    await page.waitForURL("**/login**", { timeout: LOGIN_RENDER_TIMEOUT })
    await waitForLoginButton(page)
  })

  // Round-trip auth requires a live/mocked Mystira OIDC provider — the local
  // password flow these used to cover no longer exists. See baton 7ad9342d
  // (next-action: browser sign-in against the live IdP) and /team-testing for
  // OIDC E2E coverage with a mocked IdP (sign-in success per persona, sign-out,
  // and the ?error= callback surface on the login page).
  test.fixme("signs in via Mystira and lands on the matching dashboard", async () => {})
  test.fixme("signs out and returns to the login page", async () => {})
  test.fixme("surfaces OIDC auth errors on the login page", async () => {})
})
