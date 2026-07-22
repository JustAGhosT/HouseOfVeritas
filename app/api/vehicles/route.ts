import { NextResponse } from "next/server"
import { isBaserowConfigured } from "@/lib/services/baserow"

export async function GET() {
  const configured = isBaserowConfigured()

  return NextResponse.json({
    status: "coming_soon",
    configured,
    dataSource: configured ? "live" : process.env.ALLOW_DEMO_DATA === "true" ? "demo" : "empty",
    logs: [],
    summary: {
      total: 0,
      activeTrips: 0,
      completedTrips: 0,
      totalDistance: 0,
      totalFuelCost: 0,
    },
    message: "Vehicle logging is coming soon and is not active yet.",
  }, { status: 501 })
}
