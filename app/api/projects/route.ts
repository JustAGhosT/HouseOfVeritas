import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { toStoredProjectType, withProjectKind, type Project } from "@/lib/projects"
import { logger } from "@/lib/logger"
import { createProject, listProjects } from "@/lib/repositories/project-repository"


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parentId = searchParams.get("parentId")
  const type = toStoredProjectType(searchParams.get("type"))
  const member = searchParams.get("member")

  try {
    let projects = await listProjects()
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
    const { name, description, type, scopeKind, parentId, status, startDate, endDate, budget, members } = body

    if (!name || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 })
    }

    const id = `proj-${Date.now()}`
    const now = new Date().toISOString()
    const storedType = toStoredProjectType(type) ?? "subproject"

    const project: Project = {
      id,
      name,
      description: description || undefined,
      type: storedType,
      scopeKind: storedType === "major" ? scopeKind || "site" : undefined,
      parentId: storedType === "subproject" ? parentId : undefined,
      status: status || "planned",
      startDate,
      endDate,
      budget,
      members: Array.isArray(members) ? members : [],
      createdAt: now,
      updatedAt: now,
    }

    await createProject(project)

    return NextResponse.json({ project: withProjectKind(project) })
  } catch (err) {
    logger.error("Failed to create project", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
})
