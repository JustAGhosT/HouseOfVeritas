import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { toISODateString } from "@/lib/utils"
import { routeToInngest } from "@/lib/workflows"
import { calculateConcreteMix, validateConcreteMixInput } from "@/lib/concrete-mix"
import type { ConcreteMixResult } from "@/lib/concrete-mix"
import {
  planConcreteMixConsumption,
  resolveConcreteMixInventory,
} from "@/lib/concrete-mix-inventory"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"

function castPurpose(result: ConcreteMixResult): string {
  const color = result.pigment.intensityId ?? `${result.pigment.dosagePercent}%`
  return `Cast ${result.batch.slabCount} garden stones, ${result.mixDesign.label}, ${color} pigment`
}

// POST - Draw the batch's materials out of stock once it has actually been cast
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

  const validation = validateConcreteMixInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const source = body as Record<string, unknown>
  const usedBy =
    typeof source?.usedBy === "string" && source.usedBy ? source.usedBy : context.userId

  try {
    const { repository } = await getInventoryRepository()
    const items = await repository.list()

    const result = calculateConcreteMix(validation.value)
    const inventory = resolveConcreteMixInventory(result.materials, items, {
      cementType: validation.value.cementType,
    })
    const plan = planConcreteMixConsumption(inventory)

    // Refuse the whole batch rather than drawing down half of it.
    if (!plan.canProceed) {
      return NextResponse.json(
        { error: "Cannot draw this batch from stock", blockers: plan.blockers },
        { status: 409 }
      )
    }

    const purpose =
      typeof source?.purpose === "string" && source.purpose.trim()
        ? source.purpose.trim().slice(0, 200)
        : castPurpose(result)
    const consumedOn = toISODateString()
    const alerts: Array<{ itemId: string; name: string; urgency: "critical" | "warning" }> = []

    for (const line of plan.lines) {
      const existing = await repository.findById(line.itemId)
      if (!existing) {
        // The list was read moments ago, so this means a concurrent delete.
        logger.warn("Inventory item vanished mid-consumption", { itemId: line.itemId })
        continue
      }

      existing.currentStock = Math.max(0, existing.currentStock - line.quantity)
      existing.totalValue = existing.currentStock * existing.unitCost
      existing.consumptionHistory.push({
        date: consumedOn,
        quantity: line.quantity,
        usedBy,
        purpose,
      })
      const updated = await repository.update(existing)

      if (updated.currentStock <= updated.reorderPoint) {
        const urgency = updated.currentStock <= updated.minStock ? "critical" : "warning"
        alerts.push({ itemId: updated.id, name: updated.name, urgency })
        routeToInngest({
          name: "house-of-veritas/inventory.low_stock",
          data: {
            itemId: updated.id,
            name: updated.name,
            category: updated.category,
            currentStock: updated.currentStock,
            reorderPoint: updated.reorderPoint,
            location: updated.location,
            urgency,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      data: { consumed: plan.lines, alerts, batch: result },
      summary: {
        itemsConsumed: plan.lines.length,
        purpose,
        usedBy,
        alertCount: alerts.length,
      },
    })
  } catch (error) {
    logger.error("Failed to consume concrete batch materials", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to record consumption" }, { status: 500 })
  }
})
