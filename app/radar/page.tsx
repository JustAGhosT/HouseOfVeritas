import { RadarClient } from "@/components/radar/radar-client"
import { getPublicRadarListings } from "@/lib/services/radar-public"

// Keep the page's read-time kill switch aligned with the API route.
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function RadarPage() {
  const { data, summary } = await getPublicRadarListings()

  return (
    <main className="bg-background text-foreground min-h-screen">
      <RadarClient initialListings={data} summary={summary} />
    </main>
  )
}
