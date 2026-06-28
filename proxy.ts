import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { rateLimitAsync } from "@/lib/auth/rate-limit-edge"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/health",
  "/api/kiosk",
  "/kiosk",
  "/offline",
  "/login",
  "/",
]

const API_RATE_LIMIT = 100
const API_WINDOW_MS = 60_000

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PATHS.some((p) => p.endsWith("/") === false && pathname.startsWith(p + "/"))
}

export const proxy = auth(async (request) => {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?|ttf|eot|map|webmanifest)$/)
  ) {
    return NextResponse.next()
  }

  const kioskPatchRequiresAuth = pathname === "/api/kiosk/requests" && request.method === "PATCH"
  if (isPublicPath(pathname) && !kioskPatchRequiresAuth) {
    return NextResponse.next()
  }

  const isApiRoute = pathname.startsWith("/api/")
  const isDashboardRoute = pathname.startsWith("/dashboard")
  const isOnboardingRoute = pathname === "/onboarding" || pathname.startsWith("/onboarding/")

  if (!isApiRoute && !isDashboardRoute && !isOnboardingRoute) {
    return NextResponse.next()
  }

  const session = request.auth
  const sessionUser = session?.user as
    | { userId?: string; role?: string; email?: string }
    | undefined

  if (!session || !sessionUser?.userId || !sessionUser.role || !sessionUser.email) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  if (isApiRoute) {
    const rl = await rateLimitAsync(`api:${sessionUser.userId}`, API_RATE_LIMIT, API_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      )
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id", sessionUser.userId)
  requestHeaders.set("x-user-role", sessionUser.role)
  requestHeaders.set("x-user-email", sessionUser.email)

  if (isDashboardRoute) {
    const dashboardUser = pathname.split("/")[2]
    if (dashboardUser && dashboardUser !== sessionUser.userId && sessionUser.role !== "admin") {
      return NextResponse.redirect(new URL(`/dashboard/${sessionUser.userId}`, request.url))
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/onboarding", "/onboarding/:path*"],
}
