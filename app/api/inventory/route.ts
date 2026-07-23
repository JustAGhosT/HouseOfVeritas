import { NextResponse } from "next/server"
import { routeToInngest } from "@/lib/workflows"
import {
  getInventory,
  restockByName,
  findIndexById,
  type InventoryItem,
} from "@/lib/inventory-store"
import { withRole } from "@/lib/auth/rbac"

function guessCategory(name: string): InventoryItem["category"] {
  const lowerName = name.toLowerCase()
  if (/cement|brick|sand|gravel|paint|plaster|timber|wood|pvc|pipe/i.test(lowerName)) {
    return "building_materials"
  }
  if (/detergent|bleach|soap|cleaner|polish|mop|broom/i.test(lowerName)) {
    return "cleaning_supplies"
  }
  if (/fertilizer|seed|soil|mulch|compost|plant|garden/i.test(lowerName)) {
    return "garden_supplies"
  }
  if (/drill|screw|nail|bolt|nut|tape|glue|sandpaper|bit|blade/i.test(lowerName)) {
    return "workshop_consumables"
  }
  if (/diesel|petrol|fuel|oil/i.test(lowerName)) {
    return "fuel"
  }
  if (/chlorine|pool|kitchen|bathroom/i.test(lowerName)) {
    return "household"
  }
  return "other"
}

function guessUnit(name: string): string {
  const lowerName = name.toLowerCase()
  if (/kg|kilogram/i.test(lowerName)) return "kg"
  if (/litre|liter|ml|l$/i.test(lowerName)) return "litres"
  if (/bag|sack/i.test(lowerName)) return "bags"
  if (/bucket|tub|tin/i.test(lowerName)) return "buckets"
  if (/roll|tape/i.test(lowerName)) return "rolls"
  if (/pack|box|set/i.test(lowerName)) return "packs"
  if (/piece|pcs|pc/i.test(lowerName)) return "pieces"
  if (/metre|meter|m$/i.test(lowerName)) return "metres"
  return "units"
}

function findInventoryItemByName(inventory: InventoryItem[], name: string): number {
  const normalized = name.toLowerCase().trim()
  const exact = inventory.findIndex((i) => i.name.toLowerCase().trim() === normalized)
  if (exact >= 0) return exact
  return -1
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, maxLength)
}

function optionalPhotoUrl(value: unknown): string | undefined {
  const photoUrl = optionalText(value, 2048)
  if (!photoUrl) return undefined
  if (
    photoUrl.startsWith("/api/uploads/") ||
    photoUrl.startsWith("/api/files/serve?") ||
    photoUrl.startsWith("https://")
  ) {
    return photoUrl
  }
  return undefined
}

// GET - List inventory with filters
export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request: Request) => {
  const inventory = getInventory()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const lowStock = searchParams.get("lowStock") === "true"
  const location = searchParams.get("location")
  const barcode = searchParams.get("barcode")
  const search = searchParams.get("search")

  let items = [...inventory]

  if (barcode) {
    items = items.filter((i) => i.barcode === barcode)
    return NextResponse.json({ items })
  }

  if (search) {
    const searchLower = search.toLowerCase()
    items = items.filter(
      (i) => i.name.toLowerCase().includes(searchLower) || i.barcode?.includes(search)
    )
  }

  if (category) {
    items = items.filter((i) => i.category === category)
  }
  if (lowStock) {
    items = items.filter((i) => i.currentStock <= i.reorderPoint)
  }
  if (location) {
    items = items.filter((i) => i.location.toLowerCase().includes(location.toLowerCase()))
  }

  const alerts = inventory
    .filter((i) => i.currentStock <= i.reorderPoint)
    .map((i) => ({
      id: i.id,
      name: i.name,
      currentStock: i.currentStock,
      reorderPoint: i.reorderPoint,
      urgency: i.currentStock <= i.minStock ? "critical" : "warning",
      estimatedDaysLeft:
        i.averageConsumption > 0 ? Math.round((i.currentStock / i.averageConsumption) * 30) : null,
    }))

  const summary = {
    totalItems: items.length,
    totalValue: items.reduce((sum, i) => sum + i.totalValue, 0),
    lowStockCount: alerts.filter((a) => a.urgency === "warning").length,
    criticalCount: alerts.filter((a) => a.urgency === "critical").length,
    byCategory: items.reduce(
      (acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    ),
  }

  return NextResponse.json({
    items,
    alerts,
    summary,
  })
})

// POST - Add inventory item or record consumption
export const POST = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request: Request) => {
  const inventory = getInventory()
  try {
    const body = await request.json()
    const { action } = body

    if (action === "consume") {
      const { itemId, quantity, usedBy, purpose } = body

      const index = findIndexById(itemId)
      if (index === -1) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 })
      }

      if (inventory[index].currentStock < quantity) {
        return NextResponse.json({ error: "Insufficient stock" }, { status: 400 })
      }

      inventory[index].currentStock -= quantity
      inventory[index].totalValue = inventory[index].currentStock * inventory[index].unitCost
      inventory[index].consumptionHistory.push({
        date: new Date().toISOString().split("T")[0],
        quantity,
        usedBy,
        purpose,
      })

      const needsAlert = inventory[index].currentStock <= inventory[index].reorderPoint
      const item = inventory[index]

      if (needsAlert) {
        const urgency =
          item.currentStock <= item.minStock ? ("critical" as const) : ("warning" as const)
        routeToInngest({
          name: "house-of-veritas/inventory.low_stock",
          data: {
            itemId: item.id,
            name: item.name,
            category: item.category,
            currentStock: item.currentStock,
            reorderPoint: item.reorderPoint,
            location: item.location,
            urgency,
          },
        }).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        item,
        alert: needsAlert
          ? {
              message: `Low stock alert: ${item.name}`,
              currentStock: item.currentStock,
              reorderPoint: item.reorderPoint,
            }
          : null,
      })
    }

    if (action === "restock") {
      const { itemId, quantity, unitCost } = body

      const index = findIndexById(itemId)
      if (index === -1) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 })
      }

      inventory[index].currentStock += quantity
      if (unitCost) {
        inventory[index].unitCost = unitCost
      }
      inventory[index].totalValue = inventory[index].currentStock * inventory[index].unitCost
      inventory[index].lastRestocked = new Date().toISOString().split("T")[0]

      return NextResponse.json({
        success: true,
        item: inventory[index],
      })
    }

    const {
      name,
      category,
      unit,
      currentStock,
      minStock,
      maxStock,
      reorderPoint,
      location,
      supplier,
      unitCost,
      label,
      photoUrl,
      photoFileId,
    } = body

    if (!name || !category || !unit || !location) {
      return NextResponse.json(
        { error: "name, category, unit, and location are required" },
        { status: 400 }
      )
    }

    const newItem: InventoryItem = {
      id: `inv_${Date.now()}`,
      name: optionalText(name, 120) ?? name,
      category,
      unit: optionalText(unit, 40) ?? unit,
      currentStock: currentStock || 0,
      minStock: minStock || 1,
      maxStock: maxStock || 10,
      reorderPoint: reorderPoint || minStock || 1,
      lastRestocked: new Date().toISOString().split("T")[0],
      averageConsumption: 0,
      location: optionalText(location, 120) ?? location,
      supplier: optionalText(supplier, 120),
      unitCost: unitCost || 0,
      totalValue: (currentStock || 0) * (unitCost || 0),
      label: optionalText(label, 120),
      photoUrl: optionalPhotoUrl(photoUrl),
      photoFileId: optionalText(photoFileId, 120),
      photoUploadedAt: optionalPhotoUrl(photoUrl) ? new Date().toISOString() : undefined,
      capturedBy: optionalPhotoUrl(photoUrl)
        ? optionalText(request.headers.get("x-user-id"), 80)
        : undefined,
      consumptionHistory: [],
    }

    inventory.push(newItem)

    return NextResponse.json({
      success: true,
      item: newItem,
    })
  } catch (error) {
    return NextResponse.json({ error: "Operation failed" }, { status: 500 })
  }
})

// Generate shopping list from low stock items OR import from OCR
export const PUT = withRole(
  "admin",
  "operator",
  "employee"
)(async (request: Request) => {
  const inventory = getInventory()
  try {
    const body = await request.json()
    const { action, store } = body

    if (action === "import-from-ocr") {
      const { items, supplier, location, category } = body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "No items to import" }, { status: 400 })
      }

      const importedItems: InventoryItem[] = []
      const updatedItems: InventoryItem[] = []
      const errors: string[] = []

      for (const ocrItem of items) {
        const { name, quantity, price, total, unit } = ocrItem

        const existingIndex = findInventoryItemByName(inventory, name)

        if (existingIndex >= 0) {
          const existing = inventory[existingIndex]
          existing.currentStock += quantity || 1
          if (price) existing.unitCost = price
          existing.totalValue = existing.currentStock * existing.unitCost
          existing.lastRestocked = new Date().toISOString().split("T")[0]
          if (supplier) existing.supplier = supplier
          updatedItems.push(existing)
        } else {
          const unitCost = price || (total && quantity ? total / quantity : 0)
          const newItem: InventoryItem = {
            id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name,
            category: category || guessCategory(name),
            unit: unit || guessUnit(name),
            currentStock: quantity || 1,
            minStock: Math.ceil((quantity || 1) * 0.2),
            maxStock: (quantity || 1) * 3,
            reorderPoint: Math.ceil((quantity || 1) * 0.3),
            lastRestocked: new Date().toISOString().split("T")[0],
            averageConsumption: 0,
            location: location || "Workshop Store",
            supplier: supplier,
            unitCost,
            totalValue: (quantity || 1) * unitCost,
            consumptionHistory: [],
          }
          inventory.push(newItem)
          importedItems.push(newItem)
        }
      }

      return NextResponse.json({
        success: true,
        imported: importedItems.length,
        updated: updatedItems.length,
        importedItems,
        updatedItems,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully processed ${importedItems.length + updatedItems.length} items (${importedItems.length} new, ${updatedItems.length} updated)`,
      })
    }

    if (action === "generate-shopping-list") {
      const lowStockItems = inventory.filter((i) => i.currentStock <= i.reorderPoint)

      const shoppingList = lowStockItems.map((item) => ({
        name: item.name,
        currentStock: item.currentStock,
        orderQuantity: item.maxStock - item.currentStock,
        unit: item.unit,
        estimatedCost: (item.maxStock - item.currentStock) * item.unitCost,
        supplier: item.supplier || "Any",
        priority: item.currentStock <= item.minStock ? "high" : "medium",
      }))

      const totalEstimatedCost = shoppingList.reduce((sum, i) => sum + i.estimatedCost, 0)

      const storeUrls: Record<string, string> = {
        cashbuild: "https://www.cashbuild.co.za/search?q=",
        builders: "https://www.builders.co.za/search/?text=",
        makro: "https://www.makro.co.za/search/?text=",
        stodels: "https://www.stodels.co.za/catalogsearch/result/?q=",
      }

      const storeSearchLinks =
        store && storeUrls[store.toLowerCase()]
          ? shoppingList.map((item) => ({
              item: item.name,
              searchUrl: `${storeUrls[store.toLowerCase()]}${encodeURIComponent(item.name)}`,
            }))
          : null

      return NextResponse.json({
        success: true,
        shoppingList,
        totalEstimatedCost,
        itemCount: shoppingList.length,
        storeSearchLinks,
        generatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Operation failed" }, { status: 500 })
  }
})
