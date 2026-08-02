import type { NextAuthConfig } from "next-auth"
import type { UserRole } from "@/lib/users"

// Defaults are dev-only. In production, set MYSTIRA_OIDC_* envs explicitly;
// the OIDC handshake will fail loudly at first sign-in if these are missing
// or wrong — we don't throw at module-load so `next build` page-data
// collection doesn't fail when envs aren't injected at build time.
const defaultMystiraIssuer = "http://localhost:5262"
const mystiraIssuer = process.env.MYSTIRA_OIDC_ISSUER?.trim() || defaultMystiraIssuer
const configuredMystiraAuthorizationEndpoint =
  process.env.MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT?.trim()

function resolveMystiraAuthorizationEndpoint(
  configured: string | undefined,
  issuer: string
): string {
  if (configured) {
    try {
      const endpoint = new URL(configured)
      if (
        endpoint.protocol === "https:" &&
        endpoint.username === "" &&
        endpoint.password === "" &&
        endpoint.pathname === "/connect/authorize" &&
        endpoint.search === "" &&
        endpoint.hash === ""
      ) {
        return endpoint.toString()
      }
    } catch {
      // Fall through to the canonical issuer endpoint.
    }
  }

  try {
    return new URL("/connect/authorize", issuer).toString()
  } catch {
    // Preserve module-load safety for a malformed issuer. The issuer itself is
    // left unchanged so discovery still fails loudly when sign-in is attempted.
    return `${defaultMystiraIssuer}/connect/authorize`
  }
}

const mystiraAuthorizationEndpoint = resolveMystiraAuthorizationEndpoint(
  configuredMystiraAuthorizationEndpoint,
  mystiraIssuer
)
const mystiraClientId = process.env.MYSTIRA_OIDC_CLIENT_ID ?? "neuralliquid-hov-web"
const mystiraClientSecret =
  process.env.MYSTIRA_OIDC_CLIENT_SECRET ?? "hov-dev-secret-change-in-staging"

export default {
  providers: [
    {
      id: "mystira",
      name: "Mystira",
      type: "oidc",
      issuer: mystiraIssuer,
      clientId: mystiraClientId,
      clientSecret: mystiraClientSecret,
      // The browser-facing authorization endpoint may use an HOV-owned custom
      // hostname while discovery, JWKS, token exchange, and token issuer remain
      // anchored to Mystira Identity. Keeping these settings separate preserves
      // the RP/OP trust boundary without exposing a Mystira-branded browser hop.
      authorization: {
        url: mystiraAuthorizationEndpoint,
        params: { scope: "openid profile email offline_access" },
      },
      checks: ["pkce", "state"],
    },
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user, account }) {
      if (user) {
        const enriched = user as { userId?: string; role?: UserRole; email?: string | null }
        if (enriched.userId) token.userId = enriched.userId
        if (enriched.role) token.role = enriched.role
        if (enriched.email) token.email = enriched.email
      }
      if (account?.id_token) {
        token.id_token = account.id_token
      }
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.userId = token.userId as string
      if (token.role) session.user.role = token.role as UserRole
      if (token.email) session.user.email = token.email as string
      return session
    },
  },
} satisfies NextAuthConfig
