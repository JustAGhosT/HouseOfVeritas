import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { validateConcreteMixRecordDraft } from "@/lib/concrete-mix-records"
import {
  deleteConcreteMixRecord,
  findConcreteMixRecordById,
  replaceConcreteMixRecord,
} from "@/lib/repositories/concrete-mix-repository"

async function readId(context: {
  params?: Promise<Record<string, string>>
}): Promise<string | null> {
  const params = await context.params
  const id = params?.id
  return typeof id === "string" && id ? id : null
}

// GET - One saved mix with its cast samples
export const GET = withRole(
  "admin",
  "operator",
  "employee"
)(async (_request: Request, context) => {
  const id = await readId(context)
  if (!id) return NextResponse.json({ error: "Mix id is required" }, { status: 400 })

  try {
    const record = await findConcreteMixRecordById(id)
    if (!record) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })
    return NextResponse.json({ data: record })
  } catch (error) {
    logger.error("Failed to load concrete mix record", {
      error: error instanceof Error ? error.message : String(error),
      mixId: id,
    })
    return NextResponse.json({ error: "Failed to load the mix" }, { status: 500 })
  }
})

// PUT - Refine a saved mix. Samples are managed through the samples route.
export const PUT = withRole(
  "admin",
  "operator",
  "employee"
)(async (request: Request, context) => {
  const id = await readId(context)
  if (!id) return NextResponse.json({ error: "Mix id is required" }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }

  const validation = validateConcreteMixRecordDraft(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const existing = await findConcreteMixRecordById(id)
    if (!existing) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })

    const updated = await replaceConcreteMixRecord({
      ...existing,
      ...validation.value,
      // Samples and provenance belong to the record, not to the request body.
      id: existing.id,
      samples: existing.samples,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    })
    if (!updated) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })

    return NextResponse.json({ data: updated })
  } catch (error) {
    logger.error("Failed to update concrete mix record", {
      error: error instanceof Error ? error.message : String(error),
      mixId: id,
    })
    return NextResponse.json({ error: "Failed to update the mix" }, { status: 500 })
  }
})

// DELETE - Retire a saved mix
export const DELETE = withRole(
  "admin",
  "operator"
)(async (_request: Request, context) => {
  const id = await readId(context)
  if (!id) return NextResponse.json({ error: "Mix id is required" }, { status: 400 })

  try {
    const deleted = await deleteConcreteMixRecord(id)
    if (!deleted) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })
    return NextResponse.json({ data: { id, deleted: true } })
  } catch (error) {
    logger.error("Failed to delete concrete mix record", {
      error: error instanceof Error ? error.message : String(error),
      mixId: id,
    })
    return NextResponse.json({ error: "Failed to delete the mix" }, { status: 500 })
  }
})
