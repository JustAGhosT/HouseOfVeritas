import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"
import { ASSET_CATEGORIES, type AssetCategory } from "@/lib/constants/asset-categories"

export { ASSET_CATEGORIES, type AssetCategory }

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Azure AI Configuration (with mock fallback)
const AZURE_AI_CONFIG = {
  endpoint: process.env.AZURE_AI_ENDPOINT,
  apiKey: process.env.AZURE_AI_KEY,
  documentIntelligenceEndpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
  documentIntelligenceKey: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
}

// Check if Azure AI is configured
export function isAzureAIConfigured(): boolean {
  return !!(AZURE_AI_CONFIG.endpoint && AZURE_AI_CONFIG.apiKey)
}

// Asset Conditions
export type AssetCondition = "excellent" | "good" | "fair" | "poor" | "needs_repair" | "for_parts"

// Sale Status
export type SaleStatus = "not_for_sale" | "for_sale" | "pending_sale" | "sold"

// Asset interface
export interface Asset {
  id: string
  name: string
  description: string
  category: AssetCategory
  condition: AssetCondition
  brand?: string
  model?: string
  serialNumber?: string
  purchaseDate?: string
  purchasePrice?: number
  currentValue?: number
  location: string
  storageOption?: string
  responsiblePerson: string
  photos: string[]
  maintenanceHistory: Array<{
    date: string
    type: string
    cost: number
    notes: string
  }>
  saleStatus: SaleStatus
  salePrice?: number
  saleListings?: Array<{
    platform: string
    listingId: string
    listingUrl: string
    status: "active" | "sold" | "expired"
  }>
  tags: string[]
  lastInventoryCheck: string
  createdAt: string
  updatedAt: string
}

const DEMO_ASSETS: Asset[] = [
  {
    id: "asset_001",
    name: "Toyota Hilux 2.8 GD-6",
    description: "Double cab bakkie, white, leather seats, canopy",
    category: "vehicles",
    condition: "good",
    brand: "Toyota",
    model: "Hilux 2.8 GD-6",
    serialNumber: "AHTBB3CD109012345",
    purchaseDate: "2022-03-15",
    purchasePrice: 650000,
    currentValue: 520000,
    location: "Garage",
    storageOption: "garage",
    responsiblePerson: "charl",
    photos: ["/assets/hilux-1.jpg", "/assets/hilux-2.jpg"],
    maintenanceHistory: [
      { date: "2025-11-15", type: "Full Service", cost: 4500, notes: "Oil, filters, brake pads" },
    ],
    saleStatus: "not_for_sale",
    tags: ["vehicle", "bakkie", "work"],
    lastInventoryCheck: "2026-02-01",
    createdAt: "2022-03-15T10:00:00Z",
    updatedAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "asset_002",
    name: "Husqvarna Automower 450X",
    description: "Robotic lawn mower, covers up to 5000m²",
    category: "garden_equipment",
    condition: "excellent",
    brand: "Husqvarna",
    model: "Automower 450X",
    serialNumber: "HSQ450X2024001",
    purchaseDate: "2024-01-10",
    purchasePrice: 45000,
    currentValue: 38000,
    location: "Garden Shed",
    storageOption: "garden shed",
    responsiblePerson: "lucky",
    photos: ["/assets/automower-1.jpg"],
    maintenanceHistory: [],
    saleStatus: "not_for_sale",
    tags: ["garden", "automated", "premium"],
    lastInventoryCheck: "2026-02-15",
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2026-02-15T10:00:00Z",
  },
  {
    id: "asset_003",
    name: "Bosch GWS 22-230 Angle Grinder",
    description: "230mm angle grinder, 2200W",
    category: "workshop_tools",
    condition: "fair",
    brand: "Bosch",
    model: "GWS 22-230",
    purchaseDate: "2020-06-20",
    purchasePrice: 2800,
    currentValue: 800,
    location: "Workshop",
    storageOption: "workshop",
    responsiblePerson: "charl",
    photos: [],
    maintenanceHistory: [
      { date: "2025-08-10", type: "Brush replacement", cost: 150, notes: "Carbon brushes worn" },
    ],
    saleStatus: "for_sale",
    salePrice: 650,
    tags: ["power-tool", "workshop"],
    lastInventoryCheck: "2026-02-10",
    createdAt: "2020-06-20T10:00:00Z",
    updatedAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "asset_004",
    name: 'Samsung 65" QLED TV',
    description: "Smart TV, 4K, Wall mounted in lounge",
    category: "electronics",
    condition: "excellent",
    brand: "Samsung",
    model: "QN65Q80C",
    serialNumber: "SAM65Q80C2023456",
    purchaseDate: "2023-11-25",
    purchasePrice: 28000,
    currentValue: 22000,
    location: "Main Lounge",
    storageOption: "main lounge",
    responsiblePerson: "hans",
    photos: ["/assets/tv-1.jpg"],
    maintenanceHistory: [],
    saleStatus: "not_for_sale",
    tags: ["electronics", "entertainment", "smart-home"],
    lastInventoryCheck: "2026-02-01",
    createdAt: "2023-11-25T10:00:00Z",
    updatedAt: "2026-02-01T10:00:00Z",
  },
  {
    id: "asset_005",
    name: "Weber Genesis II E-410",
    description: "4-burner gas braai, stainless steel",
    category: "outdoor_furniture",
    condition: "good",
    brand: "Weber",
    model: "Genesis II E-410",
    purchaseDate: "2021-12-15",
    purchasePrice: 32000,
    currentValue: 18000,
    location: "Patio",
    storageOption: "patio",
    responsiblePerson: "lucky",
    photos: ["/assets/braai-1.jpg"],
    maintenanceHistory: [
      { date: "2025-09-01", type: "Deep clean", cost: 0, notes: "Annual cleaning" },
    ],
    saleStatus: "for_sale",
    salePrice: 15000,
    saleListings: [
      {
        platform: "Gumtree",
        listingId: "GT123456",
        listingUrl: "https://gumtree.co.za/123",
        status: "active",
      },
    ],
    tags: ["outdoor", "braai", "entertainment"],
    lastInventoryCheck: "2026-02-05",
    createdAt: "2021-12-15T10:00:00Z",
    updatedAt: "2026-02-20T10:00:00Z",
  },
]

// In-memory asset store (in production, use MongoDB)
let assets: Asset[] = DEMO_DATA_ENABLED ? [...DEMO_ASSETS] : []

// GET - List assets with filters
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") as AssetCategory | null
  const condition = searchParams.get("condition") as AssetCondition | null
  const saleStatus = searchParams.get("saleStatus") as SaleStatus | null
  const responsible = searchParams.get("responsible")
  const search = searchParams.get("search")

  let filteredAssets = [...assets]

  if (category) {
    filteredAssets = filteredAssets.filter((a) => a.category === category)
  }
  if (condition) {
    filteredAssets = filteredAssets.filter((a) => a.condition === condition)
  }
  if (saleStatus) {
    filteredAssets = filteredAssets.filter((a) => a.saleStatus === saleStatus)
  }
  if (responsible) {
    filteredAssets = filteredAssets.filter((a) => a.responsiblePerson === responsible)
  }
  if (search) {
    const searchLower = search.toLowerCase()
    filteredAssets = filteredAssets.filter(
      (a) =>
        a.name.toLowerCase().includes(searchLower) ||
        a.description.toLowerCase().includes(searchLower) ||
        a.brand?.toLowerCase().includes(searchLower) ||
        a.tags.some((t) => t.toLowerCase().includes(searchLower))
    )
  }

  // Calculate summary
  const summary = {
    total: filteredAssets.length,
    totalValue: filteredAssets.reduce((sum, a) => sum + (a.currentValue || 0), 0),
    forSale: filteredAssets.filter((a) => a.saleStatus === "for_sale").length,
    needsAttention: filteredAssets.filter(
      (a) => a.condition === "poor" || a.condition === "needs_repair"
    ).length,
    byCategory: Object.keys(ASSET_CATEGORIES).reduce(
      (acc, cat) => {
        acc[cat] = filteredAssets.filter((a) => a.category === cat).length
        return acc
      },
      {} as Record<string, number>
    ),
  }

  const { loadStorageOptions } = await import("@/lib/storage-options")
  const storageOptions = await loadStorageOptions()

  return NextResponse.json({
    assets: filteredAssets,
    summary,
    categories: ASSET_CATEGORIES,
    storageOptions,
  })
})

// POST - Create new asset
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const {
      name,
      description,
      category,
      condition = "good",
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchasePrice,
      currentValue,
      location,
      storageOption,
      photos = [],
      tags = [],
      saleStatus = "not_for_sale",
      salePrice,
    } = body

    if (!name || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 })
    }

    const { loadStorageOptions } = await import("@/lib/storage-options")
    const storageOptions = await loadStorageOptions()
    const resolvedStorage =
      storageOption && storageOptions.includes(storageOption)
        ? storageOption
        : location || storageOptions[0]

    const responsiblePerson = ASSET_CATEGORIES[category as AssetCategory]?.responsible || "hans"

    const newAsset: Asset = {
      id: `asset_${Date.now()}`,
      name,
      description: description || "",
      category,
      condition,
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchasePrice,
      currentValue: currentValue || purchasePrice,
      location: location || resolvedStorage,
      storageOption: resolvedStorage,
      responsiblePerson,
      photos,
      maintenanceHistory: [],
      saleStatus,
      salePrice,
      tags,
      lastInventoryCheck: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    assets.push(newAsset)

    return NextResponse.json({
      success: true,
      asset: newAsset,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 })
  }
})

// PUT - Update asset
export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 })
    }

    const index = assets.findIndex((a) => a.id === id)
    if (index === -1) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }

    // Update responsible person if category changed
    if (updates.category && updates.category !== assets[index].category) {
      updates.responsiblePerson = ASSET_CATEGORIES[updates.category as AssetCategory]?.responsible
    }

    assets[index] = {
      ...assets[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      asset: assets[index],
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 })
  }
})

// DELETE - Remove asset
export const DELETE = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Asset ID required" }, { status: 400 })
  }

  const index = assets.findIndex((a) => a.id === id)
  if (index === -1) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const deleted = assets.splice(index, 1)[0]

  return NextResponse.json({
    success: true,
    deleted: deleted.id,
  })
})
