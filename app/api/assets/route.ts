import { NextResponse } from "next/server"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { withDataSource } from "@/lib/api/response"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const location = searchParams.get("location")

  try {
    const assets = await getEstateRepository().assets.list({
      type: type || undefined,
      location: location || undefined,
    })

    const summary = {
      total: assets.length,
      byType: {
        tool: assets.filter((a) => a.type === "Tool").length,
        vehicle: assets.filter((a) => a.type === "Vehicle").length,
        equipment: assets.filter((a) => a.type === "Equipment").length,
        household: assets.filter((a) => a.type === "Household").length,
      },
      checkedOut: assets.filter((a) => a.checkedOutBy).length,
      available: assets.filter((a) => !a.checkedOutBy).length,
      byCondition: {
        excellent: assets.filter((a) => a.condition === "Excellent").length,
        good: assets.filter((a) => a.condition === "Good").length,
        fair: assets.filter((a) => a.condition === "Fair").length,
        poor: assets.filter((a) => a.condition === "Poor").length,
      },
    }

    return withDataSource({ assets, summary })
  } catch (error) {
    logger.error("Error fetching assets", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 })
  }
}
