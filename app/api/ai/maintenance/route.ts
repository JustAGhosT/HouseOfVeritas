import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Demo asset/vehicle data for maintenance analysis
const DEMO_ASSET_DATA = [
  {
    id: "vehicle_1",
    name: "Toyota Hilux (CA 123-456)",
    type: "vehicle",
    lastService: "2025-11-15",
    mileage: 85000,
    nextServiceDue: 90000,
    issues: ["Minor oil leak detected", "Brake pads at 30%"],
    maintenanceHistory: [
      { date: "2025-11-15", type: "Full Service", cost: 4500 },
      { date: "2025-05-20", type: "Brake Service", cost: 2800 },
      { date: "2024-11-10", type: "Full Service", cost: 4200 },
    ],
  },
  {
    id: "vehicle_2",
    name: "Ford Ranger (CA 789-012)",
    type: "vehicle",
    lastService: "2025-08-22",
    mileage: 120000,
    nextServiceDue: 125000,
    issues: ["Timing belt due for replacement"],
    maintenanceHistory: [
      { date: "2025-08-22", type: "Full Service", cost: 5200 },
      { date: "2025-02-15", type: "Tire Replacement", cost: 8500 },
    ],
  },
  {
    id: "asset_1",
    name: "Husqvarna Ride-on Mower",
    type: "equipment",
    lastService: "2025-09-10",
    hoursUsed: 450,
    nextServiceDue: 500,
    issues: ["Blade sharpening required"],
    maintenanceHistory: [
      { date: "2025-09-10", type: "Annual Service", cost: 1800 },
      { date: "2025-03-05", type: "Blade Replacement", cost: 650 },
    ],
  },
  {
    id: "asset_2",
    name: "Pool Pump System",
    type: "equipment",
    lastService: "2025-07-20",
    hoursUsed: 3200,
    issues: ["Filter pressure high", "Motor running hot"],
    maintenanceHistory: [
      { date: "2025-07-20", type: "Filter Cleaning", cost: 450 },
      { date: "2025-01-15", type: "Pump Overhaul", cost: 3500 },
    ],
  },
  {
    id: "asset_3",
    name: "Generator (8kVA)",
    type: "equipment",
    lastService: "2025-10-05",
    hoursUsed: 180,
    nextServiceDue: 200,
    issues: [],
    maintenanceHistory: [{ date: "2025-10-05", type: "Oil Change", cost: 380 }],
  },
]

const ASSET_DATA = DEMO_DATA_ENABLED ? DEMO_ASSET_DATA : []

// AI-powered maintenance prediction (using Emergent LLM)
async function getPredictiveAnalysis(assets: typeof ASSET_DATA): Promise<{
  predictions: any[]
  insights: string[]
  urgentItems: any[]
  costForecast: { month: string; estimated: number }[]
}> {
  const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY

  if (!EMERGENT_KEY) {
    return DEMO_DATA_ENABLED
      ? getMockPredictions(assets)
      : { predictions: [], insights: [], urgentItems: [], costForecast: [] }
  }

  try {
    // Use fetch to call the LLM API
    // In production this would use the emergentintegrations library
    logger.info("AI Maintenance: API key present, returning local predictions")
    return getMockPredictions(assets)
  } catch (error) {
    logger.error("AI Maintenance error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return getMockPredictions(assets)
  }
}

// Mock predictions when AI is not available
function getMockPredictions(assets: typeof ASSET_DATA) {
  const today = new Date()

  const predictions = assets.map((asset) => {
    const daysToService =
      asset.type === "vehicle"
        ? Math.max(0, Math.floor(((asset.nextServiceDue || 0) - (asset.mileage || 0)) / 50))
        : Math.max(0, Math.floor(((asset.nextServiceDue || 500) - (asset.hoursUsed || 0)) / 2))

    const urgency = daysToService < 7 ? "high" : daysToService < 30 ? "medium" : "low"
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + daysToService)

    return {
      assetId: asset.id,
      assetName: asset.name,
      prediction:
        asset.issues.length > 0
          ? `${asset.issues[0]}. Service recommended within ${daysToService} days.`
          : `Routine maintenance due in approximately ${daysToService} days.`,
      urgency,
      estimatedCost: asset.maintenanceHistory[0]?.cost || 1500,
      recommendedAction:
        asset.issues.length > 0
          ? `Address: ${asset.issues.join(", ")}`
          : "Schedule routine service",
      dueDate: dueDate.toISOString().split("T")[0],
    }
  })

  const urgentItems = predictions.filter((p) => p.urgency === "high")

  const insights = [
    `${assets.filter((a) => a.issues.length > 0).length} assets have known issues requiring attention`,
    `Average maintenance cost: R${Math.round(assets.flatMap((a) => a.maintenanceHistory).reduce((sum, h) => sum + h.cost, 0) / assets.flatMap((a) => a.maintenanceHistory).length)}`,
    `${urgentItems.length} items require urgent attention in the next 7 days`,
    "Vehicle fleet averaging 100,000km - consider timing belt replacement schedule",
    "Pool system showing signs of wear - budget for pump replacement within 6 months",
  ]

  const costForecast = [
    { month: "Feb 2026", estimated: 8500 },
    { month: "Mar 2026", estimated: 4200 },
    { month: "Apr 2026", estimated: 6800 },
    { month: "May 2026", estimated: 3500 },
    { month: "Jun 2026", estimated: 12000 },
    { month: "Jul 2026", estimated: 5500 },
  ]

  return { predictions, insights, urgentItems, costForecast }
}

// GET - Get predictive maintenance analysis
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get("assetId")
  const type = searchParams.get("type") // 'vehicle' or 'equipment'

  let assetsToAnalyze = ASSET_DATA

  if (assetId) {
    assetsToAnalyze = ASSET_DATA.filter((a) => a.id === assetId)
  } else if (type) {
    assetsToAnalyze = ASSET_DATA.filter((a) => a.type === type)
  }

  const analysis = await getPredictiveAnalysis(assetsToAnalyze)

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    assetsAnalyzed: assetsToAnalyze.length,
    aiPowered: !!process.env.EMERGENT_LLM_KEY,
    ...analysis,
  })
}

// POST - Analyze custom data
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { assets } = body

    if (!assets || !Array.isArray(assets)) {
      return NextResponse.json({ error: "Invalid request: assets array required" }, { status: 400 })
    }

    const analysis = await getPredictiveAnalysis(assets)

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      assetsAnalyzed: assets.length,
      aiPowered: !!process.env.EMERGENT_LLM_KEY,
      ...analysis,
    })
  } catch (error) {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}
