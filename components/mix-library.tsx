"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Loader2, Palette, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"

/**
 * The estate's mix library and its colour chart.
 *
 * A saved mix is what makes a batch reproducible; the cast samples hanging off
 * it are what make the colour predictable, because a dosage number cannot tell
 * anyone what a stone looks like against their own sand and cement.
 *
 * Options come from GET /api/concrete-mix so nothing here hard-codes a mix
 * design, cast method or colour.
 */

interface Option {
  id: string
  label: string
}

interface LibraryOptions {
  mixDesigns: Option[]
  castMethods: Option[]
  colorIntensities: Array<Option & { dosagePercent: number }>
}

interface Sample {
  id: string
  photoUrl: string
  observedShade?: string
  cureAgeDays?: number
  capturedAt: string
}

interface SavedMix {
  id: string
  name: string
  description?: string
  mixDesignId: string
  castMethodId: string
  pigmentDosagePercent: number
  cementType: string
  pigmentProduct?: string
  samples: Sample[]
}

const EMPTY_FORM = {
  name: "",
  description: "",
  mixDesignId: "garden-stone",
  castMethodId: "wet",
  pigmentDosagePercent: "5",
  cementType: "grey",
  pigmentProduct: "",
}

export function MixLibrary({ canDelete }: { canDelete: boolean }) {
  const [options, setOptions] = useState<LibraryOptions | null>(null)
  const [mixes, setMixes] = useState<SavedMix[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [shade, setShade] = useState("")
  const [cureAgeDays, setCureAgeDays] = useState("28")
  const [error, setError] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const loadMixes = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: SavedMix[] }>("/api/concrete-mix/mixes", {
        label: "MixLibrary",
      })
      setMixes(response.data ?? [])
    } catch (loadError) {
      logger.error("Failed to load saved mixes", {
        error: loadError instanceof Error ? loadError.message : String(loadError),
      })
      setError("Could not load the mix library.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await apiFetch<{ data: LibraryOptions }>("/api/concrete-mix", {
          label: "MixLibraryOptions",
        })
        setOptions(response.data)
      } catch (loadError) {
        logger.error("Failed to load mix options", {
          error: loadError instanceof Error ? loadError.message : String(loadError),
        })
      }
    }
    loadOptions()
    loadMixes()
  }, [loadMixes])

  const createMix = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      await apiFetch("/api/concrete-mix/mixes", {
        method: "POST",
        body: {
          name: form.name,
          description: form.description || undefined,
          mixDesignId: form.mixDesignId,
          castMethodId: form.castMethodId,
          pigmentDosagePercent: Number(form.pigmentDosagePercent),
          cementType: form.cementType,
          pigmentProduct: form.pigmentProduct || undefined,
        },
        label: "CreateMix",
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await loadMixes()
    } catch (createError) {
      logger.error("Failed to save mix", {
        error: createError instanceof Error ? createError.message : String(createError),
      })
      setError("Could not save that mix. A mix with the same name may already exist.")
    } finally {
      setCreating(false)
    }
  }, [form, loadMixes])

  const deleteMix = useCallback(
    async (mixId: string) => {
      try {
        await apiFetch(`/api/concrete-mix/mixes/${mixId}`, {
          method: "DELETE",
          label: "DeleteMix",
        })
        await loadMixes()
      } catch (deleteError) {
        logger.error("Failed to delete mix", {
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
        })
        setError("Could not delete that mix.")
      }
    },
    [loadMixes]
  )

  /** Uploads the photo first, then records it against the mix. */
  const addSample = useCallback(
    async (mixId: string, file: File) => {
      setUploadingFor(mixId)
      setError(null)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("category", "image")
        formData.append("resourceType", "concrete-mix")
        formData.append("resourceId", mixId)

        const upload = await apiFetch<{ file: { id: string; url: string } }>("/api/uploads", {
          method: "POST",
          body: formData,
          label: "MixSampleUpload",
        })

        await apiFetch(`/api/concrete-mix/mixes/${mixId}/samples`, {
          method: "POST",
          body: {
            photoUrl: upload.file.url,
            observedShade: shade || undefined,
            cureAgeDays: cureAgeDays ? Number(cureAgeDays) : undefined,
          },
          label: "AddMixSample",
        })

        setShade("")
        await loadMixes()
      } catch (sampleError) {
        logger.error("Failed to add cast sample", {
          error: sampleError instanceof Error ? sampleError.message : String(sampleError),
        })
        setError("Could not attach that photo.")
      } finally {
        setUploadingFor(null)
      }
    },
    [shade, cureAgeDays, loadMixes]
  )

  const removeSample = useCallback(
    async (mixId: string, sampleId: string) => {
      try {
        await apiFetch(`/api/concrete-mix/mixes/${mixId}/samples?sampleId=${sampleId}`, {
          method: "DELETE",
          label: "RemoveMixSample",
        })
        await loadMixes()
      } catch (removeError) {
        logger.error("Failed to remove cast sample", {
          error: removeError instanceof Error ? removeError.message : String(removeError),
        })
        setError("Could not remove that sample.")
      }
    },
    [loadMixes]
  )

  const selectClass = "w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-white"

  return (
    <Card className="border-white/10 bg-white/5" data-testid="mix-library">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Palette className="h-5 w-5" />
          Mix library
        </CardTitle>
        <CardDescription className="text-white/60">
          Named mixes the estate can reproduce, and photos of the stones they actually made.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="text-red-400" data-testid="mix-library-error">
            {error}
          </p>
        ) : null}

        <Button
          variant="outline"
          onClick={() => setShowForm((open) => !open)}
          data-testid="mix-library-toggle-form"
        >
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancel" : "Save a new mix"}
        </Button>

        {showForm ? (
          <div className="grid gap-4 rounded-lg border border-white/10 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mix-name" className="text-white/80">
                Name
              </Label>
              <Input
                id="mix-name"
                data-testid="mix-name"
                value={form.name}
                placeholder="Our terracotta"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="border-white/10 bg-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mix-product" className="text-white/80">
                Pigment product
              </Label>
              <Input
                id="mix-product"
                data-testid="mix-product"
                value={form.pigmentProduct}
                placeholder="Powafix Cement Colour - Terracotta"
                onChange={(event) => setForm({ ...form, pigmentProduct: event.target.value })}
                className="border-white/10 bg-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mix-design" className="text-white/80">
                Mix design
              </Label>
              <select
                id="mix-design"
                data-testid="mix-design"
                value={form.mixDesignId}
                onChange={(event) => setForm({ ...form, mixDesignId: event.target.value })}
                className={selectClass}
              >
                {options?.mixDesigns.map((design) => (
                  <option key={design.id} value={design.id} className="text-black">
                    {design.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mix-cast" className="text-white/80">
                Cast method
              </Label>
              <select
                id="mix-cast"
                data-testid="mix-cast"
                value={form.castMethodId}
                onChange={(event) => setForm({ ...form, castMethodId: event.target.value })}
                className={selectClass}
              >
                {options?.castMethods.map((method) => (
                  <option key={method.id} value={method.id} className="text-black">
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mix-dosage" className="text-white/80">
                Pigment (% of cement mass)
              </Label>
              <Input
                id="mix-dosage"
                data-testid="mix-dosage"
                type="number"
                step="0.5"
                min="0"
                max="15"
                value={form.pigmentDosagePercent}
                onChange={(event) => setForm({ ...form, pigmentDosagePercent: event.target.value })}
                className="border-white/10 bg-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mix-cement" className="text-white/80">
                Cement
              </Label>
              <select
                id="mix-cement"
                data-testid="mix-cement"
                value={form.cementType}
                onChange={(event) => setForm({ ...form, cementType: event.target.value })}
                className={selectClass}
              >
                <option value="grey" className="text-black">
                  Grey
                </option>
                <option value="white" className="text-black">
                  White (for pale and bright colors)
                </option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <Button onClick={createMix} disabled={!form.name || creating} data-testid="mix-save">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save mix
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sample-shade" className="text-white/80">
              Shade to record with the next photo
            </Label>
            <Input
              id="sample-shade"
              data-testid="sample-shade"
              value={shade}
              placeholder="Deep rust, slightly mottled"
              onChange={(event) => setShade(event.target.value)}
              className="border-white/10 bg-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-age" className="text-white/80">
              Days since it was cast
            </Label>
            <Input
              id="sample-age"
              data-testid="sample-age"
              type="number"
              min="0"
              value={cureAgeDays}
              onChange={(event) => setCureAgeDays(event.target.value)}
              className="border-white/10 bg-white/10 text-white"
            />
            <p className="text-xs text-white/50">
              Colour lightens as concrete dries, so a photo without an age says little.
            </p>
          </div>
        </div>

        {loading ? <p className="text-white/60">Loading…</p> : null}

        {!loading && mixes.length === 0 ? (
          <p className="text-white/60" data-testid="mix-library-empty">
            No saved mixes yet. Save one so the next batch matches this one.
          </p>
        ) : null}

        <div className="space-y-4" data-testid="mix-library-list">
          {mixes.map((mix) => (
            <div key={mix.id} className="rounded-lg border border-white/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{mix.name}</p>
                  <p className="text-sm text-white/60">
                    {mix.pigmentDosagePercent}% pigment · {mix.cementType} cement
                    {mix.pigmentProduct ? ` · ${mix.pigmentProduct}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{mix.samples.length} samples</Badge>
                  <input
                    ref={(element) => {
                      fileInputs.current[mix.id] = element
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    data-testid={`sample-input-${mix.id}`}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) addSample(mix.id, file)
                      event.target.value = ""
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploadingFor === mix.id}
                    onClick={() => fileInputs.current[mix.id]?.click()}
                    data-testid={`add-sample-${mix.id}`}
                  >
                    {uploadingFor === mix.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    Add sample
                  </Button>
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMix(mix.id)}
                      data-testid={`delete-mix-${mix.id}`}
                      aria-label={`Delete ${mix.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              {mix.samples.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {mix.samples.map((sample) => (
                    <figure key={sample.id} className="w-32">
                      <Image
                        src={sample.photoUrl}
                        alt={sample.observedShade ?? `Cast sample of ${mix.name}`}
                        width={128}
                        height={128}
                        className="h-32 w-32 rounded-md object-cover"
                        unoptimized
                      />
                      <figcaption className="mt-1 text-xs text-white/60">
                        {sample.observedShade ?? "No shade noted"}
                        {sample.cureAgeDays !== undefined ? ` · day ${sample.cureAgeDays}` : ""}
                      </figcaption>
                      <button
                        type="button"
                        className="mt-1 text-xs text-red-300 underline"
                        onClick={() => removeSample(mix.id, sample.id)}
                      >
                        Remove
                      </button>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
