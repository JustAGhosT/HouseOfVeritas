import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { getKnowledgeBySlug } from "@/lib/knowledge/retrieval"
import { checkPublishable, profileIdForEntry } from "@/lib/knowledge/publication"
import { buildMaintenanceTaskDraft } from "@/lib/knowledge/task-draft"
import { logger } from "@/lib/logger"
import { loadEffectiveGateProfile } from "@/lib/repositories/knowledge-gate-profile-repository"

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
 * confirms, then posts to /api/tasks.
 *
 * The Tier-0 gates are re-checked here against the administrator's *effective*
 * profile, not just the built-in one the entry shipped against. That is the
 * point of re-checking: tightening a gate in the control plane stops entries
 * being turned into work immediately, with no deploy and no seed change.
 */
export const POST = withRole(
  "admin",
  "operator"
)(async (request) => {
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid knowledge slug is required." }, { status: 400 })
    }

    const entry = getKnowledgeBySlug(parsed.data.slug)
    if (!entry) {
      return NextResponse.json({ error: "Knowledge entry not found." }, { status: 404 })
    }

    const { profile, source } = await loadEffectiveGateProfile(profileIdForEntry(entry))
    const check = checkPublishable(entry, profile, source)
    if (!check.publishable) {
      logger.warn("Blocked applying a knowledge entry that does not clear its gates", {
        slug: entry.slug,
        profileId: profile.id,
        profileSource: source,
        reasons: check.reasons,
      })
      return NextResponse.json(
        {
          error: "This knowledge entry does not currently clear its publication gates.",
          reasons: check.reasons,
          gates: check.gates,
        },
        { status: 409 }
      )
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
        hasSafetyBoundaries: check.hasSafetyBoundaries,
        knowledgeSlug: entry.slug,
        gateProfileId: profile.id,
        gateProfileSource: source,
        skippedGates: check.gates?.skippedGates ?? [],
      },
    })
  } catch (error) {
    logger.error("Failed to prepare task draft from knowledge", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to prepare the task draft." }, { status: 500 })
  }
})
