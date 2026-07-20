import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import {
  createJobAllocation,
  listJobAllocations,
  type JobAllocation,
  type JobAllocationType,
} from "@/lib/repositories/job-workspace-repository"
import { logger } from "@/lib/logger"

function normalizeType(value: unknown): JobAllocationType {
  return value === "labour" ? "labour" : "material"
}

function numberFromBody(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { searchParams } = new URL(request.url)
  const requestedType = searchParams.get("type")
  const type = requestedType === "material" || requestedType === "labour" ? requestedType : undefined

  try {
    const allocations = await listJobAllocations(id, type)
    return NextResponse.json({ allocations })
  } catch (error) {
    logger.error("Failed to load job allocations", {
      error: error instanceof Error ? error.message : String(error),
      projectId: id,
    })
    return NextResponse.json({ error: "Failed to load job allocations" }, { status: 500 })
  }
}

export const POST = withRole("admin", "operator", "employee")(async (request, context) => {
  const params = await context.params
  const projectId = params?.id
  if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 })

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const type = normalizeType(body.type)
    const quantity = numberFromBody(body.quantity)
    const hours = numberFromBody(body.hours)
    const rateCents = numberFromBody(body.rateCents)
    const costCents = numberFromBody(body.costCents)
    const now = new Date().toISOString()
    const allocation: JobAllocation = {
      id: `alloc-${Date.now()}`,
      projectId,
      type,
      name,
      areaId: typeof body.areaId === "string" && body.areaId ? body.areaId : undefined,
      quantity: type === "material" ? quantity : undefined,
      unit: type === "material" && typeof body.unit === "string" ? body.unit.trim() || undefined : undefined,
      hours: type === "labour" ? hours : undefined,
      rateCents: type === "labour" ? rateCents : undefined,
      costCents,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    }

    await createJobAllocation(allocation)
    return NextResponse.json({ allocation })
  } catch (error) {
    logger.error("Failed to create job allocation", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create job allocation" }, { status: 500 })
  }
})
