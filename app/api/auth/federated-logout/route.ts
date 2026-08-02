import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { logger } from "@/lib/logger"
import { buildEndSessionUrl, resolveEndSessionEndpoint } from "@/lib/auth/federated-logout"

const issuer = process.env.MYSTIRA_OIDC_ISSUER?.trim() || "http://localhost:5262"

/**
 * Returns the Mystira RP-initiated-logout URL for the current session so the
 * client can end the IdP's SSO session (front-channel) after clearing the local
 * Auth.js cookie. Without this, sign-out only drops the local cookie and the
 * next "Continue with Mystira" click silently re-authenticates against the
 * still-live IdP session.
 *
 * Returns `{ url: null }` when there is no `id_token` to hint with (e.g. a
 * session minted without one, or in dev before the first real handshake) — the
 * client then falls back to a local-only sign-out. Any error also yields
 * `{ url: null }`: logout must never be blocked by this best-effort step.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth.js names the session cookie `__Secure-authjs.session-token` over
    // https and `authjs.session-token` otherwise; getToken must be told which so
    // it reads the right cookie. Detect from which one the request actually carries.
    const secureCookie = request.cookies.has("__Secure-authjs.session-token")
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie,
    })

    const idToken = typeof token?.id_token === "string" ? token.id_token : null
    if (!idToken) {
      return NextResponse.json({ url: null })
    }

    const base = process.env.AUTH_URL ?? new URL(request.url).origin
    const postLogoutRedirectUri =
      process.env.MYSTIRA_OIDC_POST_LOGOUT_REDIRECT_URI ?? new URL(base).origin

    const endSessionEndpoint = await resolveEndSessionEndpoint(
      issuer,
      process.env.MYSTIRA_OIDC_END_SESSION_ENDPOINT?.trim()
    )
    const url = buildEndSessionUrl({ endSessionEndpoint, idToken, postLogoutRedirectUri })
    return NextResponse.json({ url })
  } catch (err) {
    logger.error("Failed to build federated-logout URL", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ url: null })
  }
}
