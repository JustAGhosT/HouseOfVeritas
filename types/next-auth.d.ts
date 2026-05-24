import type { DefaultSession } from "next-auth"
import type { UserRole } from "@/lib/users"

declare module "next-auth" {
  interface User {
    userId?: string
    role?: UserRole
  }

  interface Session {
    user: {
      userId?: string
      role?: UserRole
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string
    role?: UserRole
    email?: string
    id_token?: string
  }
}
