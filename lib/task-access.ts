import type { Task } from "@/lib/services/baserow"
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
