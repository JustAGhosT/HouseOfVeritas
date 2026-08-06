import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import type { Budget } from "@/lib/domain/estate-types"
import { NextResponse } from "next/server"

export const GET = withRole(
  "admin",
  "operator"
)(async (request) => {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period")
  const status = searchParams.get("status")

  try {
    const budgets = await getEstateRepository().budgets.list({
      period: period || undefined,
      status: status || undefined,
    })
    return withDataSource({ budgets })
  } catch (error) {
    logger.error("Error fetching budgets", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 })
  }
})

export const POST = withRole("admin")(async (request) => {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 })
      }
      throw err
    }

    const { category, amount: rawAmount, period, notes } = body

    // Validate category is present
    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Category is required and must be a string" },
        { status: 400 }
      )
    }

    // Validate amount is numeric, finite, and positive
    const amount = Number(rawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive finite number" },
        { status: 400 }
      )
    }

    const year = new Date().getFullYear()
    const budget = await getEstateRepository().budgets.create({
      category,
      amount,
      period: typeof period === "string" ? period : String(year),
      version: 1,
      status: "Draft",
      notes: typeof notes === "string" ? notes : undefined,
    })

    if (!budget) {
      return NextResponse.json({ error: "Failed to create budget" }, { status: 500 })
    }

    return withDataSource({ budget })
  } catch (error) {
    logger.error("Error creating budget", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create budget" }, { status: 500 })
  }
})

// Allowed fields for budget updates
const ALLOWED_BUDGET_UPDATE_FIELDS = [
  "name",
  "amount",
  "category",
  "notes",
  "period",
  "status",
] as const

type AllowedBudgetUpdateField = (typeof ALLOWED_BUDGET_UPDATE_FIELDS)[number]

export const PATCH = withRole("admin")(async (request) => {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 })
      }
      throw err
    }

    const { id, ...rawUpdates } = body

    if (!id) {
      return NextResponse.json({ error: "Budget ID is required" }, { status: 400 })
    }

    // Explicitly pick and validate allowed update fields
    const allowedUpdates: Partial<Record<AllowedBudgetUpdateField, unknown>> = {}

    for (const field of ALLOWED_BUDGET_UPDATE_FIELDS) {
      if (field in rawUpdates) {
        allowedUpdates[field] = rawUpdates[field]
      }
    }

    // Validate amount if present
    if ("amount" in allowedUpdates) {
      const amount = Number(allowedUpdates.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive finite number" },
          { status: 400 }
        )
      }
      allowedUpdates.amount = amount
    }

    // Check if any valid fields remain
    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid fields to update. Allowed fields: " + ALLOWED_BUDGET_UPDATE_FIELDS.join(", "),
        },
        { status: 400 }
      )
    }

    const budget = await getEstateRepository().budgets.update(
      Number(id),
      allowedUpdates as Partial<Budget>
    )

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 })
    }

    return withDataSource({ budget })
  } catch (error) {
    logger.error("Error updating budget", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 })
  }
})
