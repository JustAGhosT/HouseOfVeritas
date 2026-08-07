import { isAdminOrOperator, type RouteContext } from "@/lib/auth/rbac"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { NextResponse } from "next/server"

export interface ResolveEmployeeForGetOptions {
  /** Query param name for employee filter, e.g. "employee" | "requester" | "issuedTo" | "driver" */
  paramName?: string
}

/**
 * Resolves employee ID for GET requests. Admins/operators can filter by param or personaId;
 * others are restricted to their own employee record.
 */
export async function resolveEmployeeForGet(
  context: RouteContext,
  searchParams: URLSearchParams,
  options: ResolveEmployeeForGetOptions = {}
): Promise<{ employeeId: number | undefined; error?: NextResponse }> {
  const paramName = options.paramName ?? "employee"
  const paramValue = searchParams.get(paramName)
  const personaId = searchParams.get("personaId")

  if (isAdminOrOperator(context.role)) {
    let employeeId: number | undefined
    if (paramValue) {
      employeeId = parseInt(paramValue, 10)
      if (Number.isNaN(employeeId)) employeeId = undefined
    } else if (personaId) {
      employeeId = (await getEstateRepository().employees.resolveIdByAppId(personaId)) ?? undefined
    } else {
      employeeId = undefined
    }
    return { employeeId }
  }

  const callerEmployeeId = (await getEstateRepository().employees.resolveIdByAppId(context.userId)) ?? undefined
  if (!callerEmployeeId) {
    return {
      employeeId: undefined,
      error: NextResponse.json(
        { error: "Unable to resolve your employee record" },
        { status: 403 }
      ),
    }
  }
  return { employeeId: callerEmployeeId }
}

export interface ResolveEmployeeForPostOptions {
  paramName?: string
  required?: boolean
  fallbackToCaller?: boolean
}

/**
 * Resolves employee ID for POST requests from body (param, personaId) and x-user-id header.
 */
export async function resolveEmployeeForPost(
  body: Record<string, unknown>,
  request: Request,
  context: RouteContext,
  options: ResolveEmployeeForPostOptions = {}
): Promise<{ employeeId: number | undefined; error?: NextResponse }> {
  const { paramName = "employee", required = true, fallbackToCaller = true } = options

  // Read body[paramName] first; apply cross-fallback for requester/employee
  let paramValue = body[paramName]
  if (paramValue == null) {
    if (paramName === "requester") {
      paramValue = body.employee
    } else if (paramName === "employee") {
      paramValue = body.requester
    } else {
      paramValue = body.requester ?? body.employee
    }
  }

  const personaId = body.personaId as string | undefined

  let employeeId: number | undefined

  if (paramValue != null && typeof paramValue === "number" && !Number.isNaN(paramValue)) {
    employeeId = paramValue
  } else if (paramValue != null) {
    const parsed = parseInt(String(paramValue), 10)
    employeeId = Number.isNaN(parsed) ? undefined : parsed
  }

  if (!employeeId && personaId) {
    employeeId = (await getEstateRepository().employees.resolveIdByAppId(personaId)) ?? undefined
  }
  if (!employeeId) {
    const auth = request.headers.get("x-user-id")
    if (auth) {
      employeeId = (await getEstateRepository().employees.resolveIdByAppId(auth)) ?? undefined
    }
  }
  if (!employeeId && fallbackToCaller) {
    employeeId = (await getEstateRepository().employees.resolveIdByAppId(context.userId)) ?? undefined
  }

  if (!employeeId && required) {
    const label = paramName === "requester" ? "Requester" : "Employee"
    return {
      employeeId: undefined,
      error: NextResponse.json({ error: `${label} is required` }, { status: 400 }),
    }
  }

  return { employeeId }
}
