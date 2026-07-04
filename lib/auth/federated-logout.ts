import { logger } from "@/lib/logger"

// Discovery of the RP-initiated-logout endpoint is cached per issuer for the
// life of the server process: it effectively never changes, and re-fetching on
// every sign-out would add latency to a user-facing action.
const endSessionEndpointCache = new Map<string, string>()

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

/**
 * Resolve the IdP's RP-initiated-logout endpoint. Prefers the value advertised
 * by OIDC discovery (`end_session_endpoint`); falls back to OpenIddict's
 * conventional `/connect/endsession` path when discovery is unreachable or
 * omits it (Mystira runs OpenIddict). Never throws — sign-out must degrade
 * gracefully rather than fail on a discovery hiccup.
 */
export async function resolveEndSessionEndpoint(issuer: string): Promise<string> {
  const cached = endSessionEndpointCache.get(issuer)
  if (cached) return cached

  const fallback = `${trimTrailingSlash(issuer)}/connect/endsession`
  try {
    const res = await fetch(`${trimTrailingSlash(issuer)}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const doc = (await res.json()) as { end_session_endpoint?: unknown }
      const endpoint =
        typeof doc.end_session_endpoint === "string" ? doc.end_session_endpoint : fallback
      endSessionEndpointCache.set(issuer, endpoint)
      return endpoint
    }
    logger.warn("OIDC discovery for end_session_endpoint returned non-OK; using fallback", {
      issuer,
      status: res.status,
    })
  } catch (err) {
    logger.warn("OIDC discovery for end_session_endpoint failed; using fallback", {
      issuer,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return fallback
}

/**
 * Build an RP-initiated-logout URL per the OIDC session-management spec:
 * `end_session_endpoint?id_token_hint=…&post_logout_redirect_uri=…`. The
 * `id_token_hint` lets the IdP identify and end the correct session; the
 * `post_logout_redirect_uri` must be pre-registered at the IdP or it is ignored.
 */
export function buildEndSessionUrl(params: {
  endSessionEndpoint: string
  idToken: string
  postLogoutRedirectUri: string
}): string {
  const url = new URL(params.endSessionEndpoint)
  url.searchParams.set("id_token_hint", params.idToken)
  url.searchParams.set("post_logout_redirect_uri", params.postLogoutRedirectUri)
  return url.toString()
}
