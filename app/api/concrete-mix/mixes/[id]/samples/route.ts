import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  canAcceptAnotherSample,
  validateConcreteMixSampleDraft,
  MAX_SAMPLES_PER_RECORD,
  type ConcreteMixSample,
} from "@/lib/concrete-mix-records"
import {
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

/**
 * POST - Attach a photograph of a stone actually cast from this mix.
 *
 * This is how the estate builds its own colour chart. A dosage number does not
 * tell anyone what the stone will look like against their sand and their
 * cement; a photo at a known cure age does.
 */
export const POST = withRole(
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

  const validation = validateConcreteMixSampleDraft(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const record = await findConcreteMixRecordById(id)
    if (!record) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })

    if (!canAcceptAnotherSample(record)) {
      return NextResponse.json(
        { error: `A mix can hold at most ${MAX_SAMPLES_PER_RECORD} samples` },
        { status: 409 }
      )
    }

    const sample: ConcreteMixSample = {
      ...validation.value,
      id: `sample_${randomUUID()}`,
      capturedBy: context.userId,
      capturedAt: new Date().toISOString(),
    }

    const updated = await replaceConcreteMixRecord({
      ...record,
      samples: [...record.samples, sample],
      updatedAt: new Date().toISOString(),
    })
    if (!updated) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })

    return NextResponse.json(
      { data: { sample, sampleCount: updated.samples.length } },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Failed to attach concrete mix sample", {
      error: error instanceof Error ? error.message : String(error),
      mixId: id,
    })
    return NextResponse.json({ error: "Failed to attach the sample" }, { status: 500 })
  }
})

// DELETE - Drop a sample that turned out to be a bad photograph
export const DELETE = withRole(
  "admin",
  "operator",
  "employee"
)(async (request: Request, context) => {
  const id = await readId(context)
  if (!id) return NextResponse.json({ error: "Mix id is required" }, { status: 400 })

  const sampleId = new URL(request.url).searchParams.get("sampleId")
  if (!sampleId) return NextResponse.json({ error: "sampleId is required" }, { status: 400 })

  try {
    const record = await findConcreteMixRecordById(id)
    if (!record) return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })

    const samples = record.samples.filter((sample) => sample.id !== sampleId)
    if (samples.length === record.samples.length) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 })
    }

    await replaceConcreteMixRecord({ ...record, samples, updatedAt: new Date().toISOString() })
    return NextResponse.json({ data: { sampleId, deleted: true, sampleCount: samples.length } })
  } catch (error) {
    logger.error("Failed to remove concrete mix sample", {
      error: error instanceof Error ? error.message : String(error),
      mixId: id,
    })
    return NextResponse.json({ error: "Failed to remove the sample" }, { status: 500 })
  }
})
