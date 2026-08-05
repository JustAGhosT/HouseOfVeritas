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
import {
  buildConcreteMixShoppingList,
  resolveConcreteMixInventory,
  type InventoryResolution,
  type ShoppingList,
} from "@/lib/concrete-mix-inventory"
import { applyRecordToBatchBody } from "@/lib/concrete-mix-records"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"
import { findConcreteMixRecordById } from "@/lib/repositories/concrete-mix-repository"

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
  result: ConcreteMixResult,
  store: unknown
): Promise<{
  result: ConcreteMixResult
  inventory: InventoryResolution
  shoppingList: ShoppingList
}> {
  const { repository } = await getInventoryRepository()
  const items = await repository.list()

  const inventory = resolveConcreteMixInventory(result.materials, items, {
    cementType: input.cementType,
  })
  const mergedCosts = { ...inventory.costs, ...(input.costs ?? {}) }

  return {
    inventory,
    shoppingList: buildConcreteMixShoppingList(inventory, { store }),
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

  const source = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>
  const savedMixId = typeof source.savedMixId === "string" ? source.savedMixId : null

  // A saved mix supplies the settings; anything explicit in the request still
  // wins, so one batch can be nudged without editing the record.
  let batchBody: unknown = body
  if (savedMixId) {
    const record = await findConcreteMixRecordById(savedMixId).catch(() => null)
    if (!record) {
      return NextResponse.json({ error: "Saved mix not found" }, { status: 404 })
    }
    batchBody = applyRecordToBatchBody(record, source)
  }

  const validation = validateConcreteMixInput(batchBody)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const useInventory = source.useInventory === true

  try {
    let result = calculateConcreteMix(validation.value)
    let inventory: InventoryResolution | null = null
    let shoppingList: ShoppingList | null = null

    if (useInventory) {
      const applied = await applyInventory(
        validation.value,
        result,
        (body as Record<string, unknown>).store
      )
      result = applied.result
      inventory = applied.inventory
      shoppingList = applied.shoppingList
    }

    return NextResponse.json({
      data: result,
      inventory,
      shoppingList,
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
        shoppingListCost: shoppingList?.totalEstimatedCostCents ?? null,
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
