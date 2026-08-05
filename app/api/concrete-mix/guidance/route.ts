import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { calculateConcreteMix, validateConcreteMixInput } from "@/lib/concrete-mix"
import { concreteMixToGuidanceDraft } from "@/lib/concrete-mix-guidance"
import { GUIDANCE_LOCALES, parseGuidanceDraft, type GuidanceLocale } from "@/lib/guidance"

function readLocale(value: unknown): GuidanceLocale | null {
  if (value === undefined || value === null) return "en"
  return GUIDANCE_LOCALES.includes(value as GuidanceLocale) ? (value as GuidanceLocale) : null
}

/**
 * POST - Build the casting procedure for a batch.
 *
 * Returns the draft rather than binding it. Binding runs through
 * POST /api/guidance, which owns the task access check, so authorization for a
 * task stays in one place.
 */
export const POST = withRole(
  "admin",
  "operator",
  "employee"
)(async (request: Request) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }

  const locale = readLocale((body as Record<string, unknown>)?.locale)
  if (!locale) {
    return NextResponse.json(
      { error: `locale must be one of: ${GUIDANCE_LOCALES.join(", ")}` },
      { status: 400 }
    )
  }

  const validation = validateConcreteMixInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const result = calculateConcreteMix(validation.value)
    const draft = concreteMixToGuidanceDraft(result, locale)

    // The draft is generated, not user-supplied, so a schema failure is a bug
    // here rather than bad input. Catch it before it reaches /api/guidance.
    const parsed = parseGuidanceDraft(draft)
    if (!parsed) {
      logger.error("Generated concrete casting guidance failed its own schema", {
        locale,
        stepCount: draft.steps.length,
      })
      return NextResponse.json({ error: "Could not build the casting procedure" }, { status: 500 })
    }

    return NextResponse.json({
      data: { draft: parsed, batch: result },
      summary: {
        locale,
        stepCount: parsed.steps.length,
        timedStepCount: parsed.steps.filter((step) => step.timerMinutes !== undefined).length,
        materialCount: parsed.materials.length,
      },
    })
  } catch (error) {
    logger.error("Failed to build concrete casting guidance", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Could not build the casting procedure" }, { status: 500 })
  }
})
