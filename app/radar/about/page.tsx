import Link from "next/link"

const TAKEDOWN_EMAIL = "sales@houseofv.com"

export default function RadarAboutPage() {
  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link href="/radar" className="text-sm underline underline-offset-4">
            ← Back to Property Deal Radar
          </Link>
          <h1 className="text-3xl font-semibold">Property Deal Radar: sources and safeguards</h1>
          <p className="text-muted-foreground">
            Radar presents property facts and links to the authoritative source listing. It does not
            reproduce listing descriptions or photos.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Sources, freshness, and confidence</h2>
          <p>
            Listings draw structured facts such as price, beds, baths, erf size, suburb, property
            type, and source URL from source portals. Each card identifies its portal, link,
            last-seen date, and confidence. The original source listing is authoritative because
            prices and availability can change.
          </p>
          <p>
            <strong>Verified</strong> means the source detail page was opened and parsed in the
            current run. <strong>Feed</strong> means fact-only data was not opened in the current
            run. <strong>Estimate</strong> identifies a derived value. Confidence does not change
            the score, but only verified listings can occupy the top rank.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Important disclaimers</h2>
          <p>
            <strong>Not financial advice.</strong> Radar is an information and research tool. Its
            scores, rankings, and estimates are directional signals rather than a recommendation to
            buy, sell, or invest. Do your own due diligence and seek qualified professional advice
            before making a property decision.
          </p>
          <p>
            <strong>Physical-risk flags are indicative, not a survey.</strong> Flood and dolomite
            indicators are area-level heuristics, not an engineering, geotechnical, or
            property-specific guarantee. Obtain a professional survey before relying on them.
          </p>
          <p>
            ARV, flip percentage, renovation cost, and similar measures are estimates derived from
            public facts, not appraisals.
          </p>
        </section>

        <section className="rounded-lg border p-5">
          <h2 className="text-xl font-semibold">Takedowns and corrections</h2>
          <p className="mt-2">
            Listing sources, agents, owners, and other affected parties may ask us to correct or
            remove a Radar row. We review reasonable requests promptly and can disable the public
            Radar feature immediately when needed.
          </p>
          <a
            className="mt-4 inline-block font-medium underline underline-offset-4"
            href={`mailto:${TAKEDOWN_EMAIL}?subject=Property%20Deal%20Radar%20takedown%20or%20correction`}
          >
            Report / request takedown
          </a>
        </section>
      </article>
    </main>
  )
}
