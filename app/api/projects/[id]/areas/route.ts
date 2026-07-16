import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { logger } from "@/lib/logger"

const AREAS_PATH = join(process.cwd(), "data", "job-areas.json")

export type JobAreaKind = "room" | "area" | "component" | "zone"

export interface JobArea {
  id: string
  projectId: string
  name: string
  kind: JobAreaKind
  notes?: string
  createdAt: string
  updatedAt: string
}

async function loadAreas(): Promise<JobArea[]> {
  try {
    const data = await readFile(AREAS_PATH, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveAreas(areas: JobArea[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true })
  await writeFile(AREAS_PATH, JSON.stringify(areas, null, 2), "utf-8")
}

function normalizeKind(value: unknown): JobAreaKind {
  if (value === "room" || value === "area" || value === "component" || value === "zone") {
    return value
  }
  return "area"
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const areas = await loadAreas()
    return NextResponse.json({ areas: areas.filter((area) => area.projectId === id) })
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

    const areas = await loadAreas()
    const now = new Date().toISOString()
    const area: JobArea = {
      id: `area-${Date.now()}`,
      projectId,
      name,
      kind: normalizeKind(body.kind),
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    }
    areas.push(area)
    await saveAreas(areas)
    return NextResponse.json({ area })
  } catch (error) {
    logger.error("Failed to create job area", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create job area" }, { status: 500 })
  }
})