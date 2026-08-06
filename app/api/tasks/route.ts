import { NextResponse } from "next/server"
import type { Task } from "@/lib/domain/estate-types"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getTaskDataSource } from "@/lib/services/baserow"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { canAccessTask, getTaskAccessScope, PERSONA_TO_ASSIGNED_ID } from "@/lib/task-access"
import { routeToInngest } from "@/lib/workflows"

function withTaskDataSource<T extends Record<string, unknown>>(data: T) {
  const dataSource = getTaskDataSource()
  return withDataSource(
    { ...data, dataSource },
    {
      configured: dataSource !== "empty",
      message:
        dataSource === "baserow"
          ? "Connected to Baserow"
          : dataSource === "mongodb"
            ? "Connected to Cosmos MongoDB"
            : "Task datastore not configured",
    }
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const assignedToParam = searchParams.get("assignedTo")
  const assignee = searchParams.get("assignee")
  const status = searchParams.get("status")
  const userId = request.headers.get("x-user-id")
  const userRole = request.headers.get("x-user-role")

  let assignedTo: number | undefined
  if (assignedToParam) {
    assignedTo = parseInt(assignedToParam, 10)
    if (Number.isNaN(assignedTo)) assignedTo = undefined
  } else if (assignee) {
    assignedTo = PERSONA_TO_ASSIGNED_ID[assignee.toLowerCase()]
  }

  const isAdmin = userRole === "admin"
  const applyProjectFilter = userId && !isAdmin

  try {
    let tasks: Task[]
    if (applyProjectFilter) {
      tasks = await getEstateRepository().tasks.list({ status: status || undefined })
      const accessScope = await getTaskAccessScope(userId, userRole ?? "")
      tasks = tasks.filter((task) => canAccessTask(task, accessScope))
    } else {
      tasks = await getEstateRepository().tasks.list({
        assignedTo,
        assignedToName: assignee ?? undefined,
        status: status || undefined,
      })
    }

    const summary = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "Completed").length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      notStarted: tasks.filter((t) => t.status === "Not Started").length,
      overdue: tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed"
      ).length,
    }

    return withTaskDataSource({ tasks, summary })
  } catch (error) {
    logger.error("Error fetching tasks", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}

export const POST = withRole(
  "admin",
  "operator",
  "employee"
)(async (request) => {
  try {
    const body = await request.json()
    const { title, description, assignedTo, dueDate, priority, project } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const task = await getEstateRepository().tasks.create({
      title,
      description,
      assignedTo,
      dueDate,
      priority: priority || "Medium",
      status: "Not Started",
      project,
    })

    if (task) {
      const assignee = assignedTo ? await getEstateRepository().employees.get(assignedTo) : null
      await routeToInngest({
        name: "house-of-veritas/task.created",
        data: {
          id: task.id,
          title: task.title,
          assigneeId: task.assignedTo,
          assigneeEmail: assignee?.email,
        },
      })
    }

    return withTaskDataSource({ task })
  } catch (error) {
    logger.error("Error creating task", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
})

export const PATCH = withRole(
  "admin",
  "operator",
  "employee"
)(async (request, context) => {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const existing = (await getEstateRepository().tasks.list({ status: undefined })).find((t) => t.id === id)
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const userRole = context.role
    const userId = context.userId
    const isAdmin = userRole === "admin"

    let effectiveUpdates = updates
    if (!isAdmin) {
      const accessScope = await getTaskAccessScope(userId ?? "", userRole)
      if (!canAccessTask(existing, accessScope)) {
        return NextResponse.json(
          { error: "You can only update tasks assigned to you or in your projects" },
          { status: 403 }
        )
      }

      const allowedNonAdminFields = ["status", "completionNotes", "timeSpent"]
      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedNonAdminFields.includes(key))
      )

      if (Object.keys(safeUpdates).length === 0) {
        return NextResponse.json({ error: "No permitted fields to update" }, { status: 400 })
      }

      effectiveUpdates = safeUpdates
    }

    const task = await getEstateRepository().tasks.update(id, effectiveUpdates)

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return withTaskDataSource({ task })
  } catch (error) {
    logger.error("Error updating task", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
})
