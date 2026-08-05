import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  calculateConcreteMix,
  getConcreteMixOptions,
  validateConcreteMixInput,
  type ConcreteMixInput,
  type ConcreteMixResult,
} from "@/lib/concrete-mix"
import { resolveConcreteMixInventory, type InventoryResolution } from "@/lib/concrete-mix-inventory"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"

// GET - Slab presets, mix designs, cast methods and color intensities for the picker UI
export const GET = withRole(
  "admin",
  "operator",
  "employee"
)(async () => {
  return NextResponse.json({ data: getConcreteMixOptions() })
})

/**
 * Prices the batch off real stock and repeats the calculation, letting any
 * caller-supplied price win over the inventory's. Quantities do not depend on
 * cost, so the resolution computed here stays valid for the repriced result.
 */
async function applyInventory(
  input: ConcreteMixInput,
  result: ConcreteMixResult
): Promise<{ result: ConcreteMixResult; inventory: InventoryResolution }> {
  const { repository } = await getInventoryRepository()
  const items = await repository.list()

  const inventory = resolveConcreteMixInventory(result.materials, items, {
    cementType: input.cementType,
  })
  const mergedCosts = { ...inventory.costs, ...(input.costs ?? {}) }

  return {
    inventory,
    result: calculateConcreteMix({ ...input, costs: mergedCosts }),
  }
}

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

  const useInventory =
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).useInventory === true

  try {
    let result = calculateConcreteMix(validation.value)
    let inventory: InventoryResolution | null = null

    if (useInventory) {
      const applied = await applyInventory(validation.value, result)
      result = applied.result
      inventory = applied.inventory
    }

    return NextResponse.json({
      data: result,
      inventory,
      summary: {
        slabCount: result.batch.slabCount,
        mixedVolumeM3: result.batch.mixedVolumeM3,
        pigmentGramsPerSlab: result.pigment.gramsPerSlab,
        pigmentTotalKg: result.pigment.totalKg,
        pigmentPurchaseKg: result.pigment.purchaseKg,
        cementBags:
          result.materials.find((material) => material.material === "cement")?.purchaseQuantity ??
          0,
        mixerLoadCount: result.mixerPlan?.loadCount ?? null,
        coveredAreaM2: result.coverage?.coveredAreaM2 ?? null,
        estimatedCostCents: result.estimatedCostCents,
        shortfallCount: inventory?.shortfalls.length ?? null,
        fullyStocked: inventory?.fullyStocked ?? null,
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
