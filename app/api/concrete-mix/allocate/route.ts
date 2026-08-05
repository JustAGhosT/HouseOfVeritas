import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import {
  calculateConcreteMix,
  validateConcreteMixInput,
  type ConcreteMixResult,
} from "@/lib/concrete-mix"
import { resolveConcreteMixInventory } from "@/lib/concrete-mix-inventory"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"
import {
  createJobAllocation,
  type JobAllocation,
} from "@/lib/repositories/job-workspace-repository"
import { findProjectById } from "@/lib/repositories/project-repository"

/**
 * Describes the batch on every allocation line, so a cost queried months later
 * still says which mix and colour it paid for.
 */
function batchDescription(result: ConcreteMixResult): string {
  const parts = [
    `${result.batch.slabCount} x ${result.slab.dimensions.lengthMm}x${result.slab.dimensions.widthMm}x${result.slab.dimensions.thicknessMm}mm`,
    result.mixDesign.label,
    result.castMethod.label,
    `pigment ${result.pigment.dosagePercent}% of cement`,
  ]
  return parts.join(", ")
}

// POST - Book a calculated batch to a job as material allocations
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

  const source = body as Record<string, unknown>
  const projectId = typeof source?.projectId === "string" ? source.projectId.trim() : ""
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  const areaId = typeof source?.areaId === "string" && source.areaId ? source.areaId : undefined

  // Quantities are always recomputed here; a client-supplied bill of materials
  // would let anyone book arbitrary cost against a job.
  const validation = validateConcreteMixInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const project = await findProjectById(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    let input = validation.value
    const { repository } = await getInventoryRepository()
    const items = await repository.list()

    // Price off real stock first, otherwise the allocation carries no cost.
    const firstPass = calculateConcreteMix(input)
    const inventory = resolveConcreteMixInventory(firstPass.materials, items, {
      cementType: input.cementType,
    })
    input = { ...input, costs: { ...inventory.costs, ...(input.costs ?? {}) } }
    const result = calculateConcreteMix(input)

    const description = batchDescription(result)
    const now = new Date().toISOString()
    const allocations: JobAllocation[] = []

    for (const line of result.materials) {
      // Water has no cost and no supplier; booking it adds noise, not accuracy.
      if (line.material === "water") continue

      allocations.push({
        id: `alloc-${randomUUID()}`,
        projectId,
        type: "material",
        name: line.label,
        areaId,
        quantity: line.purchaseQuantity,
        unit: line.purchaseUnit,
        costCents: line.estimatedCostCents,
        notes: description,
        createdAt: now,
        updatedAt: now,
      })
    }

    for (const allocation of allocations) {
      await createJobAllocation(allocation)
    }

    return NextResponse.json({
      data: { allocations, batch: result },
      summary: {
        projectId,
        projectName: project.name,
        allocationCount: allocations.length,
        estimatedCostCents: result.estimatedCostCents,
        unpricedMaterials: result.unpricedMaterials,
      },
    })
  } catch (error) {
    logger.error("Failed to allocate concrete batch to job", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    })
    return NextResponse.json({ error: "Failed to create allocations" }, { status: 500 })
  }
})
