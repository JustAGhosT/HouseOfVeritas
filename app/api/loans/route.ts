import { resolveEmployeeForGet, resolveEmployeeForPost } from "@/lib/api/employee-resolver"
import { withDataSource } from "@/lib/api/response"
import { isAdminOrOperator, withRole } from "@/lib/auth/rbac"
import { submitPayment } from "@/lib/integrations/bank"
import { logger } from "@/lib/logger"
import type { Loan } from "@/lib/domain/estate-types"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { toISODateString } from "@/lib/utils"
import { routeToInngest } from "@/lib/workflows"
import { NextResponse } from "next/server"

const MAX_LOAN_AMOUNT = 50000
const MAX_OUTSTANDING = 20000

const MUTABLE_LOAN_FIELDS = ["purpose", "repaymentSchedule", "notes"] as const

const LOAN_STATUSES = ["Pending", "Approved", "Rejected", "Active", "Repaid"] as const

function pickMutableUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  for (const key of MUTABLE_LOAN_FIELDS) {
    const value = body[key]
    if (value === undefined) continue
    if (key === "purpose" || key === "repaymentSchedule") {
      if (typeof value !== "string") continue
      updates[key] = value
    } else if (key === "notes") {
      if (value !== null && typeof value !== "string") continue
      updates[key] = value ?? ""
    }
  }
  return updates
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
    const loans = await getEstateRepository().loans.list({
      employee,
      status: status || undefined,
    })
    return withDataSource({ loans })
  } catch (error) {
    logger.error("Error fetching loans", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 })
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
    const { amount, purpose, repaymentSchedule } = body

    const { employeeId: resolvedEmployeeId, error } = await resolveEmployeeForPost(
      body,
      request,
      context,
      { paramName: "employee", required: true }
    )
    if (error) return error
    let employeeId = resolvedEmployeeId!

    if (!isAdminOrOperator(context.role)) {
      const callerEmployeeId = (await getEstateRepository().employees.resolveIdByAppId(context.userId)) ?? undefined
      if (!callerEmployeeId || employeeId !== callerEmployeeId) {
        return NextResponse.json(
          { error: "You can only create loans for yourself" },
          { status: 403 }
        )
      }
      employeeId = callerEmployeeId
    }

    // Validate amount is numeric and positive before converting
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Valid numeric amount is required" }, { status: 400 })
    }

    const existingLoans = await getEstateRepository().loans.list({ employee: employeeId, status: "Active" })
    const totalOutstanding = existingLoans.reduce((s, l) => s + l.outstandingBalance, 0)
    if (totalOutstanding >= MAX_OUTSTANDING) {
      return NextResponse.json(
        {
          error: "Outstanding loan limit reached",
          outstanding: totalOutstanding,
          limit: MAX_OUTSTANDING,
        },
        { status: 400 }
      )
    }

    const overdue = existingLoans.filter((l) => {
      if (!l.nextRepaymentDate) return false
      return new Date(l.nextRepaymentDate) < new Date()
    })
    if (overdue.length > 0) {
      return NextResponse.json(
        { error: "Cannot request new loan while repayments are overdue" },
        { status: 400 }
      )
    }

    if (amountNum > MAX_LOAN_AMOUNT) {
      return NextResponse.json(
        { error: "Amount exceeds maximum", max: MAX_LOAN_AMOUNT },
        { status: 400 }
      )
    }

    const loan = await getEstateRepository().loans.create({
      employee: employeeId,
      amount: amountNum,
      purpose: purpose || "",
      repaymentSchedule: repaymentSchedule || "",
      status: "Pending",
      outstandingBalance: amountNum,
      createdAt: toISODateString(),
      notes: body.notes,
    })

    if (!loan) {
      return NextResponse.json({ error: "Failed to create loan" }, { status: 500 })
    }

    await routeToInngest({
      name: "house-of-veritas/loan.request.submitted",
      data: {
        id: loan.id,
        employeeId,
        amount: amountNum,
        purpose: loan.purpose,
      },
    })

    return withDataSource({ loan })
  } catch (error) {
    logger.error("Error creating loan", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 })
  }
})

export const PATCH = withRole("admin")(async (request) => {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const { id, status, approver, outstandingBalance, nextRepaymentDate } = body

    if (!id) {
      return NextResponse.json({ error: "Loan ID is required" }, { status: 400 })
    }

    const existingLoan = await getEstateRepository().loans.get(Number(id))
    if (!existingLoan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = pickMutableUpdates(body)

    if (status !== undefined) {
      if (typeof status !== "string" || !(LOAN_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json(
          { error: "Invalid status", allowed: [...LOAN_STATUSES] },
          { status: 400 }
        )
      }
      updates.status = status
    }
    if (approver !== undefined) {
      const approverNum = typeof approver === "number" ? approver : parseInt(String(approver), 10)
      if (Number.isNaN(approverNum) || approverNum < 0) {
        return NextResponse.json({ error: "Invalid approver" }, { status: 400 })
      }
      updates.approvedBy = approverNum
    }
    if (outstandingBalance !== undefined) {
      const bal =
        typeof outstandingBalance === "number"
          ? outstandingBalance
          : parseFloat(String(outstandingBalance))
      if (Number.isNaN(bal) || bal < 0) {
        return NextResponse.json({ error: "Invalid outstandingBalance" }, { status: 400 })
      }
      updates.outstandingBalance = bal
    }
    if (nextRepaymentDate !== undefined) {
      if (typeof nextRepaymentDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(nextRepaymentDate)) {
        return NextResponse.json(
          { error: "Invalid nextRepaymentDate (expected ISO date)" },
          { status: 400 }
        )
      }
      updates.nextRepaymentDate = nextRepaymentDate
    }

    if (status === "Approved") {
      updates.approvedAt = toISODateString()
      updates.disbursedAt = toISODateString()
      if (!updates.nextRepaymentDate) {
        const d = new Date()
        d.setDate(d.getDate() + 30)
        updates.nextRepaymentDate = toISODateString(d)
      }
    }

    const loanId = Number(id)

    if (status === "Approved" && existingLoan.status !== "Approved") {
      try {
        const emp = await getEstateRepository().employees.get(existingLoan.employee)
        const result = await submitPayment({
          recipientId: String(existingLoan.employee),
          recipientName: emp?.fullName ?? "Employee",
          amount: existingLoan.amount,
          currency: "ZAR",
          reference: `LOAN-${loanId}`,
          type: "loan",
        })
        if (!result.success) {
          logger.warn("Bank payment failed for loan", { loanId, result })
          return NextResponse.json(
            { error: "Bank payment failed", details: result.message ?? "Unknown error" },
            { status: 502 }
          )
        }
      } catch (err) {
        logger.error("Failed during loan disbursement", {
          loanId,
          error: err instanceof Error ? err.message : String(err),
        })
        return NextResponse.json({ error: "Failed to process disbursement" }, { status: 500 })
      }
    }

    const loan = await getEstateRepository().loans.update(loanId, updates as Partial<Loan>)

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (updates.outstandingBalance === 0) {
      await getEstateRepository().loans.update(loanId, { status: "Repaid" })
    }

    return withDataSource({ loan })
  } catch (error) {
    logger.error("Error updating loan", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update loan" }, { status: 500 })
  }
})
