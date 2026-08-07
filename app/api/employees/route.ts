import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { routeToInngest } from "@/lib/workflows"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  try {
    if (id) {
      const parsedId = parseInt(id, 10)
      if (isNaN(parsedId)) {
        return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
      }
      const employee = await getEstateRepository().employees.get(parsedId)
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }
      return withDataSource({ employee })
    }

    const employees = await getEstateRepository().employees.list()
    return withDataSource({ employees, total: employees.length })
  } catch (error) {
    logger.error("Error fetching employees", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 })
  }
}

export const POST = withRole("admin")(async (request) => {
  try {
    const estate = getEstateRepository()
    if (!estate.employees.isConfigured()) {
      return NextResponse.json(
        { error: "Employee creation requires a configured estate datastore" },
        { status: 503 }
      )
    }
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 })
      }
      throw err
    }

    const {
      fullName,
      idNumber,
      role = "Employee",
      employmentStartDate,
      email,
      phone,
      leaveBalance = 0,
    } = body as Record<string, unknown>

    if (!fullName || !email) {
      return NextResponse.json({ error: "fullName and email are required" }, { status: 400 })
    }

    const employee = await estate.employees.create({
      fullName: String(fullName),
      idNumber: idNumber ? String(idNumber) : undefined,
      role: String(role),
      employmentStartDate:
        typeof employmentStartDate === "string" ? employmentStartDate : undefined,
      email: String(email),
      phone: typeof phone === "string" ? phone : "",
      leaveBalance: typeof leaveBalance === "number" ? leaveBalance : 0,
    })

    if (!employee) {
      return NextResponse.json({ error: "Failed to create employee" }, { status: 500 })
    }

    // Wrap routeToInngest in its own try-catch to prevent workflow errors from affecting response
    try {
      await routeToInngest({
        name: "house-of-veritas/employee.created",
        data: {
          employeeId: employee.id,
          name: employee.fullName,
          email: employee.email,
        },
      })
    } catch (inngestError) {
      logger.error("Failed to emit employee.created event", {
        error: inngestError instanceof Error ? inngestError.message : String(inngestError),
        employeeId: employee.id,
        email: employee.email,
        name: employee.fullName,
      })
      // Continue with success response - employee was created successfully
    }

    return withDataSource({ employee })
  } catch (error) {
    logger.error("POST employee error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 })
  }
})
