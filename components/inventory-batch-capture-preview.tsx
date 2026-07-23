"use client"

import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import { AlertCircle, Camera, CheckCircle2, Images, Sparkles, Upload } from "lucide-react"
import { useState } from "react"

const CATEGORIES = [
  "workshop_consumables",
  "building_materials",
  "fuel",
  "garden_supplies",
  "cleaning_supplies",
  "household",
  "other",
] as const

const LOCATIONS = ["Workshop Store", "Tool Wall", "Fuel Store", "Yard", "Container", "House"]

interface DraftItem {
  id: string
  uploadId: string
  photoUrl: string
  label: string
  category: string
  location: string
  confidence: number | null
  imageBounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface UploadResult {
  file: {
    id: string
    url: string
    originalName?: string
    mimeType?: string
  }
}

export function InventoryBatchCapturePreview({ defaultLocation = "House" }: { defaultLocation?: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [status, setStatus] = useState<{ type: "idle" | "busy" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  })

  async function identifyBatch() {
    if (files.length === 0) {
      setStatus({ type: "error", message: "Choose photos first." })
      return
    }

    setStatus({ type: "busy", message: "Uploading preview batch..." })
    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("category", "image")
          formData.append("resourceType", "inventory")
          const uploaded = await apiFetch<UploadResult>("/api/uploads", {
            method: "POST",
            body: formData,
            label: "InventoryBatchUpload",
          })
          return {
            uploadId: uploaded.file.id,
            photoUrl: uploaded.file.url,
            originalName: uploaded.file.originalName || file.name,
            mimeType: uploaded.file.mimeType || file.type,
          }
        })
      )

      setStatus({ type: "busy", message: "Preparing preview suggestions..." })
      const identified = await apiFetch<{
        suggestions?: Array<{
          id?: string
          uploadId: string
          photoUrl: string
          label: string
          category: string
          location?: string
          confidence: number | null
          imageBounds?: DraftItem["imageBounds"]
        }>
      }>("/api/inventory/batch-identify", {
        method: "POST",
        body: { images: uploads },
        label: "InventoryBatchIdentify",
      })

      setDrafts(
        (identified.suggestions || []).map((item) => ({
          id: item.id || `${item.uploadId}-${globalThis.crypto.randomUUID()}`,
          uploadId: item.uploadId,
          photoUrl: item.photoUrl,
          label: item.label,
          category: CATEGORIES.includes(item.category as (typeof CATEGORIES)[number])
            ? item.category
            : "other",
          location: item.location || defaultLocation,
          confidence: item.confidence,
          imageBounds: item.imageBounds,
        }))
      )
      setStatus({ type: "success", message: "Preview ready. Review before saving." })
    } catch (error) {
      logger.error("Inventory batch preview failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      setStatus({ type: "error", message: "Could not prepare preview." })
    }
  }

  async function saveDrafts() {
    if (drafts.length === 0) return
    setStatus({ type: "busy", message: "Saving corrected items..." })

    try {
      for (const draft of drafts) {
        const label = draft.label.trim()
        if (!label) continue
        await apiFetch("/api/inventory", {
          method: "POST",
          body: {
            name: label,
            label,
            category: draft.category,
            unit: "units",
            currentStock: 1,
            minStock: 1,
            maxStock: 1,
            reorderPoint: 1,
            location: draft.location,
            unitCost: 0,
            photoUrl: draft.photoUrl,
            photoFileId: draft.uploadId,
            imageBounds: draft.imageBounds,
          },
          label: "InventoryBatchSave",
        })
      }
      setFiles([])
      setDrafts([])
      setStatus({ type: "success", message: "Corrected batch saved." })
    } catch (error) {
      logger.error("Inventory batch save failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      setStatus({ type: "error", message: "Could not save every item." })
    }
  }

  return (
    <section className="rounded-xl border border-cyan-500/25 bg-cyan-950/30 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Images className="h-5 w-5 text-cyan-200" />
          <div>
            <h2 className="font-semibold text-cyan-100">Batch Capture</h2>
            <p className="text-sm text-cyan-100/55">Preview only. AI suggestions require review.</p>
          </div>
        </div>
        <span className="rounded-full border border-cyan-300/30 px-2 py-1 text-xs font-semibold uppercase text-cyan-100">
          Preview
        </span>
      </div>

      <div className="grid gap-3">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-cyan-300/30 bg-black/20 p-4 text-center text-cyan-100/65">
          <Upload className="mb-2 h-7 w-7" />
          Choose photos
          <input
            type="file"
            multiple
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 20))}
          />
        </label>

        {files.length > 0 && <p className="text-sm text-cyan-100/65">{files.length} photo(s) selected</p>}

        <button
          type="button"
          onClick={identifyBatch}
          disabled={status.type === "busy"}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500 px-4 text-sm font-semibold text-black disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          Prepare Preview
        </button>

        {drafts.length > 0 && (
          <div className="grid gap-3">
            {drafts.map((draft, index) => (
              <article key={draft.id} className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-[96px_1fr]">
                <div className="relative h-24 w-full overflow-hidden rounded-md sm:w-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.photoUrl} alt="" className="h-full w-full object-cover" />
                  {draft.imageBounds && (
                    <span
                      className="absolute border-2 border-cyan-300 bg-cyan-300/10"
                      style={{
                        left: `${draft.imageBounds.x * 100}%`,
                        top: `${draft.imageBounds.y * 100}%`,
                        width: `${draft.imageBounds.width * 100}%`,
                        height: `${draft.imageBounds.height * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="grid gap-2">
                  <input
                    value={draft.label}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, label: event.target.value } : item
                        )
                      )
                    }
                    className="h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-white"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={draft.category}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, category: event.target.value } : item
                          )
                        )
                      }
                      className="h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-white"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category} className="bg-zinc-950">
                          {category.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.location}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, location: event.target.value } : item
                          )
                        )
                      }
                      className="h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-white"
                    >
                      {LOCATIONS.map((location) => (
                        <option key={location} value={location} className="bg-zinc-950">
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>
            ))}
            <button
              type="button"
              onClick={saveDrafts}
              disabled={status.type === "busy"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-500 px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              Save Corrected Batch
            </button>
          </div>
        )}

        {status.message && (
          <p
            className={`flex items-center gap-2 text-sm ${
              status.type === "error" ? "text-red-300" : "text-emerald-300"
            }`}
            role={status.type === "error" ? "alert" : "status"}
          >
            {status.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {status.message}
          </p>
        )}
      </div>
    </section>
  )
}
