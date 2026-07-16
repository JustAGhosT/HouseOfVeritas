import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { toStoredProjectType, withProjectKind, type Project } from "@/lib/projects"
import { logger } from "@/lib/logger"

const PROJECTS_PATH = join(process.cwd(), "data", "projects.json")

async function loadProjects(): Promise<Project[]> {
  try {
    const data = await readFile(PROJECTS_PATH, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveProjects(projects: Project[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true })
  await writeFile(PROJECTS_PATH, JSON.stringify(projects, null, 2), "utf-8")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parentId = searchParams.get("parentId")
  const type = toStoredProjectType(searchParams.get("type"))
  const member = searchParams.get("member")

  try {
    let projects = await loadProjects()
    if (parentId) projects = projects.filter((p) => p.parentId === parentId)
    if (type) projects = projects.filter((p) => p.type === type)
    if (member) projects = projects.filter((p) => p.members?.some((m) => m.userId === member))

    const major = projects.filter((p) => p.type === "major")
    const subprojects = projects.filter((p) => p.type === "subproject")
    const scopes = major.map(withProjectKind)
    const jobs = subprojects.map(withProjectKind)

    return NextResponse.json({
      projects: projects.map(withProjectKind),
      scopes,
      jobs,
      major: scopes,
      subprojects: jobs,
    })
  } catch (err) {
    logger.error("Failed to load projects", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
  }
}

export const POST = withRole("admin")(async (request: Request) => {
  try {
    const body = await request.json()
    const { name, description, type, parentId, status, startDate, endDate, budget, members } = body

    if (!name || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 })
    }

    const projects = await loadProjects()
    const id = `proj-${Date.now()}`
    const now = new Date().toISOString()
    const storedType = toStoredProjectType(type) ?? "subproject"

    const project: Project = {
      id,
      name,
      description: description || undefined,
      type: storedType,
      parentId: storedType === "subproject" ? parentId : undefined,
      status: status || "planned",
      startDate,
      endDate,
      budget,
      members: Array.isArray(members) ? members : [],
      createdAt: now,
      updatedAt: now,
    }

    projects.push(project)
    await saveProjects(projects)

    return NextResponse.json({ project: withProjectKind(project) })
  } catch (err) {
    logger.error("Failed to create project", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
})
