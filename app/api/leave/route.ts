import { resolveEmployeeForGet, resolveEmployeeForPost } from "@/lib/api/employee-resolver"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import type { LeaveRequest } from "@/lib/domain/estate-types"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { toISODateString } from "@/lib/utils"
import { routeToInngest } from "@/lib/workflows"
import { NextResponse } from "next/server"

function daysBetween(start: string, end: string): number {
  const a = new Date(start)
  const b = new Date(end)
  const diff = (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.floor(diff) + 1)
}

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const { employeeId: employee, error } = await resolveEmployeeForGet(context, searchParams, {
    paramName: "employee",
  })
  if (error) return error

  try {
    const requests = await getEstateRepository().leaveRequests.list({
      employee,
      status: status || undefined,
    })
    return withDataSource({ requests })
  } catch (error) {
    logger.error("Error fetching leave requests", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 })
  }
})

export const POST = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  try {
    const body = await request.json()
    const { startDate, endDate, type, notes } = body

    const { employeeId: resolvedEmployeeId, error } = await resolveEmployeeForPost(
      body,
      request,
      context,
      { paramName: "employee", required: true }
    )
    if (error) return error
    const employeeId = resolvedEmployeeId!

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 })
    }

    const days = daysBetween(startDate, endDate)
    const emp = await getEstateRepository().employees.get(employeeId)
    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    if (type === "Annual" || !type) {
      const balance = emp.leaveBalance ?? 0
      if (days > balance) {
        return NextResponse.json(
          {
            error: "Insufficient leave balance",
            balance,
            requested: days,
          },
          { status: 400 }
        )
      }
    }

    const leaveRequest = await getEstateRepository().leaveRequests.create({
      employee: employeeId,
      startDate,
      endDate,
      type: type || "Annual",
      status: "Pending",
      submittedAt: toISODateString(),
      notes,
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
    }

    await routeToInngest({
      name: "house-of-veritas/leave.request.submitted",
      data: {
        id: leaveRequest.id,
        employeeId,
        startDate,
        endDate,
        type: leaveRequest.type,
        days,
      },
    })

    return withDataSource({ leaveRequest })
  } catch (error) {
    logger.error("Error creating leave request", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
  }
})

export const PATCH = withRole("admin")(async (request) => {
  try {
    const body = await request.json()
    const { id, status, approver, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })
    }

    // Fetch existing request to check for status transition
    const existingRequest = await getEstateRepository().leaveRequests.get(id)
    if (!existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }
    const previousStatus = existingRequest.status

    const updates: Record<string, unknown> = { ...rest }
    if (status) updates.status = status
    if (approver) updates.approver = approver
    if (status === "Approved" || status === "Rejected") {
      updates.approvedAt = toISODateString()
    }

    const leaveRequest = await getEstateRepository().leaveRequests.update(
      id,
      updates as Partial<LeaveRequest>
    )

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Only deduct leave balance when transitioning TO Approved (not already Approved)
    if (status === "Approved" && previousStatus !== "Approved" && leaveRequest.type === "Annual") {
      const emp = await getEstateRepository().employees.get(leaveRequest.employee)
      if (emp) {
        const days = daysBetween(leaveRequest.startDate, leaveRequest.endDate)
        const newBalance = Math.max(0, (emp.leaveBalance ?? 0) - days)
        await getEstateRepository().employees.update(emp.id, { leaveBalance: newBalance })
      }
    }

    return withDataSource({ leaveRequest })
  } catch (error) {
    logger.error("Error updating leave request", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 })
  }
})
