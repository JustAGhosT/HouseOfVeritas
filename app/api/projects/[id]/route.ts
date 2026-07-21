import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { toStoredProjectType, withProjectKind, type Project } from "@/lib/projects"
import { deleteProject, findProjectById, replaceProject } from "@/lib/repositories/project-repository"
import { logger } from "@/lib/logger"
import { routeToInngest } from "@/lib/workflows"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const project = await findProjectById(id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json({ project: withProjectKind(project) })
  } catch (err) {
    logger.error("Failed to load project", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 })
  }
}

export const PATCH = withRole("admin")(async (request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400 })
  try {
    const body = await request.json()
    const project = await findProjectById(id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const prevStatus = project.status
    const updates: Partial<Project> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (!name) return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
      updates.name = name
    }

    if (body.type !== undefined) {
      const storedType = toStoredProjectType(body.type)
      if (!storedType) return NextResponse.json({ error: "type must be scope or job" }, { status: 400 })
      updates.type = storedType
      updates.scopeKind = storedType === "major" ? body.scopeKind || project.scopeKind || "site" : undefined
      updates.parentId = storedType === "subproject" ? body.parentId ?? project.parentId : undefined
    } else {
      if (body.scopeKind !== undefined) updates.scopeKind = body.scopeKind
      if (body.parentId !== undefined) updates.parentId = body.parentId
    }

    if (body.description !== undefined) {
      updates.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : undefined
    }
    if (body.status !== undefined) updates.status = body.status
    if (body.startDate !== undefined) updates.startDate = body.startDate
    if (body.endDate !== undefined) updates.endDate = body.endDate
    if (body.budget !== undefined) updates.budget = body.budget
    if (body.members !== undefined) updates.members = Array.isArray(body.members) ? body.members : project.members

    const updatedProject = {
      ...project,
      ...updates,
      id: project.id,
      updatedAt: new Date().toISOString(),
    }
    await replaceProject(updatedProject)

    if (body.status === "in_progress" && prevStatus !== "in_progress") {
      await routeToInngest({
        name: "house-of-veritas/project.started",
        data: {
          projectId: project.id,
          name: project.name,
          type: project.type,
        },
      })
    }

    return NextResponse.json({ project: withProjectKind(updatedProject) })
  } catch (err) {
    logger.error("Failed to update project", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
})

export const DELETE = withRole("admin")(async (_request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400 })
  try {
    const deleted = await deleteProject(id)
    if (!deleted) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error("Failed to delete project", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
})
