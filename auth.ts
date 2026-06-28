import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { findUserByEmailAsync } from "@/lib/users"
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
      const local = await findUserByEmailAsync(email)
      if (!local) {
        logger.warn("OIDC sign-in rejected: email not in local user store", { email })
        return false
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
