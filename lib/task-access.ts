import { getTask, type Task } from "@/lib/services/baserow"
import { getProjectNamesForMember } from "@/lib/projects"

export const PERSONA_TO_ASSIGNED_ID: Record<string, number> = {
  hans: 1,
  charl: 2,
  lucky: 3,
  irma: 4,
}

export interface TaskAccessScope {
  isAdmin: boolean
  assignedId?: number
  projectNames: string[]
}

export async function getTaskAccessScope(
  userId: string,
  role: string
): Promise<TaskAccessScope> {
  if (role === "admin") {
    return { isAdmin: true, projectNames: [] }
  }

  return {
    isAdmin: false,
    assignedId: PERSONA_TO_ASSIGNED_ID[userId.toLowerCase()],
    projectNames: await getProjectNamesForMember(userId),
  }
}

export function canAccessTask(task: Task, scope: TaskAccessScope): boolean {
  return (
    scope.isAdmin ||
    (scope.assignedId !== undefined && task.assignedTo === scope.assignedId) ||
    Boolean(task.project && scope.projectNames.includes(task.project))
  )
}

export type TaskAccessResult =
  | { task: Task; status?: never }
  | { task: null; status: 403 | 404 }

export async function resolveTaskAccess(
  taskId: string,
  userId: string,
  role: string
): Promise<TaskAccessResult> {
  const numericTaskId = Number(taskId)
  if (!Number.isSafeInteger(numericTaskId) || numericTaskId <= 0) {
    return { task: null, status: 404 }
  }

  const task = await getTask(numericTaskId)
  if (!task) return { task: null, status: 404 }

  const scope = await getTaskAccessScope(userId, role)
  return canAccessTask(task, scope) ? { task } : { task: null, status: 403 }
}
