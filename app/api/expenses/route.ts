import { resolveEmployeeForGet, resolveEmployeeForPost } from "@/lib/api/employee-resolver"
import { withErrorHandling } from "@/lib/api/error-handler"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { emitApprovalRequired } from "@/lib/realtime/event-store"
import type { Expense } from "@/lib/domain/estate-types"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { toISODateString } from "@/lib/utils"
import { routeToInngest } from "@/lib/workflows"
import { NextResponse } from "next/server"

const HIGH_VALUE_THRESHOLD = 5000

// Default requester ID fallback when employee resolution fails
// In production, this must be configured via environment variable
function getDefaultRequesterId(): number {
  if (process.env.DEFAULT_EXPENSE_REQUESTER_ID) {
    const parsed = parseInt(process.env.DEFAULT_EXPENSE_REQUESTER_ID, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
    // In production, throw an error instead of silently falling back
    if (process.env.NODE_ENV === "production") {
      logger.error(
        `Invalid DEFAULT_EXPENSE_REQUESTER_ID: ${process.env.DEFAULT_EXPENSE_REQUESTER_ID}`
      )
      throw new Error(
        `Invalid DEFAULT_EXPENSE_REQUESTER_ID: "${process.env.DEFAULT_EXPENSE_REQUESTER_ID}". ` +
          `Must be a positive integer. Set a valid DEFAULT_EXPENSE_REQUESTER_ID environment variable.`
      )
    }
    // Log warning for invalid env value but continue with fallback in non-production
    logger.warn("Invalid DEFAULT_EXPENSE_REQUESTER_ID, using fallback", {
      value: process.env.DEFAULT_EXPENSE_REQUESTER_ID,
    })
  }
  // In production, require the environment variable to be set
  if (process.env.NODE_ENV === "production") {
    logger.error("DEFAULT_EXPENSE_REQUESTER_ID is not set")
    throw new Error(
      "DEFAULT_EXPENSE_REQUESTER_ID environment variable is required in production. " +
        "Set a valid positive integer value."
    )
  }
  return 1
}

// Lazy-evaluated default requester ID to avoid build-time errors
let _defaultRequesterId: number | undefined
function getDefaultRequesterIdLazy(): number {
  if (_defaultRequesterId === undefined) {
    _defaultRequesterId = getDefaultRequesterId()
  }
  return _defaultRequesterId
}

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(
  withErrorHandling(
    async (request, context) => {
      if (!context) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }
      const { searchParams } = new URL(request.url)
      const status = searchParams.get("status")

      const { employeeId: requester, error } = await resolveEmployeeForGet(context, searchParams, {
        paramName: "requester",
      })
      if (error) return error

      const expenses = await getEstateRepository().expenses.list({
        requester,
        status: status || undefined,
      })

      const summary = {
        total: expenses.length,
        pending: expenses.filter((e) => e.approvalStatus === "Pending").length,
        approved: expenses.filter((e) => e.approvalStatus === "Approved").length,
        rejected: expenses.filter((e) => e.approvalStatus === "Rejected").length,
        totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
        pendingAmount: expenses
          .filter((e) => e.approvalStatus === "Pending")
          .reduce((sum, e) => sum + e.amount, 0),
        approvedAmount: expenses
          .filter((e) => e.approvalStatus === "Approved")
          .reduce((sum, e) => sum + e.amount, 0),
      }

      return withDataSource({ expenses, summary })
    },
    { operation: "Error fetching expenses", fallbackMessage: "Failed to fetch expenses" }
  )
)

export const POST = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  try {
    const body = await request.json()
    const { type, category, amount, vendor, date, project, notes } = body

    const { employeeId: resolvedRequester, error } = await resolveEmployeeForPost(
      body,
      request,
      context,
      { paramName: "requester", required: false, fallbackToCaller: true }
    )
    if (error) return error
    const finalRequester = resolvedRequester ?? getDefaultRequesterIdLazy()

    if (!amount || !category) {
      return NextResponse.json({ error: "Amount and category are required" }, { status: 400 })
    }

    const expense = await getEstateRepository().expenses.create({
      requester: finalRequester,
      type: type || "Request",
      category,
      amount,
      vendor,
      date: date || toISODateString(),
      approvalStatus: "Pending",
      project,
      notes,
    })

    const useInngest = process.env.USE_INNGEST_APPROVALS === "true"
    // Use authenticated context userId instead of trusting headers
    const authenticatedUserId = context?.userId
    if (!useInngest) {
      // Require EXPENSE_APPROVER_ID to be explicitly set - do not allow self-approval fallback
      const approverId = process.env.EXPENSE_APPROVER_ID
      if (!approverId) {
        return NextResponse.json(
          {
            error: "EXPENSE_APPROVER_ID environment variable must be configured",
          },
          { status: 400 }
        )
      }
      // Prevent self-approval
      if (approverId === authenticatedUserId) {
        return NextResponse.json(
          {
            error: "Self-approval is not allowed. Approver must be different from submitter.",
          },
          { status: 400 }
        )
      }
      emitApprovalRequired(
        { ...expense, type: "expense", submittedBy: authenticatedUserId || "unknown" },
        approverId
      )
    }
    if (useInngest) {
      await routeToInngest({
        name: "house-of-veritas/expense.created",
        data: {
          ...expense,
          submittedBy: authenticatedUserId || "unknown",
        },
      })
    }

    return withDataSource({ expense })
  } catch (error) {
    logger.error("Error creating expense", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
})

export const PATCH = withRole("admin")(async (request, context) => {
  if (!context?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { id, status, secondaryApprover, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 })
    }

    // Normalize and validate id once
    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 })
    }

    const existing = await getEstateRepository().expenses.get(numericId)
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = { ...rest }
    if (status) updates.approvalStatus = status
    if (secondaryApprover !== undefined) updates.secondaryApprover = secondaryApprover

    const isHighValue = existing.amount >= HIGH_VALUE_THRESHOLD
    if (status === "Approved" && isHighValue && existing.approvalStatus === "Pending") {
      // Use authenticated context.userId as the source of truth — avoids x-user-id spoofing
      const notificationUserId = context.userId || process.env.EXPENSE_APPROVER_ID
      if (!notificationUserId) {
        return NextResponse.json(
          { error: "Unable to determine notification recipient: authentication required" },
          { status: 400 }
        )
      }

      const approverId = await getEstateRepository().employees.resolveIdByAppId(context.userId)
      if (!approverId) {
        return NextResponse.json(
          { error: "Could not resolve approver from authenticated user" },
          { status: 400 }
        )
      }

      Object.assign(updates, {
        approvalStatus: "Pending Secondary",
        approver: approverId,
        approvalDate: toISODateString(),
      })
      const expense = await getEstateRepository().expenses.update(numericId, updates as Partial<Expense>)
      if (!expense) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 })
      }

      // Format amount using locale-aware formatter
      const formattedAmount = new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: process.env.CURRENCY_CODE || "ZAR",
      }).format(existing.amount)

      await sendNotification({
        type: "approval_required",
        userId: notificationUserId,
        title: "Secondary Approval Required",
        message: `Expense ${formattedAmount} needs secondary approval`,
        channels: ["in_app"],
        data: { expenseId: numericId, amount: existing.amount },
        priority: "medium",
      })
      return withDataSource({ expense })
    }

    if (status === "Approved" && existing.approvalStatus === "Pending Secondary") {
      let secondaryApproverId: number | undefined
      if (secondaryApprover != null) {
        // Validate secondaryApprover: must be a positive integer
        const numericApprover = Number(secondaryApprover)
        if (
          !Number.isFinite(numericApprover) ||
          !Number.isInteger(numericApprover) ||
          numericApprover <= 0
        ) {
          return NextResponse.json(
            {
              error: "Invalid secondaryApprover: must be a positive integer",
            },
            { status: 400 }
          )
        }
        secondaryApproverId = numericApprover
      } else {
        const resolvedId = await getEstateRepository().employees.resolveIdByAppId(context.userId)
        if (!resolvedId) {
          return NextResponse.json(
            {
              error:
                "Failed to resolve secondary approver. Provide secondaryApprover or ensure user has a valid employee mapping.",
            },
            { status: 400 }
          )
        }
        secondaryApproverId = resolvedId
      }
      Object.assign(updates, {
        approvalStatus: "Approved",
        secondaryApprover: secondaryApproverId,
        secondaryApprovalDate: toISODateString(),
      })
    }

    const expense = await getEstateRepository().expenses.update(numericId, updates as Partial<Expense>)

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    return withDataSource({ expense })
  } catch (error) {
    logger.error("Error updating expense", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
})
