import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { getTasks, createTask, type Task } from "@/lib/services/baserow"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { logger } from "@/lib/logger"

const META_PATH = join(process.cwd(), "data", "job-task-groups.json")

export interface JobTaskMetadata {
  taskId: number
  projectId: string
  areaId?: string
  groupName?: string
  createdAt: string
  updatedAt: string
}

export interface GroupedJobTask extends Task {
  areaId?: string
  groupName?: string
}

async function loadMetadata(): Promise<JobTaskMetadata[]> {
  try {
    const data = await readFile(META_PATH, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveMetadata(metadata: JobTaskMetadata[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true })
  await writeFile(META_PATH, JSON.stringify(metadata, null, 2), "utf-8")
}

function attachMetadata(tasks: Task[], metadata: JobTaskMetadata[], projectId: string): GroupedJobTask[] {
  return tasks.map((task) => {
    const match = metadata.find((item) => item.projectId === projectId && item.taskId === task.id)
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
    const [tasks, metadata] = await Promise.all([getTasks({ status: undefined }), loadMetadata()])
    const projectTasks = tasks.filter((task) => task.project === projectName)
    return NextResponse.json({ tasks: attachMetadata(projectTasks, metadata, id) })
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

    const task = await createTask({
      title,
      description: typeof body.description === "string" ? body.description : undefined,
      priority: body.priority || "Medium",
      status: "Not Started",
      project: projectName,
      assignedTo: typeof body.assignedTo === "number" ? body.assignedTo : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
    })

    if (!task) return NextResponse.json({ error: "Failed to create task" }, { status: 500 })

    const metadata = await loadMetadata()
    const now = new Date().toISOString()
    const taskMeta: JobTaskMetadata = {
      taskId: task.id,
      projectId,
      areaId: typeof body.areaId === "string" && body.areaId ? body.areaId : undefined,
      groupName: typeof body.groupName === "string" && body.groupName.trim() ? body.groupName.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    }
    metadata.push(taskMeta)
    await saveMetadata(metadata)

    return NextResponse.json({ task: { ...task, areaId: taskMeta.areaId, groupName: taskMeta.groupName } })
  } catch (error) {
    logger.error("Failed to create grouped job task", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create grouped job task" }, { status: 500 })
  }
})