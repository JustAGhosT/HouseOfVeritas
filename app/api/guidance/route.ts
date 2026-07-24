import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { guidanceDraftSchema } from "@/lib/guidance"
import { logger } from "@/lib/logger"
import { resolveTaskAccess } from "@/lib/task-access"
import { getUploadMetadataById, isUploadId } from "@/lib/uploads"
import {
  createAndBindGuidance,
  getActiveGuidanceForTask,
} from "@/lib/repositories/guidance-repository"

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

export const GET = withRole("admin", "operator", "employee", "resident")(
  async (request, context) => {
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
  }
)

export const POST = withRole("admin", "operator", "employee", "resident")(
  async (request, context) => {
    try {
      const parsed = createSchema.safeParse(await request.json())
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid task guidance." }, { status: 400 })
      }

      const authorizationError = await authorizeTask(
        parsed.data.taskId,
        context.userId,
        context.role
      )
      if (authorizationError) return authorizationError

      const sourceError = await validateSourceUpload(parsed.data.taskId, parsed.data.source)
      if (sourceError) return sourceError

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
  }
)
