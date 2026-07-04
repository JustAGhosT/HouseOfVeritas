import { encode } from "next-auth/jwt"
import type { BrowserContext } from "@playwright/test"

// Shared with the dev server the E2E webServer boots — playwright.config.ts
// pins AUTH_SECRET into process.env before spawning it, so the cookie we mint
// here decrypts with the same key Auth.js uses to read it. Keep the fallback in
// sync with playwright.config.ts.
const AUTH_SECRET = process.env.AUTH_SECRET ?? "e2e-insecure-test-secret-do-not-use-in-production"

// Non-secure cookie name (E2E runs over http://localhost). Auth.js uses the
// cookie name as the JWE salt, so this must match on both encode and decode.
const SESSION_COOKIE = "authjs.session-token"

export type SeedUser = {
  id: string
  role: "admin" | "operator" | "resident" | "employee"
  email: string
  name?: string
}

/**
 * Inject a valid Auth.js JWT-strategy session cookie for `user`, standing in for
 * a completed Mystira OIDC round-trip. This exercises everything downstream of
 * the handshake — session consumption in `proxy.ts`, dashboard routing, and
 * sign-out — without needing a live or mocked IdP (the handshake itself belongs
 * to a separate mocked-IdP integration test). The minted token carries no
 * `id_token`, so sign-out takes the local-only path rather than an IdP redirect.
 */
export async function seedSession(context: BrowserContext, user: SeedUser): Promise<void> {
  const value = await encode({
    salt: SESSION_COOKIE,
    secret: AUTH_SECRET,
    token: {
      sub: user.id,
      userId: user.id,
      role: user.role,
      email: user.email,
      name: user.name ?? user.id,
    },
  })

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ])
}
