import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { findUserByEmailAsync, findOrCreateOidcUserAsync } from "@/lib/users"
import { logger } from "@/lib/logger"

/**
 * The IdP's email claim is only trustworthy when it is also marked verified.
 * Accepts boolean `true` or string "true" — IdPs differ in how they serialize
 * the claim. Fail-closed: a missing or any-other value is treated as unverified.
 *
 * Without this gate, an account registered at the IdP with an unverified address
 * could be auto-linked by email to a local user — including the admin persona —
 * which is a direct account-takeover / privilege-escalation path.
 */
function isEmailVerified(claims: Record<string, unknown>): boolean {
  const v = claims.email_verified
  return v === true || v === "true"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, profile }) {
      const claims = (profile ?? {}) as Record<string, unknown>
      if (!isEmailVerified(claims)) {
        logger.warn("OIDC sign-in rejected: email not verified")
        return false
      }
      const rawEmail = user?.email ?? profile?.email
      const email = typeof rawEmail === "string" ? rawEmail.toLowerCase() : null
      if (!email) {
        logger.warn("OIDC sign-in rejected: no email claim")
        return false
      }
      let local = await findUserByEmailAsync(email)
      if (!local) {
        // When auto-provisioning is enabled, admit any IdP-verified user and
        // create a minimal record on first sign-in (profile completed during
        // onboarding). Otherwise fail closed to pre-provisioned users only.
        if (process.env.OIDC_AUTO_PROVISION !== "true") {
          logger.warn("OIDC sign-in rejected: email not in local user store", { email })
          return false
        }
        const displayName =
          typeof claims.name === "string"
            ? claims.name
            : typeof claims.given_name === "string"
              ? claims.given_name
              : null
        local = await findOrCreateOidcUserAsync(email, displayName)
        logger.info("OIDC sign-in auto-provisioned new user", { email, userId: local.id })
      }
      const enriched = user as {
        userId?: string
        role?: typeof local.role
        email?: string | null
      }
      enriched.userId = local.id
      enriched.role = local.role
      enriched.email = local.email
      return true
    },
  },
})
