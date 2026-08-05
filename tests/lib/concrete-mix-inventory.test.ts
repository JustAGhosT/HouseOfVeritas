import { describe, it, expect } from "vitest"
import { calculateConcreteMix, validateConcreteMixInput } from "@/lib/concrete-mix"
import type { ConcreteMixResult } from "@/lib/concrete-mix"
import {
  buildConcreteMixShoppingList,
  planConcreteMixConsumption,
  resolveConcreteMixInventory,
} from "@/lib/concrete-mix-inventory"
import type { PurchasableMaterialId } from "@/lib/concrete-mix-inventory"
import type { InventoryItem } from "@/lib/inventory-store"

function item(
  overrides: Pick<InventoryItem, "id" | "name" | "unit"> & Partial<InventoryItem>
): InventoryItem {
  return {
    category: "building_materials",
    currentStock: 10,
    minStock: 1,
    maxStock: 100,
    reorderPoint: 2,
    lastRestocked: "2026-01-01",
    averageConsumption: 0,
    location: "Workshop Store",
    unitCost: 0,
    totalValue: 0,
    consumptionHistory: [],
    ...overrides,
  }
}

const CEMENT = item({
  id: "inv_cement",
  name: "Cement 50kg bags",
  unit: "bags",
  unitCost: 89.95,
  currentStock: 8,
})

const PIGMENT = item({
  id: "inv_pigment",
  name: "Powafix Cement Colour Oxide - Terracotta 1kg",
  unit: "bags",
  unitCost: 89.95,
  currentStock: 2,
})

const SAND = item({
  id: "inv_sand",
  name: "Plaster sand",
  unit: "m3",
  unitCost: 450,
  currentStock: 3,
  supplier: "Cashbuild",
})

const STONE = item({
  id: "inv_stone",
  name: "13mm Stone",
  unit: "m3",
  unitCost: 520,
  currentStock: 2,
})

/** 50 stones with no waste: 3 bags of cement, 0.3 m3 of sand, 8 kg of pigment. */
function batch(body: Record<string, unknown> = {}): ConcreteMixResult {
  const validation = validateConcreteMixInput({
    presetId: "square-400",
    slabCount: 50,
    wastePercent: 0,
    ...body,
  })
  if (!validation.ok) throw new Error(validation.error)
  return calculateConcreteMix(validation.value)
}

function resolve(items: InventoryItem[], body: Record<string, unknown> = {}) {
  const result = batch(body)
  const cementType = (body.cementType as "grey" | "white") ?? "grey"
  return resolveConcreteMixInventory(result.materials, items, { cementType })
}

function materialFor(resolution: ReturnType<typeof resolve>, material: PurchasableMaterialId) {
  return resolution.materials.find((entry) => entry.material === material)
}

describe("resolveConcreteMixInventory matching", () => {
  it("matches cement, sand and pigment to their stock items", () => {
    const resolution = resolve([CEMENT, PIGMENT, SAND])

    expect(materialFor(resolution, "cement")?.item?.id).toBe("inv_cement")
    expect(materialFor(resolution, "sand")?.item?.id).toBe("inv_sand")
    expect(materialFor(resolution, "pigment")?.item?.id).toBe("inv_pigment")
  })

  it("does not mistake cement colour oxide for a bag of cement", () => {
    const resolution = resolve([PIGMENT])

    expect(materialFor(resolution, "cement")?.item).toBeNull()
    expect(materialFor(resolution, "pigment")?.item?.id).toBe("inv_pigment")
    expect(resolution.unmatched).toContain("cement")
  })

  it("does not mistake fibre cement board for either cement or fiber", () => {
    const board = item({ id: "inv_board", name: "Fibre cement board 3.6m", unit: "sheets" })
    const resolution = resolve([board], { reinforcement: "fiber" })

    expect(materialFor(resolution, "cement")?.item).toBeNull()
    expect(materialFor(resolution, "fiber")?.item).toBeNull()
  })

  it("does not mistake stepping stones or shade mesh for aggregate and reinforcement", () => {
    const decoys = [
      item({ id: "inv_stepping", name: "Cast stepping stones 400mm", unit: "units" }),
      item({ id: "inv_shade", name: "Shade mesh 40% green", unit: "m2" }),
    ]
    const resolution = resolve(decoys, { mixDesignId: "paver-25", reinforcement: "mesh" })

    expect(materialFor(resolution, "stone")?.item).toBeNull()
    expect(materialFor(resolution, "mesh")?.item).toBeNull()
  })

  it("reports a named variant as an exact match and a bare name as a likely one", () => {
    const resolution = resolve([CEMENT, SAND, STONE], { mixDesignId: "paver-25" })

    // "Plaster sand" and "13mm Stone" name the variant; "Cement 50kg bags" does not.
    expect(materialFor(resolution, "sand")?.confidence).toBe("exact")
    expect(materialFor(resolution, "stone")?.confidence).toBe("exact")
    expect(materialFor(resolution, "cement")?.confidence).toBe("likely")
  })

  it("picks white cement only when white cement was asked for", () => {
    const white = item({ id: "inv_white", name: "White cement 50kg", unit: "bags", unitCost: 240 })

    expect(materialFor(resolve([CEMENT, white], { cementType: "white" }), "cement")?.item?.id).toBe(
      "inv_white"
    )
    expect(materialFor(resolve([CEMENT, white]), "cement")?.item?.id).toBe("inv_cement")
  })

  it("refuses grey cement rather than substituting the white bag on the shelf", () => {
    const white = item({ id: "inv_white", name: "White cement 50kg", unit: "bags" })
    const resolution = resolve([white])

    expect(materialFor(resolution, "cement")?.item).toBeNull()
    expect(resolution.unmatched).toContain("cement")
  })

  it("prefers the item that is actually in stock when both names fit", () => {
    const empty = item({ id: "inv_a", name: "Plaster sand", unit: "m3", currentStock: 0 })
    const stocked = item({ id: "inv_b", name: "Plaster sand", unit: "m3", currentStock: 4 })
    const resolution = resolve([empty, stocked])

    expect(materialFor(resolution, "sand")?.item?.id).toBe("inv_b")
  })

  it("never matches water, which comes from a tap", () => {
    const result = batch()
    const resolution = resolveConcreteMixInventory(result.materials, [CEMENT, PIGMENT, SAND], {
      cementType: "grey",
    })

    expect(result.materials.filter((line) => line.material === "water")).toHaveLength(1)
    expect(resolution.materials).toHaveLength(result.materials.length - 1)
  })
})

describe("resolveConcreteMixInventory units and pricing", () => {
  it("converts rand unit costs into cents per purchase unit", () => {
    const resolution = resolve([CEMENT, PIGMENT, SAND])

    // R89.95 a bag, and the bag on the shelf is the 50 kg bag we buy in.
    expect(materialFor(resolution, "cement")?.unitCostCents).toBe(8995)
    expect(materialFor(resolution, "cement")?.assumedPackParity).toBe(true)
    // R450 a cubic metre, bought by the cubic metre.
    expect(materialFor(resolution, "sand")?.unitCostCents).toBe(45000)
    expect(materialFor(resolution, "sand")?.assumedPackParity).toBe(false)
  })

  it("scales a price given per kilogram up to the price of a bag", () => {
    const loose = item({ id: "inv_loose", name: "Cement", unit: "kg", unitCost: 1.8 })
    const resolution = resolve([loose])

    // R1.80/kg across a 50 kg bag is R90.00.
    expect(materialFor(resolution, "cement")?.inventoryUnitsPerPurchaseUnit).toBe(50)
    expect(materialFor(resolution, "cement")?.unitCostCents).toBe(9000)
  })

  it("costs the batch at what the estate actually pays", () => {
    const resolution = resolve([CEMENT, PIGMENT, SAND])

    // 3 bags at R89.95, 0.3 m3 at R450, 8 kg of pigment at R89.95.
    expect(materialFor(resolution, "cement")?.estimatedCostCents).toBe(26985)
    expect(materialFor(resolution, "sand")?.estimatedCostCents).toBe(13500)
    expect(materialFor(resolution, "pigment")?.estimatedCostCents).toBe(71960)
    expect(resolution.totalCostCents).toBe(112445)
  })

  it("hands back a costs map that prices the same batch through the calculator", () => {
    const resolution = resolve([CEMENT, PIGMENT, SAND])
    const repriced = batch({ costs: resolution.costs })

    expect(resolution.costs).toEqual({ cement: 8995, sand: 45000, pigment: 8995 })
    expect(repriced.estimatedCostCents).toBe(resolution.totalCostCents)
  })

  it("flags a unit it cannot reconcile instead of guessing a price", () => {
    const odd = item({ id: "inv_odd", name: "Plaster sand", unit: "wheelbarrows", unitCost: 30 })
    const resolution = resolve([CEMENT, odd])

    expect(resolution.unitMismatches).toEqual(["sand"])
    expect(materialFor(resolution, "sand")?.item?.id).toBe("inv_odd")
    expect(materialFor(resolution, "sand")?.unitCostCents).toBeNull()
    expect(materialFor(resolution, "sand")?.shortfallQuantity).toBeNull()
    expect(resolution.costs.sand).toBeUndefined()
  })

  it("returns a null total when nothing could be priced", () => {
    const resolution = resolve([])

    expect(resolution.totalCostCents).toBeNull()
    expect(resolution.costs).toEqual({})
    expect(resolution.unmatched).toEqual(["cement", "sand", "pigment"])
  })
})

describe("resolveConcreteMixInventory shortfall", () => {
  it("reports how many whole bags are still to be bought", () => {
    // Needs 3 bags of cement and 8 kg of pigment; 8 bags and 2 kg are on hand.
    const resolution = resolve([CEMENT, PIGMENT, SAND])

    expect(materialFor(resolution, "cement")?.shortfallQuantity).toBe(0)
    expect(materialFor(resolution, "pigment")?.shortfallQuantity).toBe(6)
    expect(resolution.shortfalls.map((entry) => entry.material)).toEqual(["pigment"])
  })

  it("leaves a bulk aggregate shortfall fractional rather than rounding to whole cubes", () => {
    const thin = item({ id: "inv_thin", name: "Plaster sand", unit: "m3", currentStock: 0.1 })
    const resolution = resolve([thin])

    expect(materialFor(resolution, "sand")?.shortfallQuantity).toBe(0.2)
  })

  it("counts a material with no matching stock item as unmatched, not as covered", () => {
    const resolution = resolve([CEMENT, SAND])

    expect(materialFor(resolution, "pigment")?.shortfallQuantity).toBeNull()
    expect(resolution.unmatched).toEqual(["pigment"])
    expect(resolution.fullyStocked).toBe(false)
  })

  it("is fully stocked only when every line is matched and covered", () => {
    const stocked = [
      item({ id: "inv_cement", name: "Cement 50kg bags", unit: "bags", currentStock: 20 }),
      item({ id: "inv_sand", name: "Plaster sand", unit: "m3", currentStock: 5 }),
      item({ id: "inv_pigment", name: "Oxide pigment terracotta", unit: "kg", currentStock: 25 }),
    ]
    const resolution = resolve(stocked)

    expect(resolution.shortfalls).toEqual([])
    expect(resolution.unmatched).toEqual([])
    expect(resolution.fullyStocked).toBe(true)
  })

  it("covers reinforcement and admixture lines too", () => {
    const extras = [
      CEMENT,
      SAND,
      PIGMENT,
      item({
        id: "inv_fiber",
        name: "Polypropylene concrete fibre 900g",
        unit: "bags",
        unitCost: 250,
        currentStock: 0,
      }),
      item({
        id: "inv_wp",
        name: "Integral waterproofer",
        unit: "litres",
        unitCost: 95,
        currentStock: 1,
      }),
    ]
    const resolution = resolve(extras, {
      reinforcement: "fiber",
      admixtures: ["waterproofer"],
    })

    expect(materialFor(resolution, "fiber")?.unitCostCents).toBe(25000)
    expect(materialFor(resolution, "fiber")?.shortfallQuantity).toBe(1)
    // Three bags of cement means three litres of waterproofer, and one is on hand.
    expect(materialFor(resolution, "waterproofer")?.shortfallQuantity).toBe(2)
  })

  it("is pure: the same inventory and batch resolve identically", () => {
    const items = [CEMENT, PIGMENT, SAND]

    expect(resolve(items)).toEqual(resolve(items))
  })
})

describe("buildConcreteMixShoppingList", () => {
  it("lists what is short and what the store has no record of at all", () => {
    const list = buildConcreteMixShoppingList(resolve([CEMENT, PIGMENT, SAND]))

    // 6 kg of pigment short, and nothing on the list is missing entirely.
    expect(list.lines.map((line) => [line.material, line.reason, line.quantity])).toEqual([
      ["pigment", "shortfall", 6],
    ])
  })

  it("puts the full requirement on the list for a material with no stock item", () => {
    const list = buildConcreteMixShoppingList(resolve([CEMENT]))
    const sand = list.lines.find((line) => line.material === "sand")

    expect(sand?.reason).toBe("not-stocked")
    expect(sand?.quantity).toBe(0.3)
    expect(sand?.estimatedCostCents).toBeNull()
    expect(list.unpriced).toContain("sand")
  })

  it("prices the shortfall at the estate's own unit cost", () => {
    const list = buildConcreteMixShoppingList(resolve([CEMENT, PIGMENT, SAND]))

    // 6 kg of pigment at R89.95.
    expect(list.lines[0].estimatedCostCents).toBe(53970)
    expect(list.totalEstimatedCostCents).toBe(53970)
  })

  it("adds store search links only for a store it knows", () => {
    const known = buildConcreteMixShoppingList(resolve([CEMENT, PIGMENT, SAND]), {
      store: "cashbuild",
    })
    const unknown = buildConcreteMixShoppingList(resolve([CEMENT, PIGMENT, SAND]), {
      store: "corner shop",
    })

    expect(known.store).toBe("cashbuild")
    expect(known.lines[0].searchUrl).toContain("cashbuild.co.za")
    expect(known.lines[0].searchUrl).toContain(encodeURIComponent("Powafix"))
    expect(unknown.store).toBeNull()
    expect(unknown.lines[0].searchUrl).toBeNull()
  })

  it("carries the supplier already recorded on the stock item", () => {
    const shortSand = item({
      id: "inv_sand",
      name: "Plaster sand",
      unit: "m3",
      currentStock: 0,
      supplier: "Cashbuild",
    })
    const list = buildConcreteMixShoppingList(resolve([CEMENT, PIGMENT, shortSand]))

    expect(list.lines.find((line) => line.material === "sand")?.supplier).toBe("Cashbuild")
  })

  it("is empty when everything is covered", () => {
    const stocked = [
      item({ id: "inv_cement", name: "Cement 50kg bags", unit: "bags", currentStock: 20 }),
      item({ id: "inv_sand", name: "Plaster sand", unit: "m3", currentStock: 5 }),
      item({ id: "inv_pigment", name: "Oxide pigment terracotta", unit: "kg", currentStock: 25 }),
    ]
    const list = buildConcreteMixShoppingList(resolve(stocked))

    expect(list.lines).toEqual([])
    expect(list.totalEstimatedCostCents).toBeNull()
  })
})

describe("planConcreteMixConsumption", () => {
  const stocked = [
    item({
      id: "inv_cement",
      name: "Cement 50kg bags",
      unit: "bags",
      currentStock: 20,
      unitCost: 89.95,
    }),
    item({ id: "inv_sand", name: "Plaster sand", unit: "m3", currentStock: 5, unitCost: 450 }),
    item({
      id: "inv_pigment",
      name: "Oxide pigment terracotta",
      unit: "kg",
      currentStock: 25,
      unitCost: 89.95,
    }),
  ]

  it("draws whole purchase units out of the store", () => {
    const plan = planConcreteMixConsumption(resolve(stocked))

    // Three bags leave the shelf even though the mix only uses 2.88 of them.
    expect(plan.canProceed).toBe(true)
    expect(plan.lines.find((line) => line.material === "cement")).toMatchObject({
      quantity: 3,
      unit: "bags",
      currentStock: 20,
      remainingStock: 17,
    })
  })

  it("converts into the inventory's own unit when it differs from the pack", () => {
    const loose = [
      item({ id: "inv_cement", name: "Cement", unit: "kg", currentStock: 500 }),
      item({ id: "inv_sand", name: "Plaster sand", unit: "m3", currentStock: 5 }),
      item({ id: "inv_pigment", name: "Oxide pigment", unit: "kg", currentStock: 25 }),
    ]
    const plan = planConcreteMixConsumption(resolve(loose))

    // Three 50 kg bags is 150 kg off a stock kept in kilograms.
    expect(plan.lines.find((line) => line.material === "cement")?.quantity).toBe(150)
  })

  it("blocks the whole batch when one material is short", () => {
    const short = stocked.map((entry) =>
      entry.id === "inv_pigment" ? { ...entry, currentStock: 2 } : entry
    )
    const plan = planConcreteMixConsumption(resolve(short))

    expect(plan.canProceed).toBe(false)
    expect(plan.lines).toEqual([])
    expect(plan.blockers[0]).toContain("need 8 kg, 2 in stock")
  })

  it("blocks when a material has no stock item at all", () => {
    const plan = planConcreteMixConsumption(resolve([CEMENT, SAND]))

    expect(plan.canProceed).toBe(false)
    expect(plan.blockers.some((blocker) => blocker.includes("oxide pigment"))).toBe(true)
  })

  it("blocks when the inventory unit cannot be reconciled", () => {
    const odd = [
      ...stocked.filter((entry) => entry.id !== "inv_sand"),
      item({ id: "inv_sand", name: "Plaster sand", unit: "wheelbarrows", currentStock: 40 }),
    ]
    const plan = planConcreteMixConsumption(resolve(odd))

    expect(plan.canProceed).toBe(false)
    expect(plan.blockers.some((blocker) => blocker.includes("wheelbarrows"))).toBe(true)
  })
})
