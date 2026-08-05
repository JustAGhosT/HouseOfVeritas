import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { getKnowledgeBySlug } from "@/lib/knowledge/retrieval"
import { buildMaintenanceTaskDraft } from "@/lib/knowledge/task-draft"
import { hasGuidanceSafetyBoundaries } from "@/lib/guidance"
import { logger } from "@/lib/logger"

const bodySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  assignedToName: z.string().trim().min(1).max(120).optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  project: z.string().trim().min(1).max(160).optional(),
  relatedAsset: z.number().int().positive().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
})

/**
 * POST /api/knowledge/apply
 * Prepares a maintenance task draft from a curated entry. Operators/admins only.
 * Returns a review-required draft — it does NOT create the task. The client
 * confirms, then posts to /api/tasks. Safety-bearing entries flag human review.
 */
export const POST = withRole("admin", "operator")(async (request) => {
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid knowledge slug is required." },
        { status: 400 }
      )
    }

    const entry = getKnowledgeBySlug(parsed.data.slug)
    if (!entry) {
      return NextResponse.json({ error: "Knowledge entry not found." }, { status: 404 })
    }

    const draft = buildMaintenanceTaskDraft(entry, {
      assignedToName: parsed.data.assignedToName,
      dueDate: parsed.data.dueDate,
      project: parsed.data.project,
      relatedAsset: parsed.data.relatedAsset,
      priority: parsed.data.priority,
    })

    return NextResponse.json({
      data: { taskDraft: draft },
      summary: {
        requiresHumanReview: true,
        hasSafetyBoundaries: hasGuidanceSafetyBoundaries(entry.guidance),
        knowledgeSlug: entry.slug,
      },
    })
  } catch (error) {
    logger.error("Failed to prepare task draft from knowledge", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to prepare the task draft." }, { status: 500 })
  }
})
