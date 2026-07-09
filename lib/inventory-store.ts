export interface InventoryItem {
  id: string
  name: string
  category:
    | "building_materials"
    | "cleaning_supplies"
    | "garden_supplies"
    | "workshop_consumables"
    | "household"
    | "fuel"
    | "other"
  unit: string
  currentStock: number
  minStock: number
  maxStock: number
  reorderPoint: number
  lastRestocked: string
  averageConsumption: number
  location: string
  supplier?: string
  unitCost: number
  totalValue: number
  expiryDate?: string
  barcode?: string
  consumptionHistory: Array<{
    date: string
    quantity: number
    usedBy: string
    purpose: string
  }>
}

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

const inventory: InventoryItem[] = [
  {
    id: "inv_001",
    name: "Cement 50kg bags",
    category: "building_materials",
    unit: "bags",
    currentStock: 8,
    minStock: 5,
    maxStock: 20,
    reorderPoint: 5,
    lastRestocked: "2026-02-10",
    averageConsumption: 6,
    location: "Workshop Store",
    supplier: "Cashbuild",
    unitCost: 89.95,
    totalValue: 719.6,
    barcode: "6001234567890",
    consumptionHistory: [
      { date: "2026-02-18", quantity: 2, usedBy: "charl", purpose: "Fence repair" },
    ],
  },
  {
    id: "inv_002",
    name: "Pool Chlorine 5kg",
    category: "household",
    unit: "buckets",
    currentStock: 2,
    minStock: 3,
    maxStock: 6,
    reorderPoint: 3,
    barcode: "6001234567891",
    lastRestocked: "2026-01-25",
    expiryDate: "2026-06-30",
    averageConsumption: 2,
    location: "Pool House",
    supplier: "Pool & Spa",
    unitCost: 285.0,
    totalValue: 570.0,
    consumptionHistory: [
      { date: "2026-02-15", quantity: 1, usedBy: "lucky", purpose: "Weekly pool treatment" },
    ],
  },
  {
    id: "inv_003",
    name: "Diesel (Litres)",
    category: "fuel",
    unit: "litres",
    currentStock: 45,
    minStock: 50,
    maxStock: 200,
    reorderPoint: 50,
    lastRestocked: "2026-02-05",
    averageConsumption: 80,
    location: "Fuel Store",
    unitCost: 23.5,
    totalValue: 1057.5,
    barcode: "6001234567892",
    consumptionHistory: [
      { date: "2026-02-19", quantity: 35, usedBy: "charl", purpose: "Generator & Tractor" },
    ],
  },
  {
    id: "inv_004",
    name: "Garden fertilizer 25kg",
    category: "garden_supplies",
    unit: "bags",
    currentStock: 4,
    minStock: 2,
    maxStock: 8,
    reorderPoint: 2,
    lastRestocked: "2026-02-01",
    averageConsumption: 1.5,
    location: "Garden Shed",
    supplier: "Stodels",
    unitCost: 195.0,
    totalValue: 780.0,
    barcode: "6001234567893",
    consumptionHistory: [],
  },
  {
    id: "inv_005",
    name: "Cleaning detergent 5L",
    category: "cleaning_supplies",
    unit: "bottles",
    currentStock: 3,
    minStock: 4,
    maxStock: 10,
    reorderPoint: 4,
    lastRestocked: "2026-02-08",
    averageConsumption: 3,
    location: "Scullery",
    supplier: "Makro",
    unitCost: 125.0,
    totalValue: 375.0,
    barcode: "6001234567894",
    consumptionHistory: [
      { date: "2026-02-17", quantity: 1, usedBy: "irma", purpose: "Weekly cleaning" },
    ],
  },
  {
    id: "inv_006",
    name: "Paint - White 20L",
    category: "building_materials",
    barcode: "6001234567895",
    unit: "buckets",
    currentStock: 1,
    minStock: 2,
    maxStock: 5,
    reorderPoint: 2,
    lastRestocked: "2025-12-15",
    expiryDate: "2026-03-15",
    averageConsumption: 0.5,
    location: "Workshop Store",
    supplier: "Builders Warehouse",
    unitCost: 899.0,
    totalValue: 899.0,
    consumptionHistory: [],
  },
]

if (!DEMO_DATA_ENABLED) {
  inventory.splice(0, inventory.length)
}

function findByName(name: string): number {
  const lower = name.toLowerCase().trim()
  if (!lower) return -1
  return inventory.findIndex(
    (i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase())
  )
}

export function getAll(): InventoryItem[] {
  return [...inventory]
}

export function getById(id: string): InventoryItem | undefined {
  return inventory.find((i) => i.id === id)
}

export function getByBarcode(barcode: string): InventoryItem | undefined {
  return inventory.find((i) => i.barcode === barcode)
}

export function restockByName(itemName: string, quantity: number): InventoryItem | null {
  const index = findByName(itemName)
  if (index === -1 || quantity <= 0) return null
  const item = inventory[index]
  item.currentStock += quantity
  item.totalValue = item.currentStock * item.unitCost
  item.lastRestocked = new Date().toISOString().split("T")[0]
  return item
}

export function findIndexById(id: string): number {
  return inventory.findIndex((i) => i.id === id)
}

export function getInventory(): InventoryItem[] {
  return inventory
}
