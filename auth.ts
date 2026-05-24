import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { findUserByEmailAsync } from "@/lib/users"
import { logger } from "@/lib/logger"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, profile }) {
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
