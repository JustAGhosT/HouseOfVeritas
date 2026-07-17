import { RadarClient } from "@/components/radar/radar-client"
import { getPublicRadarListings } from "@/lib/services/radar-public"

export const revalidate = 3600

export default async function RadarPage() {
  const { data, summary } = await getPublicRadarListings()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <RadarClient initialListings={data} summary={summary} />
    </main>
  )
}
