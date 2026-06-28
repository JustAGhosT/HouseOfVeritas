"use client"

import { usePathname, useRouter } from "next/navigation"
import { signOut as nextAuthSignOut } from "next-auth/react"
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react"
import { getDashboardPath, isPersonaId } from "@/lib/auth/dashboard-path"

interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  description: string
  color: string
  icon: string
  specialty: string[]
  photoUrl?: string
  onboardingStatus?: string
  responsibilities?: string[]
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  logout: () => Promise<void>
  isAuthenticated: boolean
  requiresAuth: boolean
  setRequiresAuth: (value: boolean) => void
  clearRequiresAuth: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setRequiresAuth(false)
      } else {
        setUser(null)
        setRequiresAuth(true)
      }
    } catch {
      setUser(null)
      setRequiresAuth(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (isLoading) return

    const isAuthPage = pathname === "/login"
    const isDashboardPage = pathname?.startsWith("/dashboard")
    const isOnboardingPage = pathname === "/onboarding"

    if (!user && isDashboardPage) {
      setRequiresAuth(true)
    } else if (user) {
      setRequiresAuth(false)
    }

    if (user && isAuthPage) {
      router.push(getDashboardPath(user.id, user.role))
    } else if (user && isOnboardingPage && user.onboardingStatus === "completed") {
      router.push(getDashboardPath(user.id, user.role))
    } else if (user && isDashboardPage) {
      const dashboardUser = pathname?.split("/")[2]
      if (dashboardUser && !isPersonaId(dashboardUser) && user.role !== "admin") {
        router.push(getDashboardPath(user.id, user.role))
      }
    }
  }, [user, isLoading, pathname, router])

  const logout = useCallback(async () => {
    setUser(null)
    setRequiresAuth(true)
    await nextAuthSignOut({ callbackUrl: "/login" })
  }, [])

  const clearRequiresAuth = useCallback(() => {
    setRequiresAuth(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        logout,
        isAuthenticated: !!user,
        requiresAuth,
        setRequiresAuth,
        clearRequiresAuth,
        refresh: checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { allowedUsers?: string[]; fallback?: ReactNode }
) {
  return function ProtectedComponent(props: P) {
    const { user, isLoading, isAuthenticated, requiresAuth } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && user && options?.allowedUsers) {
        if (!options.allowedUsers.includes(user.id) && user.role !== "admin") {
          router.push(`/dashboard/${user.id}`)
        }
      }
    }, [isLoading, user, router])

    useEffect(() => {
      if (!isLoading && requiresAuth && !isAuthenticated && !options?.fallback) {
        router.push("/login")
      }
    }, [isLoading, isAuthenticated, requiresAuth, router])

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
        </div>
      )
    }

    if (!isAuthenticated) {
      if (options?.fallback) {
        return <>{options.fallback}</>
      }
      return null
    }

    return <WrappedComponent {...props} />
  }
}
