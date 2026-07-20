import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"
import { toStoredProjectType } from "@/lib/projects"
import {
  listProjectSuggestions,
  saveProjectSuggestions,
  type ProjectSuggestion,
} from "@/lib/repositories/project-suggestion-repository"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (request: Request) => {
  try {
    const suggestions = await listProjectSuggestions()
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

    const suggestions = await listProjectSuggestions()
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
    await saveProjectSuggestions(suggestions)
    return NextResponse.json({ suggestion })
  } catch (err) {
    logger.error("Failed to create suggestion", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 })
  }
})
