"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ExternalLink,
  Home,
  Link2,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { PublicRadarListing, RadarApiSummary } from "@/lib/services/radar-public"

interface RadarClientProps {
  initialListings: PublicRadarListing[]
  summary: RadarApiSummary
}

type WeightKey =
  | "buyIn"
  | "flipPct"
  | "dealScore"
  | "effort"
  | "landUpside"
  | "rentalYield"
  | "areaQuality"
  | "distress"
  | "daysOnMarket"
  | "holdingCost"
  | "affordability"
  | "transferFriction"
  | "physicalRisk"
  | "proximity"

type Weights = Record<WeightKey, number>

interface Filters {
  area: string
  maxPrice: number
  minErf: number
  freeholdOnly: boolean
  distressOnly: boolean
  excludeUnderOffer: boolean
}

interface RankedListing {
  listing: PublicRadarListing
  liveScore: number
}

const STORAGE_KEY = "hov-radar-controls-v1"

const DEFAULT_WEIGHTS: Weights = {
  buyIn: 9,
  flipPct: 10,
  dealScore: 8,
  effort: 7,
  landUpside: 5,
  rentalYield: 4,
  areaQuality: 5,
  distress: 5,
  daysOnMarket: 3,
  holdingCost: 4,
  affordability: 6,
  transferFriction: 4,
  physicalRisk: 8,
  proximity: 4,
}

const DEFAULT_FILTERS: Filters = {
  area: "all",
  maxPrice: 0,
  minErf: 0,
  freeholdOnly: true,
  distressOnly: false,
  excludeUnderOffer: true,
}

const PRIMARY_WEIGHTS: Array<{ key: WeightKey; label: string }> = [
  { key: "buyIn", label: "Buy-in" },
  { key: "flipPct", label: "Flip %" },
  { key: "effort", label: "Effort" },
]

const ADVANCED_WEIGHTS: Array<{ key: WeightKey; label: string }> = [
  { key: "dealScore", label: "Undervalued" },
  { key: "landUpside", label: "Land upside" },
  { key: "rentalYield", label: "Rental yield" },
  { key: "areaQuality", label: "Area quality" },
  { key: "distress", label: "Distress" },
  { key: "daysOnMarket", label: "Days listed" },
  { key: "holdingCost", label: "Holding cost" },
  { key: "affordability", label: "Affordability" },
  { key: "transferFriction", label: "Transfer friction" },
  { key: "physicalRisk", label: "Physical risk" },
  { key: "proximity", label: "Proximity" },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalise(value: number | null, min: number, max: number, invert = false): number {
  if (value === null || max <= min) return 5
  const scaled = ((clamp(value, min, max) - min) / (max - min)) * 10
  return invert ? 10 - scaled : scaled
}

function formatRand(cents: number | null): string {
  if (cents === null) return "n/a"
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

function formatPercent(value: number | null, multiplier = 100): string {
  if (value === null) return "n/a"
  return `${(value * multiplier).toFixed(1)}%`
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function parseSavedControls(): { weights: Weights; filters: Filters } | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get("state") || window.localStorage.getItem(STORAGE_KEY)
  if (!encoded) return null

  try {
    const json = encoded.startsWith("{") ? encoded : atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
    const parsed = JSON.parse(json) as { weights?: Partial<Weights>; filters?: Partial<Filters> }
    const nextWeights = { ...DEFAULT_WEIGHTS }
    const nextFilters = { ...DEFAULT_FILTERS }

    for (const key of Object.keys(nextWeights) as WeightKey[]) {
      nextWeights[key] = clamp(readNumber(parsed.weights?.[key], nextWeights[key]), 0, 10)
    }

    nextFilters.area = typeof parsed.filters?.area === "string" ? parsed.filters.area : nextFilters.area
    nextFilters.maxPrice = Math.max(0, readNumber(parsed.filters?.maxPrice, nextFilters.maxPrice))
    nextFilters.minErf = Math.max(0, readNumber(parsed.filters?.minErf, nextFilters.minErf))
    nextFilters.freeholdOnly = readBoolean(parsed.filters?.freeholdOnly, nextFilters.freeholdOnly)
    nextFilters.distressOnly = readBoolean(parsed.filters?.distressOnly, nextFilters.distressOnly)
    nextFilters.excludeUnderOffer = readBoolean(
      parsed.filters?.excludeUnderOffer,
      nextFilters.excludeUnderOffer
    )

    return { weights: nextWeights, filters: nextFilters }
  } catch {
    return null
  }
}

function encodeControls(weights: Weights, filters: Filters): string {
  const json = JSON.stringify({ weights, filters })
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function scoreListing(listing: PublicRadarListing, weights: Weights): number {
  const scores: Record<WeightKey, number> = {
    buyIn: normalise(listing.buyInCents, 500_000_00, 3_500_000_00, true),
    flipPct: normalise(listing.flipPct, 0, 0.45),
    dealScore: normalise(listing.dealScore, -10, 35),
    effort:
      listing.effort === "cosmetic"
        ? 10
        : listing.effort === "moderate"
          ? 7
          : listing.effort === "major"
            ? 4
            : 2,
    landUpside: listing.subdividePotential ? 10 : normalise(listing.erfSizeM2, 250, 1200),
    rentalYield: normalise(listing.rentalYieldGross, 0.045, 0.12),
    areaQuality: normalise(listing.areaQualityIndex, 0, 100),
    distress: listing.distressFlag && listing.distressFlag !== "none" ? 10 : 3,
    daysOnMarket: normalise(listing.daysOnMarket, 0, 120),
    holdingCost: normalise(listing.allInCents - listing.buyInCents, 0, 700_000_00, true),
    affordability: normalise(listing.priceCents, 700_000_00, 3_000_000_00, true),
    transferFriction:
      listing.transferFriction === "no-transfer-duty"
        ? 10
        : listing.transferFriction === "sectional"
          ? 2
          : 5,
    physicalRisk: listing.physicalRiskDolomite || listing.physicalRiskFlood ? 1 : 10,
    proximity: normalise(listing.proximityIndex, 0, 100),
  }

  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) return 0

  const total = (Object.keys(weights) as WeightKey[]).reduce(
    (sum, key) => sum + scores[key] * weights[key],
    0
  )
  return total / totalWeight
}

function matchesFilters(listing: PublicRadarListing, filters: Filters): boolean {
  if (filters.area !== "all" && listing.suburb !== filters.area) return false
  if (filters.maxPrice > 0 && listing.priceCents > filters.maxPrice * 100) return false
  if (filters.minErf > 0 && (listing.erfSizeM2 ?? 0) < filters.minErf) return false
  if (filters.freeholdOnly && listing.propertyType !== "freehold-house") return false
  if (filters.distressOnly && listing.distressFlag === "none") return false
  if (filters.excludeUnderOffer && listing.status !== "active") return false
  return true
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </span>
      <Slider
        value={[value]}
        min={0}
        max={10}
        step={1}
        onValueChange={(next) => onChange(next[0] ?? value)}
        aria-label={`${label} weight`}
      />
    </label>
  )
}

function FilterSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

export function RadarClient({ initialListings, summary }: RadarClientProps) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = parseSavedControls()
      if (!saved) return
      setWeights(saved.weights)
      setFilters(saved.filters)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const encoded = encodeControls(weights, filters)
    window.localStorage.setItem(STORAGE_KEY, encoded)
    const url = new URL(window.location.href)
    url.searchParams.set("state", encoded)
    window.history.replaceState(null, "", url)
  }, [weights, filters])

  const suburbs = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.suburb))].sort(),
    [initialListings]
  )

  const rankedListings = useMemo<RankedListing[]>(() => {
    return initialListings
      .filter((listing) => matchesFilters(listing, filters))
      .map((listing) => ({ listing, liveScore: scoreListing(listing, weights) }))
      .sort((a, b) => b.liveScore - a.liveScore)
  }, [filters, initialListings, weights])

  const setWeight = (key: WeightKey, value: number) => {
    setWeights((current) => ({ ...current, [key]: value }))
  }

  const setFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const resetControls = () => {
    setWeights(DEFAULT_WEIGHTS)
    setFilters(DEFAULT_FILTERS)
  }

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={summary.mode === "live" ? "default" : "outline"}>
              {summary.mode === "live" ? "Live" : titleCase(summary.mode)}
            </Badge>
            <Badge variant="secondary">{summary.count} published</Badge>
            {summary.lastSeen ? <Badge variant="outline">Seen {summary.lastSeen}</Badge> : null}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Property Deal Radar
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              Public shortlist of verified, publish-approved property opportunities with adjustable
              investment weighting.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetControls}>
            <RefreshCw className="size-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={copyShareLink}>
            <Link2 className="size-4" />
            Share
          </Button>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Weights</h2>
            </div>
            <div className="grid gap-4">
              {PRIMARY_WEIGHTS.map((weight) => (
                <WeightSlider
                  key={weight.key}
                  label={weight.label}
                  value={weights[weight.key]}
                  onChange={(value) => setWeight(weight.key, value)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-4 w-full justify-between"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              Advanced weights
              <span className="text-xs text-muted-foreground">{advancedOpen ? "Hide" : "Show"}</span>
            </Button>
            {advancedOpen ? (
              <div className="mt-4 grid gap-4 border-t pt-4">
                {ADVANCED_WEIGHTS.map((weight) => (
                  <WeightSlider
                    key={weight.key}
                    label={weight.label}
                    value={weights[weight.key]}
                    onChange={(value) => setWeight(weight.key, value)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-base font-semibold">Filters</h2>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Area</span>
                <Select value={filters.area} onValueChange={(value) => setFilter("area", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All areas</SelectItem>
                    {suburbs.map((suburb) => (
                      <SelectItem key={suburb} value={suburb}>
                        {suburb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Max price</span>
                <input
                  type="number"
                  min={0}
                  step={50_000}
                  value={filters.maxPrice || ""}
                  onChange={(event) => setFilter("maxPrice", Number(event.target.value) || 0)}
                  placeholder="No cap"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Minimum erf m2</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={filters.minErf || ""}
                  onChange={(event) => setFilter("minErf", Number(event.target.value) || 0)}
                  placeholder="Any"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </label>

              <FilterSwitch
                label="Freehold only"
                checked={filters.freeholdOnly}
                onCheckedChange={(checked) => setFilter("freeholdOnly", checked)}
              />
              <FilterSwitch
                label="Distress only"
                checked={filters.distressOnly}
                onCheckedChange={(checked) => setFilter("distressOnly", checked)}
              />
              <FilterSwitch
                label="Exclude under-offer"
                checked={filters.excludeUnderOffer}
                onCheckedChange={(checked) => setFilter("excludeUnderOffer", checked)}
              />
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{rankedListings.length} opportunities</h2>
              <p className="text-sm text-muted-foreground">
                Ranked by current weighting. Confidence is displayed but not scored.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Sources: {summary.sources.length > 0 ? summary.sources.join(", ") : "none"}
            </div>
          </div>

          {summary.mode !== "live" ? (
            <div className="rounded-lg border border-dashed p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Radar is not publishing listings</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {summary.mode === "disabled"
                      ? "RADAR_ENABLED is off or unset, so public listings remain hidden."
                      : summary.error || "No publish-approved listings are available."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {summary.mode === "live" && rankedListings.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6">
              <h3 className="font-semibold">No listings match these filters</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the area, title, price, erf, or status filters to widen the shortlist.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4">
            {rankedListings.map(({ listing, liveScore }, index) => (
              <article key={listing.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <Badge variant="outline">{listing.confidence}</Badge>
                      <Badge variant={listing.distressFlag === "none" ? "outline" : "destructive"}>
                        {titleCase(listing.distressFlag)}
                      </Badge>
                      <Badge variant="outline">{titleCase(listing.propertyType)}</Badge>
                    </div>
                    <div>
                      <h3 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                        <MapPin className="size-5 text-muted-foreground" />
                        {listing.suburb}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Last seen {listing.lastSeen || "unknown"} via {titleCase(listing.sourcePortal)}
                      </p>
                    </div>
                    <p className="max-w-3xl text-sm leading-6">
                      {listing.analystNote ||
                        `${titleCase(listing.effort)} effort ${titleCase(listing.propertyType)} with ${listing.erfSizeM2 ?? "unknown"} m2 erf and ${formatPercent(listing.flipPct)} projected flip.`}
                    </p>
                  </div>
                  <div className="grid min-w-56 gap-2 rounded-md border bg-background p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Live score</span>
                      <strong>{liveScore.toFixed(1)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Price</span>
                      <strong>{formatRand(listing.priceCents)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Buy-in</span>
                      <strong>{formatRand(listing.buyInCents)}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="size-4 text-muted-foreground" />
                    <span>
                      {listing.bedrooms ?? "n/a"} bed / {listing.bathrooms ?? "n/a"} bath
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Erf </span>
                    <span>{listing.erfSizeM2 ?? "n/a"} m2</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Deal score </span>
                    <span>{listing.dealScore === null ? "n/a" : `${listing.dealScore.toFixed(1)} pts`}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">ARV </span>
                    <span>{formatRand(listing.arvEstimateCents)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reno </span>
                    <span>{formatRand(listing.renoCostEstimateCents)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Yield </span>
                    <span>{formatPercent(listing.rentalYieldGross)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Status </span>
                    <span>{titleCase(listing.status)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Risk </span>
                    <span>
                      {listing.physicalRiskDolomite || listing.physicalRiskFlood
                        ? "Physical review"
                        : "No physical flag"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button asChild variant="outline">
                    <a href={listing.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Source listing
                    </a>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
