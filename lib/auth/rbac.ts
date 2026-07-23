import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/auth"
import type { UserRole } from "@/lib/users"
import {
  hasResponsibility,
  getDefaultResponsibilities,
  type Responsibility,
} from "@/lib/access-config"
import { getUserWithManagement } from "@/lib/user-management"

export interface AuthenticatedRequest extends NextRequest {
  userId: string
  userRole: UserRole
  userEmail: string
}

export function getAuthContext(request: Request): {
  userId: string
  role: UserRole
  email: string
  responsibilities?: string[]
} | null {
  const userId = request.headers.get("x-user-id")
  const role = request.headers.get("x-user-role") as UserRole | null
  const email = request.headers.get("x-user-email")
  const responsibilitiesHeader = request.headers.get("x-user-responsibilities")

  if (!userId || !role || !email) return null

  let responsibilities: string[]
  if (responsibilitiesHeader) {
    try {
      const parsed = JSON.parse(responsibilitiesHeader)
      responsibilities = Array.isArray(parsed)
        ? (parsed as string[])
        : getDefaultResponsibilities(role)
    } catch {
      responsibilities = getDefaultResponsibilities(role)
    }
  } else {
    responsibilities = getDefaultResponsibilities(role)
  }

  return { userId, role, email, responsibilities }
}

async function resolveAuthContext(request: Request): Promise<{
  userId: string
  role: UserRole
  email: string
  responsibilities?: string[]
} | null> {
  try {
    const session = await auth()
    const userId = session?.user?.userId

    if (userId) {
      const managed = await getUserWithManagement(userId).catch(() => null)
      if (managed) {
        return {
          userId: managed.id,
          role: managed.role,
          email: managed.email,
          responsibilities: managed.responsibilities?.length
            ? managed.responsibilities
            : getDefaultResponsibilities(managed.role),
        }
      }

      if (session.user.role && session.user.email) {
        return {
          userId,
          role: session.user.role,
          email: session.user.email,
          responsibilities: getDefaultResponsibilities(session.user.role),
        }
      }
    }
  } catch {
    // Dev/test fallback below preserves route unit tests and local API harnesses.
  }

  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_HEADER_AUTH === "true" ||
    process.env.E2E_TEST === "1"
  ) {
    return getAuthContext(request)
  }

  return null
}

export function isAdminOrOperator(role: UserRole): boolean {
  return role === "admin" || role === "operator"
}

export type RouteContext = {
  userId: string
  role: UserRole
  email: string
  responsibilities?: string[]
  params?: Promise<Record<string, string>>
}

type RouteHandler = (
  request: Request,
  context: RouteContext
) => Promise<NextResponse> | NextResponse

export function withRole(...allowedRoles: UserRole[]) {
  return function (handler: RouteHandler) {
    return async function (
      request: Request,
      routeContext?: { params?: Promise<Record<string, string>> }
    ) {
      const authContext = await resolveAuthContext(request)
      if (!authContext) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      if (authContext.role !== "admin" && !allowedRoles.includes(authContext.role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const context: RouteContext = { ...authContext, params: routeContext?.params }
      return handler(request, context)
    }
  }
}

/**
 * Optional: require a specific responsibility for access.
 * Admin bypasses. Use when role alone is too coarse.
 */
export function withResponsibility(required: Responsibility) {
  return function (handler: RouteHandler) {
    return async function (
      request: Request,
      routeContext?: { params?: Promise<Record<string, string>> }
    ) {
      const authContext = await resolveAuthContext(request)
      if (!authContext) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      if (
        authContext.role !== "admin" &&
        !hasResponsibility(authContext.responsibilities ?? [], required)
      ) {
        return NextResponse.json({ error: `Requires responsibility: ${required}` }, { status: 403 })
      }

      const context: RouteContext = { ...authContext, params: routeContext?.params }
      return handler(request, context)
    }
  }
}

export function withAuth(handler: RouteHandler) {
  return async function (
    request: Request,
    routeContext?: { params?: Promise<Record<string, string>> }
  ) {
    const authContext = await resolveAuthContext(request)
    if (!authContext) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const context: RouteContext = { ...authContext, params: routeContext?.params }
    return handler(request, context)
  }
}
