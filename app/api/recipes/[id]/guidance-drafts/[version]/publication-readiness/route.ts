import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  createRecipeRevisionId,
  getRecipeGuidancePublicationReadiness,
} from "@/lib/recipe-guidance"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

function parseVersion(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const version = Number(value)
  return Number.isSafeInteger(version) ? version : null
}

export const GET = withRole("admin")(async (_request, context) => {
  try {
    const params = await context.params
    const recipeId = params?.id
    const version = parseVersion(params?.version)
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }
    if (version === null) {
      return NextResponse.json(
        { error: "A positive guidance version is required" },
        { status: 400 }
      )
    }

    const recipe = await getRecipeById(recipeId)
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

    const { repository, mode } = await getRecipeGuidanceRepository()
    const document = (await repository.listByRecipeId(recipeId)).find(
      (candidate) => candidate.version === version
    )
    if (!document) {
      return NextResponse.json({ error: "Recipe guidance draft not found" }, { status: 404 })
    }

    const readiness = getRecipeGuidancePublicationReadiness(document)
    const recipeRevisionCurrent =
      document.recipeRevisionId === createRecipeRevisionId(recipe.id, recipe.updatedAt)
    const issues = recipeRevisionCurrent
      ? readiness.issues
      : [
          {
            code: "recipeRevisionId",
            message: "Recipe changed; create a new guidance draft",
          },
          ...readiness.issues,
        ]

    return NextResponse.json({
      data: {
        documentId: document.id,
        version: document.version,
        status: document.status,
        ready: recipeRevisionCurrent && readiness.ready,
        issues,
      },
      summary: { mode, issueCount: issues.length },
    })
  } catch (error) {
    logger.error("Failed to inspect recipe guidance publication readiness", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
