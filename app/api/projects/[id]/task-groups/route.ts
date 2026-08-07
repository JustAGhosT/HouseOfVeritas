import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import type { Task } from "@/lib/domain/estate-types"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import {
  createJobTaskMetadata,
  listJobTaskMetadata,
  type GroupedJobTask,
  type JobTaskMetadata,
} from "@/lib/repositories/job-workspace-repository"
import { logger } from "@/lib/logger"

function attachMetadata(tasks: Task[], metadata: JobTaskMetadata[]): GroupedJobTask[] {
  return tasks.map((task) => {
    const match = metadata.find((item) => item.taskId === task.id)
    return {
      ...task,
      areaId: match?.areaId,
      groupName: match?.groupName,
    }
  })
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { searchParams } = new URL(request.url)
  const projectName = searchParams.get("projectName")

  if (!projectName) return NextResponse.json({ error: "projectName is required" }, { status: 400 })

  try {
    const [tasks, metadata] = await Promise.all([getEstateRepository().tasks.list({ status: undefined }), listJobTaskMetadata(id)])
    const projectTasks = tasks.filter(
      (task) => task.project === projectName || metadata.some((item) => item.taskId === task.id)
    )
    return NextResponse.json({ tasks: attachMetadata(projectTasks, metadata) })
  } catch (error) {
    logger.error("Failed to load grouped job tasks", {
      error: error instanceof Error ? error.message : String(error),
      projectId: id,
    })
    return NextResponse.json({ error: "Failed to load grouped job tasks" }, { status: 500 })
  }
}

export const POST = withRole("admin", "operator", "employee")(async (request, context) => {
  const params = await context.params
  const projectId = params?.id
  if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 })

  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const projectName = typeof body.projectName === "string" ? body.projectName.trim() : ""
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })
    if (!projectName) return NextResponse.json({ error: "projectName is required" }, { status: 400 })

    const task = await getEstateRepository().tasks.create({
      title,
      description: typeof body.description === "string" ? body.description : undefined,
      priority: body.priority || "Medium",
      status: "Not Started",
      project: projectName,
      assignedTo: typeof body.assignedTo === "number" ? body.assignedTo : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
    })

    if (!task) return NextResponse.json({ error: "Failed to create task" }, { status: 500 })

    const now = new Date().toISOString()
    const taskMeta: JobTaskMetadata = {
      taskId: task.id,
      projectId,
      areaId: typeof body.areaId === "string" && body.areaId ? body.areaId : undefined,
      groupName: typeof body.groupName === "string" && body.groupName.trim() ? body.groupName.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    }
    await createJobTaskMetadata(taskMeta)

    return NextResponse.json({ task: { ...task, areaId: taskMeta.areaId, groupName: taskMeta.groupName } })
  } catch (error) {
    logger.error("Failed to create grouped job task", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create grouped job task" }, { status: 500 })
  }
})
