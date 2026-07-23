"use client"

import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { logger } from "@/lib/logger"
import { AlertCircle, Camera, CheckCircle2, Tag, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const INVENTORY_CATEGORIES = [
  { value: "workshop_consumables", label: "Workshop" },
  { value: "building_materials", label: "Building" },
  { value: "fuel", label: "Fuel" },
  { value: "garden_supplies", label: "Garden" },
  { value: "cleaning_supplies", label: "Cleaning" },
  { value: "household", label: "Household" },
  { value: "other", label: "Other" },
] as const

const QUICK_LOCATIONS = [
  "Workshop Store",
  "Tool Wall",
  "Fuel Store",
  "Yard",
  "Container",
  "House",
] as const

type InventoryTone = "blue" | "amber" | "green" | "purple"

const toneClasses: Record<
  InventoryTone,
  {
    border: string
    panel: string
    soft: string
    text: string
    muted: string
    button: string
    focus: string
  }
> = {
  blue: {
    border: "border-blue-500/25",
    panel: "bg-blue-950/45",
    soft: "bg-blue-500/20",
    text: "text-blue-100",
    muted: "text-blue-200/55",
    button: "border-blue-400/40 bg-blue-500 text-white hover:bg-blue-400",
    focus: "focus:border-blue-300",
  },
  amber: {
    border: "border-amber-500/25",
    panel: "bg-amber-950/45",
    soft: "bg-amber-500/20",
    text: "text-amber-100",
    muted: "text-amber-200/55",
    button: "border-amber-400/40 bg-amber-500 text-black hover:bg-amber-400",
    focus: "focus:border-amber-300",
  },
  green: {
    border: "border-green-500/25",
    panel: "bg-green-950/45",
    soft: "bg-green-500/20",
    text: "text-green-100",
    muted: "text-green-200/55",
    button: "border-green-400/40 bg-green-500 text-black hover:bg-green-400",
    focus: "focus:border-green-300",
  },
  purple: {
    border: "border-purple-500/25",
    panel: "bg-purple-950/45",
    soft: "bg-purple-500/20",
    text: "text-purple-100",
    muted: "text-purple-200/55",
    button: "border-purple-400/40 bg-purple-500 text-white hover:bg-purple-400",
    focus: "focus:border-purple-300",
  },
}

interface InventoryPhotoCaptureProps {
  persona: "hans" | "charl" | "lucky" | "irma"
  tone: InventoryTone
  defaultCategory?: string
  defaultLocation?: string
}

export function InventoryPhotoCapture({
  persona,
  tone,
  defaultCategory = "workshop_consumables",
  defaultLocation = "Workshop Store",
}: InventoryPhotoCaptureProps) {
  const { user } = useAuth()
  const styles = toneClasses[tone]
  const [label, setLabel] = useState("")
  const [category, setCategory] = useState(defaultCategory)
  const [location, setLocation] = useState(defaultLocation)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const [status, setStatus] = useState<{
    type: "idle" | "saving" | "success" | "error"
    message: string
  }>({ type: "idle", message: "" })

  function clearPreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    setPreview(null)
  }

  function selectPhoto(nextPhoto: File | null) {
    clearPreview()
    setPhoto(nextPhoto)
    if (nextPhoto) {
      const nextPreview = URL.createObjectURL(nextPhoto)
      previewRef.current = nextPreview
      setPreview(nextPreview)
    }
    setStatus({ type: "idle", message: "" })
  }

  useEffect(() => () => clearPreview(), [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      setStatus({ type: "error", message: "Add a label before saving." })
      return
    }
    if (!photo) {
      setStatus({ type: "error", message: "Take or choose a photo first." })
      return
    }

    const userId = user?.id ?? persona
    setStatus({ type: "saving", message: "Uploading photo..." })

    try {
      const formData = new FormData()
      formData.append("file", photo)
      formData.append("userId", userId)
      formData.append("category", "image")
      formData.append("resourceType", "inventory")

      const upload = await apiFetch<{
        success: boolean
        file: { id: string; url: string }
      }>("/api/uploads", {
        method: "POST",
        body: formData,
        label: "InventoryPhotoUpload",
      })

      setStatus({ type: "saving", message: "Saving label..." })

      await apiFetch("/api/inventory", {
        method: "POST",
        body: {
          name: trimmedLabel,
          label: trimmedLabel,
          category,
          unit: "units",
          currentStock: 1,
          minStock: 1,
          maxStock: 1,
          reorderPoint: 1,
          location,
          unitCost: 0,
          photoUrl: upload.file.url,
          photoFileId: upload.file.id,
        },
        label: "InventoryPhotoLabel",
      })

      setLabel("")
      setPhoto(null)
      clearPreview()
      setStatus({ type: "success", message: "Saved to inventory." })
    } catch (error) {
      logger.error("Failed to save inventory photo label", {
        error: error instanceof Error ? error.message : String(error),
      })
      setStatus({ type: "error", message: "Could not save. Try again." })
    }
  }

  return (
    <section
      className={`mb-6 overflow-hidden rounded-xl border ${styles.border} ${styles.panel} backdrop-blur-sm sm:mb-8`}
      data-testid="inventory-photo-capture"
    >
      <div className={`border-b ${styles.border} p-4 sm:p-5`}>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${styles.border} ${styles.soft}`}
          >
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className={`font-semibold ${styles.text}`}>Inventory Capture</h3>
            <p className={`text-sm ${styles.muted}`}>Photo, label, save.</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-[minmax(180px,240px)_1fr]"
      >
        <label
          className={`group flex aspect-4/3 min-h-44 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed ${styles.border} bg-black/20 text-center transition-colors hover:bg-white/5`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Inventory preview" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex flex-col items-center gap-2 px-4 text-sm ${styles.muted}`}>
              <Upload className="h-8 w-8" />
              Take photo
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            data-testid="inventory-photo-input"
            onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="grid content-start gap-3">
          <label className="grid gap-1.5">
            <span className={`flex items-center gap-2 text-sm font-medium ${styles.text}`}>
              <Tag className="h-4 w-4" />
              Label
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Blue drill bits"
              maxLength={120}
              data-testid="inventory-label-input"
              className={`h-12 rounded-lg border ${styles.border} bg-black/25 px-3 text-base text-white outline-none placeholder:text-white/35 ${styles.focus}`}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className={`text-sm font-medium ${styles.text}`}>Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                data-testid="inventory-category-select"
                className={`h-12 rounded-lg border ${styles.border} bg-black/25 px-3 text-base text-white outline-none ${styles.focus}`}
              >
                {INVENTORY_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value} className="bg-zinc-950">
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className={`text-sm font-medium ${styles.text}`}>Location</span>
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                data-testid="inventory-location-select"
                className={`h-12 rounded-lg border ${styles.border} bg-black/25 px-3 text-base text-white outline-none ${styles.focus}`}
              >
                {QUICK_LOCATIONS.map((item) => (
                  <option key={item} value={item} className="bg-zinc-950">
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:flex sm:items-center">
            <button
              type="submit"
              disabled={status.type === "saving"}
              data-testid="save-inventory-capture"
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${styles.button}`}
            >
              <Camera className="h-4 w-4" />
              {status.type === "saving" ? "Saving..." : "Save"}
            </button>

            {status.message && (
              <p
                className={`flex items-center gap-2 text-sm ${
                  status.type === "error" ? "text-red-300" : "text-emerald-300"
                }`}
                role={status.type === "error" ? "alert" : "status"}
              >
                {status.type === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {status.message}
              </p>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}
