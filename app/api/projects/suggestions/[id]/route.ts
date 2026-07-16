import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { withProjectKind, type Project, type ProjectMember } from "@/lib/projects"
import type { ProjectSuggestion } from "../route"
import { logger } from "@/lib/logger"
import { routeToInngest } from "@/lib/workflows"

const SUGGESTIONS_PATH = join(process.cwd(), "data", "project-suggestions.json")
const PROJECTS_PATH = join(process.cwd(), "data", "projects.json")

async function loadSuggestions(): Promise<ProjectSuggestion[]> {
  try {
    const data = await readFile(SUGGESTIONS_PATH, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveSuggestions(suggestions: ProjectSuggestion[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true })
  await writeFile(SUGGESTIONS_PATH, JSON.stringify(suggestions, null, 2), "utf-8")
}

async function loadProjects(): Promise<Project[]> {
  try {
    const data = await readFile(PROJECTS_PATH, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveProjects(projects: Project[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true })
  await writeFile(PROJECTS_PATH, JSON.stringify(projects, null, 2), "utf-8")
}

export const PATCH = withRole("admin")(async (request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Suggestion ID required" }, { status: 400 })

  const auth = request.headers.get("x-user-id") || "hans"

  try {
    const body = await request.json()
    const { status } = body

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 })
    }

    const suggestions = await loadSuggestions()
    const idx = suggestions.findIndex((s) => s.id === id)
    if (idx === -1) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })

    const suggestion = suggestions[idx]
    if (suggestion.status !== "pending") {
      return NextResponse.json({ error: "Suggestion already reviewed" }, { status: 400 })
    }

    const now = new Date().toISOString()
    suggestions[idx] = {
      ...suggestion,
      status,
      reviewedBy: auth,
      reviewedAt: now,
    }
    await saveSuggestions(suggestions)

    if (status === "approved") {
      const projects = await loadProjects()
      const project: Project = {
        id: `proj-${Date.now()}`,
        name: suggestion.name,
        description: suggestion.description,
        type: suggestion.type,
        parentId: suggestion.parentId,
        status: "planned",
        members: [] as ProjectMember[],
        createdAt: now,
        updatedAt: now,
      }
      projects.push(project)
      await saveProjects(projects)

      await routeToInngest({
        name: "house-of-veritas/project.suggestion.approved",
        data: {
          projectId: project.id,
          name: project.name,
          type: project.type,
          suggestedBy: suggestion.suggestedBy,
          reviewedBy: auth,
        },
      })

      return NextResponse.json({ suggestion: suggestions[idx], project: withProjectKind(project) })
    }

    return NextResponse.json({ suggestion: suggestions[idx] })
  } catch (err) {
    logger.error("Failed to update suggestion", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 })
  }
})
