/**
 * Bridges the concrete mix calculator to the estate's inventory.
 *
 * The calculator is deliberately ignorant of what is in the store: it returns
 * what a batch needs, priced only if the caller happened to know the prices.
 * This module matches those material lines to real `InventoryItem` records so
 * a batch can be costed at what the estate actually pays, and so the plan can
 * say what is short before anyone drives to Cashbuild.
 *
 * Pure and synchronous. Callers load the inventory; nothing here touches a
 * repository, so every matching rule stays unit-testable.
 *
 * Two unit conventions collide here and both are easy to get wrong:
 *   1. `InventoryItem.unitCost` is RANDS as a float (89.95). The calculator
 *      works in integer cents. Everything crossing this boundary is converted.
 *   2. `InventoryItem.unit` is free text ("bags", "kg", "litres"). When it is a
 *      pack word we have to assume the estate stocks the same pack size the
 *      calculator buys in, which is flagged rather than hidden.
 */

import { CEMENT_BAG_KG, FIBER_BAG_KG, MESH_SHEET_M2 } from "@/lib/concrete-mix"
import type { CementType, ConcreteMixCosts, MaterialId, MaterialLine } from "@/lib/concrete-mix"
import type { InventoryItem } from "@/lib/inventory-store"

export type MatchConfidence = "exact" | "likely"

type BaseUnit = "kg" | "m3" | "litres" | "m2"

/** Materials that can be bought. Water is drawn from a tap, not a shelf. */
export type PurchasableMaterialId = Exclude<MaterialId, "water">

interface PurchaseUnitSpec {
  baseUnit: BaseUnit
  /** Base units contained in one purchase unit, e.g. 50 kg in one cement bag. */
  perPurchaseUnit: number
}

/**
 * Derived from the same constants the calculator uses to build its purchase
 * units, so the two cannot drift apart.
 */
const PURCHASE_UNITS: Record<PurchasableMaterialId, PurchaseUnitSpec> = {
  cement: { baseUnit: "kg", perPurchaseUnit: CEMENT_BAG_KG },
  sand: { baseUnit: "m3", perPurchaseUnit: 1 },
  stone: { baseUnit: "m3", perPurchaseUnit: 1 },
  pigment: { baseUnit: "kg", perPurchaseUnit: 1 },
  fiber: { baseUnit: "kg", perPurchaseUnit: FIBER_BAG_KG },
  mesh: { baseUnit: "m2", perPurchaseUnit: MESH_SHEET_M2 },
  plasticizer: { baseUnit: "litres", perPurchaseUnit: 1 },
  waterproofer: { baseUnit: "litres", perPurchaseUnit: 1 },
}

interface MaterialMatcher {
  /** At least one of these must appear in the normalized name. */
  include: RegExp
  /** None of these may appear. Keeps pigment out of the cement match and back. */
  exclude?: RegExp
  /** A stronger signal for this exact material, used to break ties. */
  prefer?: RegExp
}

const MATERIAL_MATCHERS: Record<PurchasableMaterialId, MaterialMatcher> = {
  cement: {
    include: /\bcement\b/,
    // "Cement Colour Oxide" and "fibre cement board" are not bags of cement.
    exclude: /(colour|color|oxide|pigment|dye|tint|fibre|fiber|board|sheet)/,
  },
  sand: {
    include: /\bsand\b/,
    exclude: /(sandpaper|sandstone|sandbag)/,
    prefer: /(plaster|building|river|concrete)\s+sand/,
  },
  stone: {
    // "klip" is what the yard will have written on the bin.
    include: /\b(stone|aggregate|gravel|klip)\b/,
    exclude: /(sandstone|stepping|garden\s+stone|paving|cast)/,
    prefer: /\d+\s*mm/,
  },
  pigment: {
    include: /(pigment|oxide|cement\s+(colour|color)|\bdye\b|\btint\b)/,
    exclude: /(remover|stripper)/,
  },
  fiber: {
    include: /(fibre|fiber)/,
    exclude: /(board|sheet|glass\s*wool|optic)/,
    prefer: /(polypropylene|micro|concrete)/,
  },
  mesh: {
    include: /\bmesh\b/,
    exclude: /(shade|insect|fly|gauze)/,
    prefer: /(welded|reinforcing|reinforcement|ref\s*\d+)/,
  },
  plasticizer: {
    include: /(plasticiser|plasticizer)/,
  },
  waterproofer: {
    include: /waterproof/,
    exclude: /(paint|membrane|torch)/,
  },
}

const PACK_UNIT = /^(bag|bags|sack|sacks|sheet|sheets|pack|packs|unit|units|piece|pieces|pcs)$/
const UNIT_ALIASES: Array<{ pattern: RegExp; baseUnit: BaseUnit }> = [
  { pattern: /^(kg|kgs|kilo|kilos|kilogram|kilograms)$/, baseUnit: "kg" },
  { pattern: /^(m3|m³|cubic\s*(metre|meter)s?|cube|cubes)$/, baseUnit: "m3" },
  { pattern: /^(l|ls|litre|litres|liter|liters)$/, baseUnit: "litres" },
  { pattern: /^(m2|m²|square\s*(metre|meter)s?)$/, baseUnit: "m2" },
]

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function normalizeUnit(unit: string): BaseUnit | "pack" | null {
  const normalized = normalizeText(unit)
  if (PACK_UNIT.test(normalized)) return "pack"
  for (const alias of UNIT_ALIASES) {
    if (alias.pattern.test(normalized)) return alias.baseUnit
  }
  return null
}

function isPurchasable(material: MaterialId): material is PurchasableMaterialId {
  return material !== "water"
}

/**
 * Cement comes in grey and white and they are not interchangeable, so the
 * requested type steers the match rather than being ignored.
 */
function variantPreference(
  material: PurchasableMaterialId,
  cementType: CementType
): RegExp | undefined {
  if (material !== "cement") return MATERIAL_MATCHERS[material].prefer
  return cementType === "white" ? /\bwhite\b/ : /\b(grey|gray|opc|cem\s*ii)\b/
}

interface Candidate {
  item: InventoryItem
  score: number
  preferred: boolean
}

function scoreCandidates(
  material: PurchasableMaterialId,
  items: readonly InventoryItem[],
  cementType: CementType
): Candidate[] {
  const matcher = MATERIAL_MATCHERS[material]
  const prefer = variantPreference(material, cementType)

  const candidates: Candidate[] = []
  for (const item of items) {
    const name = normalizeText(item.name)
    if (!matcher.include.test(name)) continue
    if (matcher.exclude?.test(name)) continue

    // Grey cement is the unmarked default: an item simply called "cement"
    // should not lose to one explicitly named white when grey was asked for.
    const preferred = prefer ? prefer.test(name) : false
    const contradicts = material === "cement" && cementType === "grey" && /\bwhite\b/.test(name)
    if (contradicts) continue

    let score = 1
    if (preferred) score += 3
    if (item.category === "building_materials") score += 1
    if (item.currentStock > 0) score += 1

    candidates.push({ item, score, preferred })
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    // Shorter names are the more generic, more likely-intended stock item.
    if (left.item.name.length !== right.item.name.length) {
      return left.item.name.length - right.item.name.length
    }
    return left.item.id.localeCompare(right.item.id)
  })
}

export interface ResolvedMaterial {
  material: PurchasableMaterialId
  label: string
  purchaseQuantity: number
  purchaseUnit: string
  item: {
    id: string
    name: string
    unit: string
    location: string
    supplier?: string
    currentStock: number
  } | null
  confidence: MatchConfidence | null
  /** How many inventory units make up one purchase unit. Null when irreconcilable. */
  inventoryUnitsPerPurchaseUnit: number | null
  /** True when the match assumes the estate stocks the pack size we buy in. */
  assumedPackParity: boolean
  stockInPurchaseUnits: number | null
  /** Purchase units still to buy, rounded up for packs. Null when unknown. */
  shortfallQuantity: number | null
  unitCostCents: number | null
  estimatedCostCents: number | null
}

export interface InventoryResolution {
  materials: ResolvedMaterial[]
  /** Feed back into `calculateConcreteMix` to price the batch at real cost. */
  costs: ConcreteMixCosts
  unmatched: PurchasableMaterialId[]
  /** Matched to stock, but the inventory unit could not be reconciled. */
  unitMismatches: PurchasableMaterialId[]
  shortfalls: ResolvedMaterial[]
  totalCostCents: number | null
  /** True when every purchasable line is covered by stock on hand. */
  fullyStocked: boolean
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Matches each purchasable material line to the best inventory item, then
 * derives its real unit cost, the stock on hand and the shortfall.
 */
export function resolveConcreteMixInventory(
  materials: readonly MaterialLine[],
  items: readonly InventoryItem[],
  options: { cementType: CementType }
): InventoryResolution {
  const resolved: ResolvedMaterial[] = []
  const costs: ConcreteMixCosts = {}
  const unmatched: PurchasableMaterialId[] = []
  const unitMismatches: PurchasableMaterialId[] = []

  for (const line of materials) {
    if (!isPurchasable(line.material)) continue

    const spec = PURCHASE_UNITS[line.material]
    const best = scoreCandidates(line.material, items, options.cementType)[0]

    if (!best) {
      unmatched.push(line.material)
      resolved.push({
        material: line.material,
        label: line.label,
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnit: line.purchaseUnit,
        item: null,
        confidence: null,
        inventoryUnitsPerPurchaseUnit: null,
        assumedPackParity: false,
        stockInPurchaseUnits: null,
        shortfallQuantity: null,
        unitCostCents: null,
        estimatedCostCents: null,
      })
      continue
    }

    const inventoryUnit = normalizeUnit(best.item.unit)
    const assumedPackParity = inventoryUnit === "pack"
    const inventoryUnitsPerPurchaseUnit =
      inventoryUnit === "pack" ? 1 : inventoryUnit === spec.baseUnit ? spec.perPurchaseUnit : null

    if (inventoryUnitsPerPurchaseUnit === null) {
      unitMismatches.push(line.material)
    }

    const unitCostCents =
      inventoryUnitsPerPurchaseUnit === null
        ? null
        : Math.round(best.item.unitCost * 100 * inventoryUnitsPerPurchaseUnit)

    const stockInPurchaseUnits =
      inventoryUnitsPerPurchaseUnit === null
        ? null
        : roundTo(best.item.currentStock / inventoryUnitsPerPurchaseUnit, 3)

    const rawShortfall =
      stockInPurchaseUnits === null
        ? null
        : Math.max(0, line.purchaseQuantity - stockInPurchaseUnits)
    // Packs can only be bought whole; bulk aggregate is ordered by the metre.
    const shortfallQuantity =
      rawShortfall === null
        ? null
        : assumedPackParity || spec.perPurchaseUnit !== 1
          ? Math.ceil(rawShortfall)
          : roundTo(rawShortfall, 3)

    if (unitCostCents !== null) {
      costs[line.material] = unitCostCents
    }

    resolved.push({
      material: line.material,
      label: line.label,
      purchaseQuantity: line.purchaseQuantity,
      purchaseUnit: line.purchaseUnit,
      item: {
        id: best.item.id,
        name: best.item.name,
        unit: best.item.unit,
        location: best.item.location,
        supplier: best.item.supplier,
        currentStock: best.item.currentStock,
      },
      confidence: best.preferred ? "exact" : "likely",
      inventoryUnitsPerPurchaseUnit,
      assumedPackParity,
      stockInPurchaseUnits,
      shortfallQuantity,
      unitCostCents,
      estimatedCostCents:
        unitCostCents === null ? null : Math.round(line.purchaseQuantity * unitCostCents),
    })
  }

  const priced = resolved.filter((entry) => entry.estimatedCostCents !== null)
  const shortfalls = resolved.filter(
    (entry) => entry.shortfallQuantity !== null && entry.shortfallQuantity > 0
  )

  return {
    materials: resolved,
    costs,
    unmatched,
    unitMismatches,
    shortfalls,
    totalCostCents: priced.length
      ? priced.reduce((sum, entry) => sum + (entry.estimatedCostCents ?? 0), 0)
      : null,
    fullyStocked: shortfalls.length === 0 && unmatched.length === 0,
  }
}
