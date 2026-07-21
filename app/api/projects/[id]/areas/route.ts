import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import {
  createJobArea,
  listJobAreas,
  type JobArea,
  type JobAreaKind,
} from "@/lib/repositories/job-workspace-repository"
import { logger } from "@/lib/logger"

function normalizeKind(value: unknown): JobAreaKind {
  if (value === "room" || value === "area" || value === "component" || value === "zone") {
    return value
  }
  return "area"
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const areas = await listJobAreas(id)
    return NextResponse.json({ areas })
  } catch (error) {
    logger.error("Failed to load job areas", {
      error: error instanceof Error ? error.message : String(error),
      projectId: id,
    })
    return NextResponse.json({ error: "Failed to load job areas" }, { status: 500 })
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

    const now = new Date().toISOString()
    const area: JobArea = {
      id: `area-${randomUUID()}`,
      projectId,
      name,
      kind: normalizeKind(body.kind),
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    }
    await createJobArea(area)
    return NextResponse.json({ area })
  } catch (error) {
    logger.error("Failed to create job area", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create job area" }, { status: 500 })
  }
})
