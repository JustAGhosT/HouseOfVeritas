import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  calculateConcreteMix,
  getConcreteMixOptions,
  validateConcreteMixInput,
} from "@/lib/concrete-mix"

// GET - Slab presets, mix designs and color intensities for the picker UI
export const GET = withRole(
  "admin",
  "operator",
  "employee"
)(async () => {
  return NextResponse.json({ data: getConcreteMixOptions() })
})

// POST - Calculate a materials list for a batch of cast garden stones
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

  const validation = validateConcreteMixInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const result = calculateConcreteMix(validation.value)

    return NextResponse.json({
      data: result,
      summary: {
        slabCount: result.batch.slabCount,
        mixedVolumeM3: result.batch.mixedVolumeM3,
        pigmentGramsPerSlab: result.pigment.gramsPerSlab,
        pigmentTotalKg: result.pigment.totalKg,
        pigmentPurchaseKg: result.pigment.purchaseKg,
        cementBags:
          result.materials.find((material) => material.material === "cement")?.quantity ?? 0,
        estimatedCostCents: result.estimatedCostCents,
        warningCount: result.warnings.length,
      },
    })
  } catch (error) {
    logger.error("Concrete mix calculation failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Calculation failed" }, { status: 500 })
  }
})
