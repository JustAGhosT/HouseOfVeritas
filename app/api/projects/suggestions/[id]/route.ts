import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { withProjectKind, type Project, type ProjectMember } from "@/lib/projects"
import { createProject } from "@/lib/repositories/project-repository"
import {
  listProjectSuggestions,
  saveProjectSuggestions,
} from "@/lib/repositories/project-suggestion-repository"
import { logger } from "@/lib/logger"
import { routeToInngest } from "@/lib/workflows"

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

    const suggestions = await listProjectSuggestions()
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
    await saveProjectSuggestions(suggestions)

    if (status === "approved") {
      const project: Project = {
        id: `proj-${Date.now()}`,
        name: suggestion.name,
        description: suggestion.description,
        type: suggestion.type,
        scopeKind: suggestion.scopeKind,
        parentId: suggestion.parentId,
        status: "planned",
        members: [] as ProjectMember[],
        createdAt: now,
        updatedAt: now,
      }
      await createProject(project)

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
