import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  createRecipeRevisionId,
  parseRecipeGuidanceDocument,
  recipeGuidanceSectionSchema,
} from "@/lib/recipe-guidance"
import {
  RecipeGuidanceConflictError,
  getRecipeGuidanceRepository,
} from "@/lib/repositories/recipe-guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"

const sectionUpdateSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    section: recipeGuidanceSectionSchema
      .pick({ kind: true, applicability: true, blocks: true })
      .strict(),
  })
  .strict()

function parseVersion(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const version = Number(value)
  return Number.isSafeInteger(version) ? version : null
}

function advanceTimestamp(current: string): string {
  return new Date(Math.max(Date.now(), new Date(current).getTime() + 1)).toISOString()
}

export const PATCH = withRole("admin")(async (request, context) => {
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

    let input: unknown
    try {
      input = await request.json()
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 })
      }
      throw error
    }
    const parsed = sectionUpdateSchema.safeParse(input)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid recipe guidance section update" }, { status: 400 })
    }
    if (
      parsed.data.section.blocks.some(
        (block) => block.type === "text" && block.source !== "reviewed"
      )
    ) {
      return NextResponse.json(
        { error: "Updated text must be marked as human reviewed" },
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
    if (document.status !== "draft" && document.status !== "in_review") {
      return NextResponse.json(
        { error: "Only draft or in-review guidance can be updated" },
        { status: 409 }
      )
    }
    if (document.recipeRevisionId !== createRecipeRevisionId(recipe.id, recipe.updatedAt)) {
      return NextResponse.json(
        { error: "Recipe changed; create a new guidance draft" },
        { status: 409 }
      )
    }

    const sectionIndex = document.sections.findIndex(
      (section) => section.kind === parsed.data.section.kind
    )
    const currentSection = document.sections[sectionIndex]
    if (sectionIndex === -1 || !currentSection) {
      return NextResponse.json({ error: "Recipe guidance section not found" }, { status: 404 })
    }

    const sections = [...document.sections]
    sections[sectionIndex] = {
      id: currentSection.id,
      ...parsed.data.section,
    }
    const replacement = parseRecipeGuidanceDocument({
      ...document,
      sections,
      updatedAt: advanceTimestamp(document.updatedAt),
    })
    if (!replacement) {
      return NextResponse.json(
        { error: "Section update conflicts with the guidance document" },
        { status: 400 }
      )
    }

    const updatedDocument = await repository.replace(replacement, parsed.data.expectedUpdatedAt)
    return NextResponse.json({
      data: { document: updatedDocument },
      summary: { mode, version: updatedDocument.version, updatedSection: currentSection.kind },
    })
  } catch (error) {
    if (error instanceof RecipeGuidanceConflictError) {
      return NextResponse.json(
        { error: "Recipe guidance changed; refresh and retry" },
        { status: 409 }
      )
    }
    logger.error("Failed to update recipe guidance section", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Recipe guidance datastore is unavailable" }, { status: 503 })
  }
})
