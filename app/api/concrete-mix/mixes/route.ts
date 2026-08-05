import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { validateConcreteMixRecordDraft, type ConcreteMixRecord } from "@/lib/concrete-mix-records"
import {
  createConcreteMixRecord,
  listConcreteMixRecords,
} from "@/lib/repositories/concrete-mix-repository"

// GET - Every saved mix, so the picker can offer "our terracotta" by name
export const GET = withRole(
  "admin",
  "operator",
  "employee"
)(async () => {
  try {
    const records = await listConcreteMixRecords()
    return NextResponse.json({
      data: records,
      summary: {
        count: records.length,
        withSamples: records.filter((record) => record.samples.length > 0).length,
      },
    })
  } catch (error) {
    logger.error("Failed to list concrete mix records", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to load saved mixes" }, { status: 500 })
  }
})

// POST - Save a mix the estate wants to reproduce
export const POST = withRole(
  "admin",
  "operator",
  "employee"
)(async (request: Request, context) => {
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
    const existing = await listConcreteMixRecords()
    const clash = existing.find(
      (record) => record.name.toLowerCase() === validation.value.name.toLowerCase()
    )
    // Two mixes with the same name defeat the point of naming them.
    if (clash) {
      return NextResponse.json(
        { error: `A saved mix named "${clash.name}" already exists` },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const record: ConcreteMixRecord = {
      ...validation.value,
      id: `mix_${randomUUID()}`,
      samples: [],
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    }

    await createConcreteMixRecord(record)
    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    logger.error("Failed to create concrete mix record", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to save the mix" }, { status: 500 })
  }
})
