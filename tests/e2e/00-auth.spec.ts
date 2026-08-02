import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { seedSession } from "./helpers/auth"

const LOGIN_RENDER_TIMEOUT = 15000

// The Auth.js v5 + Mystira OIDC migration (PR #62) removed the local
// bcrypt/JWT password form. /login is now a single "Continue with Mystira"
// button that redirects to the Mystira OIDC provider.
//
// The real OIDC handshake (browser -> IdP -> callback) needs a live/mocked
// Mystira and stays out of CI. Everything downstream of the handshake — session
// consumption, dashboard routing, sign-out, and the failed-sign-in error
// surface — is covered here by seeding a valid Auth.js session cookie
// (helpers/auth.ts) instead of driving the IdP. Full mocked-IdP handshake
// coverage is tracked under baton 7ad9342d.
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

  test("an authenticated session lands on the matching dashboard", async ({ context, page }) => {
    await seedSession(context, { id: "hans", role: "admin", email: "smit.jurie@gmail.com" })
    // From the public landing page, a recognized session is forwarded to its
    // own dashboard rather than left on a page with no authenticated view.
    await page.goto("/")
    await page.waitForURL("**/dashboard/hans**", { timeout: LOGIN_RENDER_TIMEOUT })
    // The authenticated shell renders the profile menu (two instances exist for
    // the responsive desktop/mobile chrome — asserting one is present is enough).
    await expect(page.getByTestId("user-profile-trigger").first()).toBeVisible({
      timeout: LOGIN_RENDER_TIMEOUT,
    })
  })

  test("signs out and returns to the login page", async ({ context, page }) => {
    await seedSession(context, { id: "hans", role: "admin", email: "smit.jurie@gmail.com" })
    await page.goto("/dashboard/hans")
    await page.waitForURL("**/dashboard/hans**", { timeout: LOGIN_RENDER_TIMEOUT })

    // Open the profile menu and sign out. The seeded session carries no
    // id_token, so logout takes the local-only path (no IdP redirect).
    await page.getByTestId("user-profile-trigger").first().click()
    await page.getByTestId("header-logout").first().click()

    await page.waitForURL("**/login**", { timeout: LOGIN_RENDER_TIMEOUT })
    await waitForLoginButton(page)

    // Session is gone: navigating back to a protected route bounces to /login.
    await page.goto("/dashboard/hans")
    await page.waitForURL("**/login**", { timeout: LOGIN_RENDER_TIMEOUT })
  })

  test("surfaces a rejected sign-in on the login page", async ({ page }) => {
    // Auth.js redirects a failed sign-in to /login?error=<code>; AccessDenied is
    // what our signIn callback returns for an unrecognized/unverified identity.
    await page.goto("/login?error=AccessDenied")
    await waitForLoginButton(page)
    const errorBox = page.getByTestId("login-error")
    await expect(errorBox).toBeVisible({ timeout: LOGIN_RENDER_TIMEOUT })
    await expect(errorBox).toContainText("estate registry")
  })

  test("offers a resumable action after an interrupted Mystira callback", async ({ page }) => {
    await page.goto("/login?error=OAuthCallbackError")
    await waitForLoginButton(page)

    await expect(page.getByTestId("login-error")).toContainText(
      "Continue again to resume or finish your account setup"
    )
    await expect(page.getByTestId("login-submit")).toContainText("Continue with Mystira")
  })
})
