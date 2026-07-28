import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import {
  guidanceDraftSchema,
  guidanceMatchesRecipeSnapshot,
  hasGuidanceSafetyBoundaries,
} from "@/lib/guidance"
import { logger } from "@/lib/logger"
import { resolveTaskAccess } from "@/lib/task-access"
import { getUploadMetadataById, isUploadId } from "@/lib/uploads"
import {
  createAndBindGuidance,
  getActiveGuidanceForTask,
} from "@/lib/repositories/guidance-repository"
import { getRecipeById } from "@/lib/repositories/recipe-repository"
import { isRecipeAudienceMatch } from "@/lib/recipes"

const sourceSchema = z.object({
  type: z.enum(["photo", "document", "manual", "recipe"]),
  imageUrl: z.string().trim().max(2_048).optional(),
  mimeType: z.string().trim().max(120).optional(),
  fileName: z.string().trim().max(255).optional(),
  description: z.string().trim().max(2_000).optional(),
  recipeId: z.string().trim().max(160).optional(),
})

const createSchema = z.object({
  taskId: z.string().trim().min(1).max(160),
  draft: guidanceDraftSchema,
  source: sourceSchema,
})

async function authorizeTask(taskId: string, userId: string, role: string) {
  const result = await resolveTaskAccess(taskId, userId, role)
  if (result.status === 404) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 })
  }
  if (result.status === 403) {
    return NextResponse.json({ error: "You do not have access to this task." }, { status: 403 })
  }

  return null
}

async function validateSourceUpload(taskId: string, source: z.infer<typeof sourceSchema>) {
  if (!source.imageUrl) {
    if (source.type === "photo") {
      return NextResponse.json(
        { error: "Uploaded photo URL is required for photo guidance." },
        { status: 400 }
      )
    }
    return null
  }

  const uploadPrefix = "/api/uploads/"
  const uploadId = source.imageUrl.startsWith(uploadPrefix)
    ? source.imageUrl.slice(uploadPrefix.length)
    : ""
  if (!isUploadId(uploadId) || source.imageUrl !== `${uploadPrefix}${uploadId}`) {
    return NextResponse.json(
      { error: "Guidance images must reference a verified task upload." },
      { status: 400 }
    )
  }

  const upload = await getUploadMetadataById(uploadId)
  if (
    !upload ||
    upload.resourceType !== "task-guidance" ||
    upload.resourceId !== taskId ||
    !upload.mimeType.startsWith("image/")
  ) {
    return NextResponse.json(
      { error: "Guidance image is not valid for this task." },
      { status: 400 }
    )
  }

  return null
}

async function validateRecipeSource(
  draft: z.infer<typeof guidanceDraftSchema>,
  source: z.infer<typeof sourceSchema>,
  context: { userId: string; role: string }
) {
  const sourceDeclaresRecipe = source.type === "recipe" || source.recipeId !== undefined
  const draftDeclaresRecipe = draft.sourceRecipeId !== undefined
  if (!sourceDeclaresRecipe && !draftDeclaresRecipe) return null
  if (sourceDeclaresRecipe !== draftDeclaresRecipe) {
    return NextResponse.json({ error: "Invalid recipe guidance provenance." }, { status: 400 })
  }
  if (
    !draft.sourceRecipeId ||
    source.type !== "recipe" ||
    source.recipeId !== draft.sourceRecipeId
  ) {
    return NextResponse.json({ error: "Invalid recipe guidance provenance." }, { status: 400 })
  }

  const recipe = await getRecipeById(draft.sourceRecipeId)
  if (!recipe || !guidanceMatchesRecipeSnapshot(draft, recipe)) {
    return NextResponse.json({ error: "Invalid recipe guidance provenance." }, { status: 400 })
  }
  if (
    context.role !== "admin" &&
    (recipe.status !== "published" ||
      !isRecipeAudienceMatch(recipe.audienceUserIds, context.userId))
  ) {
    return NextResponse.json({ error: "You do not have access to this recipe." }, { status: 403 })
  }

  return null
}

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  const taskId = new URL(request.url).searchParams.get("taskId")?.trim()
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required." }, { status: 400 })
  }

  try {
    const authorizationError = await authorizeTask(taskId, context.userId, context.role)
    if (authorizationError) return authorizationError

    const guidance = await getActiveGuidanceForTask(taskId)
    return NextResponse.json({ data: { guidance } })
  } catch (error) {
    logger.error("Failed to load task guidance", {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to load task guidance." }, { status: 500 })
  }
})

export const POST = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  try {
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid task guidance." }, { status: 400 })
    }

    const authorizationError = await authorizeTask(parsed.data.taskId, context.userId, context.role)
    if (authorizationError) return authorizationError

    const sourceError = await validateSourceUpload(parsed.data.taskId, parsed.data.source)
    if (sourceError) return sourceError

    const recipeSourceError = await validateRecipeSource(
      parsed.data.draft,
      parsed.data.source,
      context
    )
    if (recipeSourceError) return recipeSourceError

    if (!hasGuidanceSafetyBoundaries(parsed.data.draft)) {
      return NextResponse.json(
        { error: "Guidance must include safety notes and a step stop condition." },
        { status: 400 }
      )
    }

    const result = await createAndBindGuidance({
      ...parsed.data,
      createdBy: context.userId,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error("Failed to save task guidance", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to save task guidance." }, { status: 500 })
  }
})
