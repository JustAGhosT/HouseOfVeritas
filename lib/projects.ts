/**
 * Work planning model.
 *
 * The JSON store still uses the legacy values `major` and `subproject`.
 * User-facing code should use `scope` and `job` through the helpers below:
 * - scope: a Site, Asset or Location such as 32 Singlehurst, a vehicle, or a workshop
 * - job: a Work Project under a scope, such as Repair bathroom or Service Hilux
 */

export type ProjectStatus = "planned" | "in_progress" | "on_hold" | "completed"

export type ProjectMemberRole = "lead" | "contributor" | "supervisor"

export type ProjectKind = "scope" | "job"

export type ScopeKind = "site" | "asset" | "location"

export type ProjectStorageType = "major" | "subproject"

export type ProjectTypeInput = ProjectKind | ProjectStorageType

export interface ProjectMember {
  userId: string
  role: ProjectMemberRole
  allocationPercent?: number
}

export interface Project {
  id: string
  name: string
  description?: string
  type: ProjectStorageType
  scopeKind?: ScopeKind
  parentId?: string
  status: ProjectStatus
  startDate?: string
  endDate?: string
  budget?: number
  members: ProjectMember[]
  createdAt: string
  updatedAt: string
}

export interface ProjectWithKind extends Project {
  kind: ProjectKind
}

export function getProjectKind(project: Pick<Project, "type">): ProjectKind {
  return project.type === "major" ? "scope" : "job"
}

export function isScope(project: Pick<Project, "type">): boolean {
  return getProjectKind(project) === "scope"
}

export function isJob(project: Pick<Project, "type">): boolean {
  return getProjectKind(project) === "job"
}

export function toStoredProjectType(type: string | null | undefined): ProjectStorageType | null {
  if (type === "scope" || type === "major") return "major"
  if (type === "job" || type === "subproject") return "subproject"
  return null
}

export function withProjectKind(project: Project): ProjectWithKind {
  return {
    ...project,
    kind: getProjectKind(project),
  }
}

export async function getProjectNamesForMember(userId: string): Promise<string[]> {
  const { getProjectNamesForMemberFromStore } = await import("@/lib/repositories/project-repository")
  return getProjectNamesForMemberFromStore(userId)
}
