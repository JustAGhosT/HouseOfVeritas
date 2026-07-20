import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { toStoredProjectType, withProjectKind } from "@/lib/projects"
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
    const storedType = toStoredProjectType(body.type)
    const updates = { ...body }
    if (body.type !== undefined) {
      if (storedType) updates.type = storedType
      else delete updates.type
    }

    const updatedProject = {
      ...project,
      ...updates,
      id: project.id,
      members: body.members ?? project.members,
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
