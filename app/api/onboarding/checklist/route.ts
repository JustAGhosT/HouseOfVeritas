import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { toISODateString } from "@/lib/utils"
import { routeToInngest } from "@/lib/workflows"
import { NextResponse } from "next/server"

export const GET = withRole(
  "admin",
  "operator"
)(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const employee = searchParams.get("employee")
  const status = searchParams.get("status")

  try {
    if (!getEstateRepository().onboarding.isConfigured()) {
      return NextResponse.json({ checklists: [], total: 0 })
    }
    const employeeId = employee ? parseInt(employee, 10) : undefined
    const checklists = await getEstateRepository().onboarding.list({
      employee: Number.isNaN(employeeId as number) ? undefined : employeeId,
      status: status || undefined,
    })
    return NextResponse.json({ checklists, total: checklists.length })
  } catch (error) {
    logger.error("GET onboarding checklist error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch onboarding checklists" }, { status: 500 })
  }
})

export const POST = withRole("admin")(async (request) => {
  try {
    if (!getEstateRepository().onboarding.isConfigured()) {
      return NextResponse.json(
        { error: "Onboarding checklist requires Baserow configuration" },
        { status: 503 }
      )
    }
    const body = await request.json()
    const { employee, items, status } = body

    if (!employee) {
      return NextResponse.json({ error: "employee is required" }, { status: 400 })
    }

    const checklist = await getEstateRepository().onboarding.create({
      employee,
      items: items ?? "[]",
      status: status || "In Progress",
      createdAt: toISODateString(),
    })

    if (!checklist) {
      return NextResponse.json({ error: "Failed to create onboarding checklist" }, { status: 500 })
    }

    await routeToInngest({
      name: "house-of-veritas/onboarding.checklist.progressed",
      data: { checklistId: checklist.id, employeeId: checklist.employee },
    })

    return NextResponse.json({ checklist })
  } catch (error) {
    logger.error("POST onboarding checklist error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create onboarding checklist" }, { status: 500 })
  }
})

export const PATCH = withRole(
  "admin",
  "operator"
)(async (request) => {
  try {
    if (!getEstateRepository().onboarding.isConfigured()) {
      return NextResponse.json(
        { error: "Onboarding checklist requires Baserow configuration" },
        { status: 503 }
      )
    }
    const body = await request.json()
    const { id, items, status, completedAt } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const existing = (await getEstateRepository().onboarding.list({})).find((c) => c.id === id)
    if (!existing) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (items !== undefined) updates.items = items
    if (status !== undefined) updates.status = status
    if (completedAt !== undefined) updates.completedAt = completedAt

    const checklist = await getEstateRepository().onboarding.update(id, updates)

    if (!checklist) {
      return NextResponse.json({ error: "Failed to update onboarding checklist" }, { status: 500 })
    }

    const progressed = items !== undefined || status !== undefined
    if (progressed) {
      await routeToInngest({
        name: "house-of-veritas/onboarding.checklist.progressed",
        data: { checklistId: checklist.id, employeeId: checklist.employee },
      })
    }

    return NextResponse.json({ checklist })
  } catch (error) {
    logger.error("PATCH onboarding checklist error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update onboarding checklist" }, { status: 500 })
  }
})
