"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Info,
  Layers,
  Loader2,
  ShoppingCart,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MixLibrary } from "@/components/mix-library"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"

/**
 * Casting planner.
 *
 * Every option comes from GET /api/concrete-mix, so the picker never hard-codes
 * a mix design, a colour or a limit. Quantities are always recalculated on the
 * server; nothing here does arithmetic that the bill of materials depends on.
 */

interface Option {
  id: string
  label: string
}

interface PlannerOptions {
  slabPresets: Array<Option & { defaultMixDesign: string }>
  mixDesigns: Option[]
  castMethods: Option[]
  colorIntensities: Array<Option & { dosagePercent: number; description: string }>
  defaults: {
    mixDesignId: string
    castMethodId: string
    colorIntensityId: string
    wastePercent: number
  }
}

interface SavedMix {
  id: string
  name: string
  pigmentDosagePercent: number
}

interface MaterialLine {
  material: string
  label: string
  requiredQuantity: number
  requiredUnit: string
  purchaseQuantity: number
  purchaseUnit: string
}

interface ResolvedMaterial {
  material: string
  label: string
  stockInPurchaseUnits: number | null
  shortfallQuantity: number | null
  estimatedCostCents: number | null
  item: { name: string; location: string } | null
}

interface ShoppingLine {
  material: string
  label: string
  quantity: number
  unit: string
  reason: string
  estimatedCostCents: number | null
  searchUrl: string | null
}

interface PlanResponse {
  data: {
    batch: { slabCount: number; mixedVolumeM3: number }
    coverage: { coveredAreaM2: number } | null
    pigment: { gramsPerSlab: number; totalKg: number; purchaseKg: number }
    mixerPlan: {
      loadCount: number
      fullLoad: { cementKg: number; sandKg: number; waterLitres: number; pigmentGrams: number }
    } | null
    materials: MaterialLine[]
    warnings: string[]
    notes: string[]
  }
  inventory: { materials: ResolvedMaterial[]; fullyStocked: boolean } | null
  shoppingList: { lines: ShoppingLine[]; totalEstimatedCostCents: number | null } | null
  summary: { estimatedCostCents: number | null; cementBags: number }
}

interface Project {
  id: string
  name: string
}

function formatRands(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—"
  return `R${(cents / 100).toFixed(2)}`
}

export function CastingPlanner({ persona }: { persona: "hans" | "lucky" | "charl" }) {
  const [options, setOptions] = useState<PlannerOptions | null>(null)
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [savedMixId, setSavedMixId] = useState("")
  const [presetId, setPresetId] = useState("square-400")
  const [mode, setMode] = useState<"count" | "area">("count")
  const [slabCount, setSlabCount] = useState("50")
  const [areaM2, setAreaM2] = useState("12")
  const [colorIntensityId, setColorIntensityId] = useState("medium")
  const [castMethodId, setCastMethodId] = useState("wet")
  const [mixerCapacityM3, setMixerCapacityM3] = useState("0.15")
  const [projectId, setProjectId] = useState("")

  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [optionData, mixData, projectData] = await Promise.all([
          apiFetch<{ data: PlannerOptions }>("/api/concrete-mix", { label: "CastingOptions" }),
          apiFetch<{ data: SavedMix[] }>("/api/concrete-mix/mixes", { label: "SavedMixes" }).catch(
            () => ({ data: [] as SavedMix[] })
          ),
          apiFetch<{ projects?: Project[] }>("/api/projects", { label: "Projects" }).catch(() => ({
            projects: [] as Project[],
          })),
        ])
        setOptions(optionData.data)
        setSavedMixes(mixData.data ?? [])
        setProjects(projectData.projects ?? [])
        setColorIntensityId(optionData.data.defaults.colorIntensityId)
        setCastMethodId(optionData.data.defaults.castMethodId)
      } catch (loadError) {
        logger.error("Failed to load casting planner options", {
          error: loadError instanceof Error ? loadError.message : String(loadError),
        })
        setError("Could not load the mix options.")
      }
    }
    loadReferenceData()
  }, [])

  /** The batch request. Every action re-sends this so the server recomputes. */
  const batchBody = useMemo(() => {
    const body: Record<string, unknown> = { presetId, castMethodId }
    if (savedMixId) body.savedMixId = savedMixId
    else body.colorIntensityId = colorIntensityId
    if (mode === "area") body.coverage = { areaM2: Number(areaM2) }
    else body.slabCount = Number(slabCount)
    const capacity = Number(mixerCapacityM3)
    if (capacity > 0) body.mixerCapacityM3 = capacity
    return body
  }, [
    presetId,
    castMethodId,
    savedMixId,
    colorIntensityId,
    mode,
    areaM2,
    slabCount,
    mixerCapacityM3,
  ])

  const calculate = useCallback(async () => {
    setCalculating(true)
    setError(null)
    setActionMessage(null)
    try {
      const response = await apiFetch<PlanResponse>("/api/concrete-mix", {
        method: "POST",
        body: { ...batchBody, useInventory: true, store: "cashbuild" },
        label: "CastingPlan",
      })
      setPlan(response)
    } catch (planError) {
      logger.error("Casting calculation failed", {
        error: planError instanceof Error ? planError.message : String(planError),
      })
      setError("That batch could not be calculated. Check the numbers and try again.")
      setPlan(null)
    } finally {
      setCalculating(false)
    }
  }, [batchBody])

  const bookToJob = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await apiFetch<{
        summary: { allocationCount: number; projectName: string }
      }>("/api/concrete-mix/allocate", {
        method: "POST",
        body: { ...batchBody, projectId },
        label: "CastingAllocate",
      })
      setActionMessage(
        `Booked ${response.summary.allocationCount} material lines to ${response.summary.projectName}.`
      )
    } catch (bookError) {
      logger.error("Failed to book casting batch to job", {
        error: bookError instanceof Error ? bookError.message : String(bookError),
      })
      setError("Could not book this batch to the job.")
    }
  }, [batchBody, projectId])

  const recordCast = useCallback(async () => {
    try {
      const response = await apiFetch<{ summary: { itemsConsumed: number } }>(
        "/api/concrete-mix/consume",
        { method: "POST", body: batchBody, label: "CastingConsume" }
      )
      setActionMessage(`Drew ${response.summary.itemsConsumed} materials out of stock.`)
      calculate()
    } catch (castError) {
      logger.error("Failed to record cast", {
        error: castError instanceof Error ? castError.message : String(castError),
      })
      setError("Could not draw this batch from stock. Something is short or unmatched.")
    }
  }, [batchBody, calculate])

  const accent =
    persona === "lucky"
      ? "text-green-400"
      : persona === "charl"
        ? "text-amber-400"
        : "text-blue-400"
  const stockFor = (material: string): ResolvedMaterial | undefined =>
    plan?.inventory?.materials.find((entry) => entry.material === material)

  return (
    <div className="relative z-10 space-y-6" data-testid="casting-planner">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
          <Layers className={`h-8 w-8 ${accent}`} />
          Casting Planner
        </h1>
        <p className="mt-1 text-white/60">
          Work out the mix, the pigment and what is short before you start.
        </p>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Batch</CardTitle>
          <CardDescription className="text-white/60">
            Give a stone count or the area you are paving.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="preset" className="text-white/80">
              Stone size
            </Label>
            <select
              id="preset"
              data-testid="casting-preset"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-white"
            >
              {options?.slabPresets.map((preset) => (
                <option key={preset.id} value={preset.id} className="text-black">
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">How much</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "count" ? "default" : "outline"}
                onClick={() => setMode("count")}
                data-testid="casting-mode-count"
              >
                Stones
              </Button>
              <Button
                type="button"
                variant={mode === "area" ? "default" : "outline"}
                onClick={() => setMode("area")}
                data-testid="casting-mode-area"
              >
                Area
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-white/80">
              {mode === "count" ? "Number of stones" : "Area to pave (m2)"}
            </Label>
            <Input
              id="quantity"
              data-testid="casting-quantity"
              type="number"
              min="1"
              value={mode === "count" ? slabCount : areaM2}
              onChange={(event) =>
                mode === "count" ? setSlabCount(event.target.value) : setAreaM2(event.target.value)
              }
              className="border-white/10 bg-white/10 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="saved-mix" className="text-white/80">
              Saved mix
            </Label>
            <select
              id="saved-mix"
              data-testid="casting-saved-mix"
              value={savedMixId}
              onChange={(event) => setSavedMixId(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-white"
            >
              <option value="" className="text-black">
                None, choose a colour below
              </option>
              {savedMixes.map((mix) => (
                <option key={mix.id} value={mix.id} className="text-black">
                  {mix.name} ({mix.pigmentDosagePercent}%)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="intensity" className="text-white/80">
              Colour depth
            </Label>
            <select
              id="intensity"
              data-testid="casting-intensity"
              value={colorIntensityId}
              disabled={Boolean(savedMixId)}
              onChange={(event) => setColorIntensityId(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-white disabled:opacity-40"
            >
              {options?.colorIntensities.map((intensity) => (
                <option key={intensity.id} value={intensity.id} className="text-black">
                  {intensity.label} — {intensity.dosagePercent}% of cement
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mixer" className="text-white/80">
              Mixer drum (m3)
            </Label>
            <Input
              id="mixer"
              data-testid="casting-mixer"
              type="number"
              step="0.01"
              min="0"
              value={mixerCapacityM3}
              onChange={(event) => setMixerCapacityM3(event.target.value)}
              className="border-white/10 bg-white/10 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={calculate} disabled={calculating} data-testid="casting-calculate">
        {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Work out the batch
      </Button>

      {error ? (
        <p className="text-red-400" data-testid="casting-error">
          {error}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="text-green-400" data-testid="casting-action-message">
          {actionMessage}
        </p>
      ) : null}

      {plan ? (
        <div className="space-y-6" data-testid="casting-results">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/60">Pigment per stone</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white" data-testid="casting-pigment-per-slab">
                  {plan.data.pigment.gramsPerSlab} g
                </p>
                <p className="text-sm text-white/60">
                  {plan.data.pigment.purchaseKg} kg to buy for {plan.data.batch.slabCount} stones
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/60">Cement</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{plan.summary.cementBags} bags</p>
                <p className="text-sm text-white/60">{plan.data.batch.mixedVolumeM3} m3 mixed</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-2">
                <CardDescription className="text-white/60">Estimated cost</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white" data-testid="casting-cost">
                  {formatRands(plan.summary.estimatedCostCents)}
                </p>
                <p className="text-sm text-white/60">
                  {plan.inventory?.fullyStocked ? "All in stock" : "Some materials short"}
                </p>
              </CardContent>
            </Card>
          </div>

          {plan.data.warnings.length > 0 ? (
            <Card className="border-amber-500/40 bg-amber-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-200">
                  <AlertTriangle className="h-5 w-5" />
                  Check before you mix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2" data-testid="casting-warnings">
                  {plan.data.warnings.map((warning) => (
                    <li key={warning} className="text-amber-100/90">
                      {warning}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Boxes className="h-5 w-5" />
                Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/80">
                <thead className="text-white/50">
                  <tr>
                    <th className="pb-2">Material</th>
                    <th className="pb-2">Needed</th>
                    <th className="pb-2">Buy</th>
                    <th className="pb-2">In stock</th>
                    <th className="pb-2">Short</th>
                  </tr>
                </thead>
                <tbody data-testid="casting-materials">
                  {plan.data.materials.map((line) => {
                    const stock = stockFor(line.material)
                    return (
                      <tr key={line.material} className="border-t border-white/10">
                        <td className="py-2">{line.label}</td>
                        <td className="py-2">
                          {line.requiredQuantity} {line.requiredUnit}
                        </td>
                        <td className="py-2">
                          {line.purchaseQuantity} {line.purchaseUnit}
                        </td>
                        <td className="py-2">
                          {stock?.stockInPurchaseUnits ?? (line.material === "water" ? "—" : "?")}
                        </td>
                        <td className="py-2">
                          {stock?.shortfallQuantity ? (
                            <Badge variant="destructive">{stock.shortfallQuantity}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {plan.data.mixerPlan ? (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">
                  Per mixer load ({plan.data.mixerPlan.loadCount} loads)
                </CardTitle>
                <CardDescription className="text-white/60">
                  Weigh the pigment for every load. This is where colour consistency is won or lost.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-white sm:grid-cols-4">
                <div>
                  <p className="text-sm text-white/60">Cement</p>
                  <p className="text-xl font-semibold">
                    {plan.data.mixerPlan.fullLoad.cementKg} kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Sand</p>
                  <p className="text-xl font-semibold">{plan.data.mixerPlan.fullLoad.sandKg} kg</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Water</p>
                  <p className="text-xl font-semibold">
                    {plan.data.mixerPlan.fullLoad.waterLitres} L
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Pigment</p>
                  <p className="text-xl font-semibold" data-testid="casting-load-pigment">
                    {plan.data.mixerPlan.fullLoad.pigmentGrams} g
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {plan.shoppingList && plan.shoppingList.lines.length > 0 ? (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ShoppingCart className="h-5 w-5" />
                  Still to buy — {formatRands(plan.shoppingList.totalEstimatedCostCents)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2" data-testid="casting-shopping-list">
                  {plan.shoppingList.lines.map((line) => (
                    <li
                      key={line.material}
                      className="flex flex-wrap items-center gap-2 text-white/80"
                    >
                      <span>
                        {line.quantity} {line.unit} {line.label}
                      </span>
                      {line.reason === "not-stocked" ? (
                        <Badge variant="outline">not in the store</Badge>
                      ) : null}
                      {line.searchUrl ? (
                        <a
                          className="text-blue-300 underline"
                          href={line.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          find it
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ClipboardCheck className="h-5 w-5" />
                Book it
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="project" className="text-white/80">
                  Job
                </Label>
                <select
                  id="project"
                  data-testid="casting-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-white"
                >
                  <option value="" className="text-black">
                    Choose a job
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} className="text-black">
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={bookToJob} disabled={!projectId} data-testid="casting-book">
                Book materials to job
              </Button>
              <Button variant="outline" onClick={recordCast} data-testid="casting-record">
                Record the cast and draw stock
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Info className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-white/70" data-testid="casting-notes">
                {plan.data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <MixLibrary canDelete={persona !== "lucky"} />
    </div>
  )
}
