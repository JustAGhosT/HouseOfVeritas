import { NextResponse } from "next/server"
import { getPublicRadarListings } from "@/lib/services/radar-public"

export const revalidate = 3600

export async function GET() {
  const result = await getPublicRadarListings()
  const headers = new Headers()
  headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=300")

  return NextResponse.json(result, { headers })
}
