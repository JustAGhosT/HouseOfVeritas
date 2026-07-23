import { logger } from "@/lib/logger"

export interface SluiceInventoryImage {
  uploadId: string
  photoUrl: string
  originalName?: string
  mimeType?: string
}

export interface SluiceInventorySuggestion {
  id?: string
  uploadId: string
  photoUrl: string
  label: string
  category: string
  location?: string
  confidence: number | null
  imageBounds?: {
    x: number
    y: number
    width: number
    height: number
  }
  notes?: string
}

function cleanFilename(name?: string): string {
  const base = (name || "Inventory item").replace(/\.[^.]+$/, "")
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "Inventory item"
}

function fallbackSuggestion(image: SluiceInventoryImage): SluiceInventorySuggestion {
  return {
    uploadId: image.uploadId,
    photoUrl: image.photoUrl,
    label: cleanFilename(image.originalName),
    category: "other",
    confidence: null,
    notes: "Sluice identification is not configured; review and correct manually.",
  }
}

export async function identifyInventoryBatchWithSluice(
  images: SluiceInventoryImage[]
): Promise<{ aiPowered: boolean; suggestions: SluiceInventorySuggestion[] }> {
  const baseUrl = process.env.SLUICE_API_URL || process.env.SLUICE_INVENTORY_IDENTIFY_URL
  const apiKey = process.env.SLUICE_API_KEY

  if (!baseUrl) {
    return { aiPowered: false, suggestions: images.map(fallbackSuggestion) }
  }

  const endpoint = process.env.SLUICE_INVENTORY_IDENTIFY_URL || `${baseUrl.replace(/\/$/, "")}/api/inventory/identify-batch`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ images }),
      signal: controller.signal,
    })

    if (!response.ok) {
      logger.warn("Sluice inventory identification returned non-OK", {
        status: response.status,
        statusText: response.statusText,
      })
      return { aiPowered: false, suggestions: images.map(fallbackSuggestion) }
    }

    const data = (await response.json()) as { suggestions?: SluiceInventorySuggestion[] }
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : []
    if (suggestions.length === 0) {
      return { aiPowered: false, suggestions: images.map(fallbackSuggestion) }
    }

    return { aiPowered: true, suggestions }
  } catch (error) {
    logger.warn("Sluice inventory identification failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { aiPowered: false, suggestions: images.map(fallbackSuggestion) }
  } finally {
    clearTimeout(timeout)
  }
}
