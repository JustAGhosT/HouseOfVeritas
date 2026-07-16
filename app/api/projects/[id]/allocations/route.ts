import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { logger } from "@/lib/logger"

const ALLOCATIONS_PATH = join(process.cwd(), "data", "job-allocations.json")

export type JobAllocationType = "material" | "labour"

export interface JobAllocation {
  id: string
  projectId: string
  type: JobAllocationType
  name: string
  areaId?: string
  quantity?: number
  unit?: string
  hours?: number
  rateCents?: number
  costCents?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

async function loadAllocations(): Promise<JobAllocation[]> {
  try {
    const data = await readFile(ALLOCATIONS_PATH, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveAllocations(allocations: JobAllocation[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true })
  await writeFile(ALLOCATIONS_PATH, JSON.stringify(allocations, null, 2), "utf-8")
}

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
  const type = searchParams.get("type")

  try {
    let allocations = (await loadAllocations()).filter((allocation) => allocation.projectId === id)
    if (type === "material" || type === "labour") {
      allocations = allocations.filter((allocation) => allocation.type === type)
    }
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

    const allocations = await loadAllocations()
    allocations.push(allocation)
    await saveAllocations(allocations)
    return NextResponse.json({ allocation })
  } catch (error) {
    logger.error("Failed to create job allocation", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create job allocation" }, { status: 500 })
  }
})