import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { RecipeGuidanceBuildError, buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import { logger } from "@/lib/logger"
import {
  RecipeGuidanceConflictError,
  getRecipeGuidanceRepository,
} from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

export const GET = withRole("admin")(async (_request, context) => {
  try {
    const recipeId = (await context.params)?.id
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }
    if (!(await getRecipeById(recipeId))) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    }

    const { repository, mode } = await getRecipeGuidanceRepository()
    const documents = await repository.listByRecipeId(recipeId)
    return NextResponse.json({
      data: { documents },
      summary: { count: documents.length, mode },
    })
  } catch (error) {
    logger.error("Failed to list recipe guidance drafts", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})

export const POST = withRole("admin")(async (_request, context) => {
  try {
    const recipeId = (await context.params)?.id
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe ID is required" }, { status: 400 })
    }

    const recipe = await getRecipeById(recipeId)
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

    const { repository, mode } = await getRecipeGuidanceRepository()
    const existingDocuments = await repository.listByRecipeId(recipeId)
    const nextVersion = Math.max(0, ...existingDocuments.map((document) => document.version)) + 1
    const document = buildRecipeGuidanceDraft(recipe, {
      version: nextVersion,
      createdBy: context.userId,
      now: new Date().toISOString(),
    })
    const persistedDocument = await repository.create(document)

    return NextResponse.json(
      {
        data: { recipe, document: persistedDocument },
        summary: { mode, persisted: true, version: persistedDocument.version },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof RecipeGuidanceBuildError) {
      return NextResponse.json({ error: "Recipe is incomplete for guidance" }, { status: 422 })
    }
    if (error instanceof RecipeGuidanceConflictError) {
      return NextResponse.json(
        { error: "Recipe guidance version already exists; refresh and retry" },
        { status: 409 }
      )
    }
    logger.error("Failed to create recipe guidance draft", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
