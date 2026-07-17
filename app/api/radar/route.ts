import { NextResponse } from "next/server"
import { getPublicRadarListings } from "@/lib/services/radar-public"

// The kill switch is evaluated on every request. Do not cache a live response,
// otherwise disabling RADAR_ENABLED could leave public listings visible.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const result = await getPublicRadarListings()
  const headers = new Headers()
  headers.set("Cache-Control", "no-store, max-age=0, must-revalidate")

  return NextResponse.json(result, { headers })
}
