"use client"

import { ApiError, apiFetch } from "@/lib/api-client"
import type { RecipeGuidanceDocument } from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"
import { Loader2, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  RecipeGuidanceDocumentView,
  type RecipeGuidanceLanguageMode,
} from "./recipe-guidance-document-view"

interface PublishedGuidanceResponse {
  data: {
    recipe: RecipeRecord
    document: RecipeGuidanceDocument
  }
}

function errorText(error: unknown) {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "error" in error.body &&
    typeof error.body.error === "string"
  ) {
    return error.body.error
  }
  return error instanceof Error ? error.message : "Published guidance is unavailable"
}

export function PublishedRecipeGuidance({
  recipeId,
  language,
}: {
  recipeId: string
  language: RecipeGuidanceLanguageMode
}) {
  const [response, setResponse] = useState<PublishedGuidanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notPublished, setNotPublished] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    setNotPublished(false)
    try {
      const next = await apiFetch<PublishedGuidanceResponse>(`/api/recipes/${recipeId}/guidance`, {
        label: "PublishedRecipeGuidance",
      })
      setResponse(next)
    } catch (loadError) {
      setResponse(null)
      if (loadError instanceof ApiError && loadError.status === 404) {
        setNotPublished(true)
      } else {
        setError(errorText(loadError))
      }
    } finally {
      setLoading(false)
    }
  }, [recipeId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="border-border bg-card text-muted-foreground flex items-center gap-2 rounded-2xl border p-5 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading reviewed kitchen guidance…
      </div>
    )
  }

  if (notPublished) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        Reviewed guidance has not been published for this recipe yet. The canonical recipe remains
        available below.
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/10 rounded-2xl border p-5 text-sm">
        <p className="text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="border-border bg-background mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  return response ? (
    <RecipeGuidanceDocumentView
      document={response.data.document}
      recipe={response.data.recipe}
      language={language}
      heading="Irma’s kitchen view"
    />
  ) : null
}
