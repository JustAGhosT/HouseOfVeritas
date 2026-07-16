import { NextResponse } from "next/server"
import { withAuth, withRole } from "@/lib/auth/rbac"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { toStoredProjectType, type Project, type ProjectStorageType, type ScopeKind } from "@/lib/projects"
import { logger } from "@/lib/logger"

const SUGGESTIONS_PATH = join(process.cwd(), "data", "project-suggestions.json")
const PROJECTS_PATH = join(process.cwd(), "data", "projects.json")

export interface ProjectSuggestion {
  id: string
  name: string
  description?: string
  type: ProjectStorageType
  scopeKind?: ScopeKind
  parentId?: string
  suggestedBy: string
  suggestedAt: string
  status: "pending" | "approved" | "rejected"
  reviewedBy?: string
  reviewedAt?: string
}

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

export const GET = withAuth(async (request: Request) => {
  try {
    const suggestions = await loadSuggestions()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const filtered = status ? suggestions.filter((s) => s.status === status) : suggestions
    return NextResponse.json({ suggestions: filtered })
  } catch (err) {
    logger.error("Failed to load suggestions", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 })
  }
})

export const POST = withAuth(async (request: Request) => {
  try {
    const auth = request.headers.get("x-user-id") || "unknown"
    const body = await request.json()
    const { name, description, type, scopeKind, parentId } = body

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const suggestions = await loadSuggestions()
    const id = `sug-${Date.now()}`
    const storedType = toStoredProjectType(type) ?? "subproject"
    const suggestion: ProjectSuggestion = {
      id,
      name: name.trim(),
      description: description?.trim(),
      type: storedType,
      scopeKind: storedType === "major" ? scopeKind || "site" : undefined,
      parentId: storedType === "subproject" ? parentId : undefined,
      suggestedBy: auth,
      suggestedAt: new Date().toISOString(),
      status: "pending",
    }
    suggestions.push(suggestion)
    await saveSuggestions(suggestions)
    return NextResponse.json({ suggestion })
  } catch (err) {
    logger.error("Failed to create suggestion", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 })
  }
})
