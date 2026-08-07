import { NextResponse } from "next/server"
import type { PettyCash } from "@/lib/domain/estate-types"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { resolveEmployeeForGet, resolveEmployeeForPost } from "@/lib/api/employee-resolver"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { toISODateString } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { routeToInngest } from "@/lib/workflows"

const MAX_SINGLE_AMOUNT = 5000
const MAX_MONTHLY_PER_USER = 20000

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const { employeeId: requester, error } = await resolveEmployeeForGet(context, searchParams, {
    paramName: "requester",
  })
  if (error) return error

  try {
    const requests = await getEstateRepository().pettyCash.list({
      requester,
      status: status || undefined,
    })
    return withDataSource({ requests })
  } catch (error) {
    logger.error("Error fetching petty cash requests", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch petty cash requests" }, { status: 500 })
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
    const { amount, purpose, receipt, notes } = body

    const { employeeId: requesterId, error } = await resolveEmployeeForPost(
      body,
      request,
      context,
      { paramName: "requester", required: true }
    )
    if (error) return error
    const resolvedRequesterId = requesterId!

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    if (amount > MAX_SINGLE_AMOUNT) {
      await routeToInngest({
        name: "house-of-veritas/petty.cash.policy.violation",
        data: {
          requesterId: resolvedRequesterId,
          amount,
          purpose: purpose || "",
          reason: "Amount exceeds single-request limit",
        },
      })
      return NextResponse.json(
        { error: "Amount exceeds policy limit", max: MAX_SINGLE_AMOUNT },
        { status: 400 }
      )
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = toISODateString(monthStart)
    const existing = await getEstateRepository().pettyCash.list({ requester: resolvedRequesterId })
    const thisMonth = existing.filter((r) => {
      const created = r.createdAt || ""
      return created >= monthStartStr && (r.status === "Issued" || r.status === "Approved")
    })
    const monthlyTotal = thisMonth.reduce((s, r) => s + r.amount, 0)
    if (monthlyTotal + amount > MAX_MONTHLY_PER_USER) {
      await routeToInngest({
        name: "house-of-veritas/petty.cash.policy.violation",
        data: {
          requesterId: resolvedRequesterId,
          amount,
          purpose: purpose || "",
          reason: "Monthly limit exceeded",
        },
      })
      return NextResponse.json(
        {
          error: "Monthly petty cash limit exceeded",
          used: monthlyTotal,
          limit: MAX_MONTHLY_PER_USER,
        },
        { status: 400 }
      )
    }

    const pc = await getEstateRepository().pettyCash.create({
      requester: resolvedRequesterId,
      amount,
      purpose: purpose || "",
      receipt,
      status: "Pending",
      createdAt: toISODateString(),
      notes,
    })

    if (!pc) {
      return NextResponse.json({ error: "Failed to create petty cash request" }, { status: 500 })
    }

    await routeToInngest({
      name: "house-of-veritas/petty.cash.request.submitted",
      data: {
        id: pc.id,
        requesterId: resolvedRequesterId,
        amount,
        purpose: pc.purpose,
      },
    })

    return withDataSource({ pettyCash: pc })
  } catch (error) {
    logger.error("Error creating petty cash request", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create petty cash request" }, { status: 500 })
  }
})

export const PATCH = withRole("admin")(async (request, context) => {
  try {
    const body = await request.json()
    const { id, status, issuedBy, approvedBy, approvedAt, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: "Petty cash ID is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = { ...rest }
    if (status) updates.status = status
    if (issuedBy !== undefined) updates.issuedBy = issuedBy

    if (status === "Approved" || status === "Issued") {
      const approverId = approvedBy ?? (await getEstateRepository().employees.resolveIdByAppId(context.userId))
      if (!approverId || typeof approverId !== "number") {
        return NextResponse.json(
          {
            error: "Approved By (approver) is required when status is Approved or Issued",
          },
          { status: 400 }
        )
      }
      updates.approvedBy = approverId
      updates.approvedAt = approvedAt ?? toISODateString()
    }

    if (status === "Issued") {
      const issuerId = issuedBy ?? (await getEstateRepository().employees.resolveIdByAppId(context.userId))
      if (!issuerId || typeof issuerId !== "number") {
        return NextResponse.json(
          {
            error: "Issued By (disbursement actor) is required when status is Issued",
          },
          { status: 400 }
        )
      }
      updates.issuedBy = issuerId
      updates.issuedAt = toISODateString()
    }

    const pc = await getEstateRepository().pettyCash.update(
      id,
      updates as Partial<PettyCash>
    )

    if (!pc) {
      return NextResponse.json({ error: "Petty cash request not found" }, { status: 404 })
    }

    return withDataSource({ pettyCash: pc })
  } catch (error) {
    logger.error("Error updating petty cash request", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update petty cash request" }, { status: 500 })
  }
})
