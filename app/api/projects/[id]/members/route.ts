import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import type { ProjectMember } from "@/lib/projects"
import { findProjectById, replaceProject } from "@/lib/repositories/project-repository"
import { logger } from "@/lib/logger"

export const POST = withRole("admin")(async (request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400 })
  try {
    const body = await request.json()
    const { userId, role, allocationPercent } = body

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 })
    }

    const project = await findProjectById(id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const members = project.members || []
    if (members.some((member) => member.userId === userId)) {
      return NextResponse.json({ error: "Member already assigned" }, { status: 400 })
    }

    const member: ProjectMember = {
      userId,
      role: role === "lead" ? "lead" : role === "supervisor" ? "supervisor" : "contributor",
      allocationPercent: allocationPercent ?? undefined,
    }
    const updatedProject = {
      ...project,
      members: [...members, member],
      updatedAt: new Date().toISOString(),
    }
    await replaceProject(updatedProject)
    return NextResponse.json({ member, project: updatedProject })
  } catch (err) {
    logger.error("Failed to add member", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
})

export const DELETE = withRole("admin")(async (request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400 })
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  try {
    const project = await findProjectById(id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const updatedProject = {
      ...project,
      members: (project.members || []).filter((member) => member.userId !== userId),
      updatedAt: new Date().toISOString(),
    }
    await replaceProject(updatedProject)
    return NextResponse.json({ success: true, project: updatedProject })
  } catch (err) {
    logger.error("Failed to remove member", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
})
