"use client"

import { ConnectionStatus } from "@/components/connection-status"
import { ErrorBoundary } from "@/components/error-boundary"
import { SimpleGridBackground } from "@/components/grid-room-background"
import { NotificationPanel } from "@/components/notification-panel"
import { OnboardingTutorial } from "@/components/onboarding-tutorial"
import { RealTimeIndicator } from "@/components/realtime-indicator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { UserProfileDropdown } from "@/components/user-profile-dropdown"
import { WidgetErrorBoundary } from "@/components/widget-error-boundary"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useLoginModal } from "@/lib/login-modal-context"
import type { NavEntry } from "@/lib/nav-config"
import { getNavForPersona, isCategory } from "@/lib/nav-config"
import { generateCrest } from "@/lib/design/crest"
import { getDashboardPath, isPersonaId } from "@/lib/auth/dashboard-path"
import { ChevronRight, Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { startTransition, useEffect, useMemo, useRef, useState } from "react"

const PERSONA_INFO = {
  hans: { name: "Hans", role: "Owner & Administrator", color: "blue", icon: "👔" },
  charl: { name: "Charl", role: "Workshop Operator", color: "amber", icon: "🔧" },
  lucky: { name: "Lucky", role: "Gardener & Handyman", color: "green", icon: "🌿" },
  irma: { name: "Irma", role: "Resident", color: "purple", icon: "🏠" },
}

interface DashboardLayoutProps {
  children: React.ReactNode
  /** Dashboard owner (user id from URL). Nav is driven by this user's role. */
  persona: "hans" | "charl" | "lucky" | "irma"
}

function getFlatNavItems(entries: NavEntry[]): { name: string; href: string }[] {
  const items: { name: string; href: string }[] = []
  for (const e of entries) {
    if (isCategory(e)) {
      items.push(...e.items.map((i) => ({ name: i.name, href: i.href })))
    } else {
      items.push({ name: e.name, href: e.href })
    }
  }
  return items
}

export default function DashboardLayout({ children, persona }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isLoading, isAuthenticated, requiresAuth } = useAuth()
  const { openLoginModal } = useLoginModal()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const hasOpenedLogin = useRef(false)

  // Auth protection - open login modal when auth is required
  useEffect(() => {
    if (requiresAuth && !hasOpenedLogin.current) {
      hasOpenedLogin.current = true
      openLoginModal()
    }
    // Reset flag when user becomes authenticated
    if (!requiresAuth) {
      hasOpenedLogin.current = false
    }
  }, [requiresAuth, openLoginModal])

  // Removed unused handleLoginModalClose function

  useEffect(() => {
    if (!isLoading && user) {
      const dashboardOwner = pathname?.split("/")[2]
      if (!dashboardOwner || user.role === "admin") return
      // If the URL persona is one of the canonical four, the user is allowed
      // to stay only when it matches their own canonical persona.
      const own = getDashboardPath(user.id, user.role).split("/")[2]
      if (isPersonaId(dashboardOwner) && dashboardOwner.toLowerCase() === own) return
      router.push(getDashboardPath(user.id, user.role))
    }
  }, [isLoading, user, pathname, router])

  useEffect(() => {
    if (typeof window === "undefined" || !user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("tutorial") === "1" && user.onboardingStatus !== "completed") {
      startTransition(() => setShowTutorial(true))
    }
  }, [user, pathname])

  // Compute the persona crest before any early returns so hook order stays
  // stable across renders (React hooks rules).
  const personaInfo = PERSONA_INFO[persona]
  const crest = useMemo(() => generateCrest(personaInfo.name), [personaInfo.name])

  // Show loading while checking auth (only for protected routes)
  if (isLoading && requiresAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <button
          onClick={() => {
            hasOpenedLogin.current = true
            openLoginModal()
          }}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Login
        </button>
      </div>
    )
  }

  // For non-authenticated users on non-requiresAuth pages, show content
  if (!isAuthenticated && !requiresAuth) {
    return <>{children}</>
  }

  // Block rendering of protected pages for unauthenticated users
  if (requiresAuth && !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  // For authenticated users or requiresAuth pages, show loading or content
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  const isViewingOwnDashboard = user?.id === persona
  const navEntries = getNavForPersona(
    persona,
    isViewingOwnDashboard
      ? (user?.role as "admin" | "operator" | "employee" | "resident")
      : undefined,
    isViewingOwnDashboard ? user?.responsibilities : undefined
  )

  const colorClasses = {
    blue: "bg-primary",
    amber: "bg-muted",
    green: "bg-secondary",
    purple: "bg-accent",
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Grid Background */}
      <SimpleGridBackground />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 transform border-r border-border bg-card transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} `}
      >
        {/* Logo */}
        <div className="border-b border-border p-6 bg-linear-to-b from-card to-background relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <span className="font-serif text-8xl leading-none">{crest.suffix}</span>
          </div>
          <Link href="/" className="flex items-center gap-3 relative z-10">
            <div
              className={`h-10 w-10 rounded-xl ${colorClasses[personaInfo.color as keyof typeof colorClasses]} flex items-center justify-center`}
            >
              <span className="font-serif text-2xl leading-none text-primary-foreground">
                {crest.core}
              </span>
            </div>
            <div>
              <h1 className="font-serif text-sm font-semibold text-foreground">House of Veritas</h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mt-0.5">Sanctum</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="h-[calc(100%-180px)] space-y-1 overflow-y-auto p-4">
          {navEntries.map((entry, idx) => {
            if (isCategory(entry)) {
              const hasActive = entry.items.some((i) => pathname === i.href)
              return (
                <Collapsible key={entry.category} defaultOpen={hasActive}>
                  <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
                    <ChevronRight className="h-5 w-5 transition-transform group-data-[state=open]:rotate-90" />
                    <span className="text-sm font-medium tracking-wider uppercase">
                      {entry.category}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 ml-4 space-y-1 border-l border-border pl-3">
                      {entry.items.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                              isActive
                                ? `${colorClasses[personaInfo.color as keyof typeof colorClasses]} text-primary-foreground`
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            } `}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            }
            const isActive = pathname === entry.href
            const Icon = entry.icon
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                  isActive
                    ? `${colorClasses[personaInfo.color as keyof typeof colorClasses]} text-primary-foreground`
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } `}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{entry.name}</span>
              </Link>
            )
          })}

          {/* Admin: View Other Dashboards */}
          {user?.id === "hans" && persona === "hans" && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 px-4 text-xs tracking-wider text-muted-foreground uppercase">View Team</p>
              {["charl", "lucky", "irma"].map((userId) => {
                const info = PERSONA_INFO[userId as keyof typeof PERSONA_INFO]
                return (
                  <Link
                    key={userId}
                    href={`/dashboard/${userId}`}
                    className="flex items-center gap-3 rounded-xl px-4 py-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  >
                    <span className="text-lg">{info.icon}</span>
                    <span className="text-sm">{info.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className="absolute right-0 bottom-0 left-0 border-t border-border p-4">
          <div className="rounded-xl bg-muted/50 p-2">
            <UserProfileDropdown
              user={{
                id: user?.id ?? persona,
                name: user?.name ?? "",
                email: user?.email ?? "",
                phone: user?.phone,
                role: user?.role ?? "",
                color: (user as { color?: string })?.color,
                icon: (user as { icon?: string })?.icon,
                photoUrl: (user as { photoUrl?: string })?.photoUrl,
              }}
              personaInfo={personaInfo}
              onLogout={handleLogout}
              onRepeatTutorial={() => setShowTutorial(true)}
              compact
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Page Title - Hidden on mobile */}
            <div className="hidden lg:block">
              <h2 className="font-serif font-semibold text-foreground">
                Welcome back, {user?.name || personaInfo.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-ZA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <ConnectionStatus />
              <WidgetErrorBoundary>
                <RealTimeIndicator />
              </WidgetErrorBoundary>

              {/* Notifications */}
              <WidgetErrorBoundary>
                <NotificationPanel />
              </WidgetErrorBoundary>

              {/* User Profile Dropdown */}
              <div className="hidden md:block">
                <WidgetErrorBoundary>
                  <UserProfileDropdown
                    user={{
                      id: user?.id ?? persona,
                      name: user?.name ?? "",
                      email: user?.email ?? "",
                      phone: user?.phone,
                      role: user?.role ?? "",
                      color: (user as { color?: string })?.color,
                      icon: (user as { icon?: string })?.icon,
                      photoUrl: (user as { photoUrl?: string })?.photoUrl,
                    }}
                    personaInfo={personaInfo}
                    onLogout={handleLogout}
                    onRepeatTutorial={() => setShowTutorial(true)}
                  />
                </WidgetErrorBoundary>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>

        {showTutorial && user && (
          <OnboardingTutorial
            steps={[
              {
                title: "Welcome to your dashboard",
                body: "This is your personal workspace. Use the sidebar to navigate.",
              },
              ...getFlatNavItems(navEntries)
                .slice(0, 5)
                .map((i) => ({
                  title: i.name,
                  body: `Use this to access ${i.name.toLowerCase()}.`,
                })),
              { title: "You're all set!", body: "Explore the platform at your own pace." },
            ]}
            onComplete={async () => {
              setShowTutorial(false)
              router.replace(pathname || `/dashboard/${user.id}`)
              await apiFetch("/api/users/me/onboard", { method: "POST", label: "Onboard" })
              router.refresh()
            }}
          />
        )}
      </div>
    </div>
  )
}
