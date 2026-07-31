"use client"

import { ApiError, apiFetch } from "@/lib/api-client"
import type { RecipeGuidanceDocument, RecipeImageBrief } from "@/lib/recipe-guidance"
import type { RecipeImageBriefUpdate } from "@/lib/recipe-guidance-media"
import { ImagePlus, Loader2, RefreshCw, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

interface UploadRecord {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedBy: string
  uploadedAt: string
  url: string
}

interface UploadListResponse {
  files: UploadRecord[]
  total: number
}

interface UploadResponse {
  file: UploadRecord
}

function errorText(error: unknown, fallback: string) {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "error" in error.body &&
    typeof error.body.error === "string"
  ) {
    return error.body.error
  }
  return error instanceof Error ? error.message : fallback
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function ImageBriefEditor({
  brief,
  disabled,
  canPrepareRequest,
  onReview,
  onPrepareRequest,
}: {
  brief: RecipeImageBrief
  disabled: boolean
  canPrepareRequest: boolean
  onReview: (input: RecipeImageBriefUpdate) => Promise<void>
  onPrepareRequest: (briefId: string) => Promise<void>
}) {
  const [descriptionEn, setDescriptionEn] = useState(brief.description.en)
  const [descriptionAf, setDescriptionAf] = useState(brief.description.af)
  const [reviewedFacts, setReviewedFacts] = useState(brief.reviewedFacts.join("\n"))
  const [excludedContent, setExcludedContent] = useState(brief.excludedContent.join("\n"))
  const [rejectionReason, setRejectionReason] = useState(brief.rejectionReason ?? "")
  const persistedReviewedFacts = brief.reviewedFacts.join("\n")
  const persistedExcludedContent = brief.excludedContent.join("\n")
  const persistedKey = JSON.stringify([
    brief.description.en,
    brief.description.af,
    persistedReviewedFacts,
    persistedExcludedContent,
    brief.rejectionReason ?? "",
  ])
  const [lastPersistedKey, setLastPersistedKey] = useState(persistedKey)

  if (lastPersistedKey !== persistedKey) {
    setLastPersistedKey(persistedKey)
    setDescriptionEn(brief.description.en)
    setDescriptionAf(brief.description.af)
    setReviewedFacts(persistedReviewedFacts)
    setExcludedContent(persistedExcludedContent)
    setRejectionReason(brief.rejectionReason ?? "")
  }
  const editable = (brief.status === "draft" || brief.status === "rejected") && !disabled
  const complete = Boolean(descriptionEn.trim() && descriptionAf.trim())
  const reviewReady =
    complete && lines(reviewedFacts).length > 0 && lines(excludedContent).length > 0
  const hasUnsavedChanges =
    descriptionEn !== brief.description.en ||
    descriptionAf !== brief.description.af ||
    reviewedFacts !== persistedReviewedFacts ||
    excludedContent !== persistedExcludedContent

  return (
    <article className="border-border space-y-3 rounded-lg border p-3 text-xs">
      <div>
        <p className="font-semibold">
          {brief.role.replaceAll("_", " ")} · {brief.status}
        </p>
        {brief.rejectionReason && (
          <p className="text-destructive mt-1">Rejected: {brief.rejectionReason}</p>
        )}
      </div>
      <label className="text-muted-foreground block">
        English brief
        <textarea
          value={descriptionEn}
          onChange={(event) => setDescriptionEn(event.target.value)}
          disabled={!editable}
          rows={3}
          className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="text-muted-foreground block">
        Afrikaans brief
        <textarea
          value={descriptionAf}
          onChange={(event) => setDescriptionAf(event.target.value)}
          disabled={!editable}
          rows={3}
          className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2"
        />
      </label>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-muted-foreground block">
          Reviewed facts (one per line)
          <textarea
            value={reviewedFacts}
            onChange={(event) => setReviewedFacts(event.target.value)}
            disabled={!editable}
            rows={4}
            className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="text-muted-foreground block">
          Excluded content (one per line)
          <textarea
            value={excludedContent}
            onChange={(event) => setExcludedContent(event.target.value)}
            disabled={!editable}
            rows={4}
            className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>
      {brief.status === "draft" && (
        <label className="text-muted-foreground block">
          Rejection reason
          <input
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            disabled={disabled}
            className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {editable && (
          <button
            type="button"
            disabled={!complete}
            onClick={() =>
              void onReview({
                action: "edit",
                briefId: brief.id,
                description: { en: descriptionEn.trim(), af: descriptionAf.trim() },
                reviewedFacts: lines(reviewedFacts),
                excludedContent: lines(excludedContent),
              })
            }
            className="border-border bg-background rounded-md border px-3 py-2 font-semibold disabled:opacity-50"
          >
            Save brief draft
          </button>
        )}
        {brief.status === "draft" && (
          <>
            <button
              type="button"
              disabled={disabled || !reviewReady || hasUnsavedChanges}
              onClick={() => void onReview({ action: "approve", briefId: brief.id })}
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 font-semibold disabled:opacity-50"
            >
              Approve brief
            </button>
            <button
              type="button"
              disabled={disabled || !rejectionReason.trim() || hasUnsavedChanges}
              onClick={() =>
                void onReview({
                  action: "reject",
                  briefId: brief.id,
                  rejectionReason: rejectionReason.trim(),
                })
              }
              className="border-destructive/40 text-destructive rounded-md border px-3 py-2 font-semibold disabled:opacity-50"
            >
              Reject brief
            </button>
          </>
        )}
        {brief.status === "approved" && canPrepareRequest && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onPrepareRequest(brief.id)}
            className="border-border bg-background rounded-md border px-3 py-2 font-semibold disabled:opacity-50"
          >
            Prepare disabled request contract
          </button>
        )}
      </div>
    </article>
  )
}

export function RecipeGuidanceMediaIntake({
  recipeId,
  document,
  disabled,
  busy,
  onPlan,
  onAttach,
  onReviewBrief,
  onPrepareRequest,
}: {
  recipeId: string
  document: RecipeGuidanceDocument
  disabled: boolean
  busy: boolean
  onPlan: () => Promise<void>
  onAttach: (input: {
    mediaAssetId: string
    uploadId: string
    rightsBasis: string
    attributionText: string
  }) => Promise<void>
  onReviewBrief: (input: RecipeImageBriefUpdate) => Promise<void>
  onPrepareRequest: (briefId: string) => Promise<void>
}) {
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [selectedUploadId, setSelectedUploadId] = useState("")
  const [selectedAssetId, setSelectedAssetId] = useState("")
  const [rightsBasis, setRightsBasis] = useState("")
  const [attributionText, setAttributionText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loadingUploads, setLoadingUploads] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const attachableAssets = useMemo(
    () =>
      document.mediaAssets.filter((asset) =>
        ["planned", "review_required", "rejected", "unavailable"].includes(asset.status)
      ),
    [document.mediaAssets]
  )

  const loadUploads = useCallback(async () => {
    setLoadingUploads(true)
    setError("")
    try {
      const response = await apiFetch<UploadListResponse>(
        `/api/uploads?resourceType=recipe-guidance&resourceId=${encodeURIComponent(recipeId)}`,
        { label: "RecipeGuidanceUploads" }
      )
      const files = Array.isArray(response.files) ? response.files : []
      setUploads(files)
      setSelectedUploadId((current) =>
        files.some((upload) => upload.id === current) ? current : (files[0]?.id ?? "")
      )
    } catch (loadError) {
      setUploads([])
      setSelectedUploadId("")
      setError(errorText(loadError, "Unable to load recipe media uploads"))
    } finally {
      setLoadingUploads(false)
    }
  }, [recipeId])

  useEffect(() => {
    void loadUploads()
  }, [loadUploads])

  useEffect(() => {
    setSelectedAssetId((current) =>
      attachableAssets.some((asset) => asset.id === current)
        ? current
        : (attachableAssets[0]?.id ?? "")
    )
  }, [attachableAssets])

  const uploadFile = async () => {
    if (!file) return
    setUploading(true)
    setError("")
    setMessage("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", "image")
      formData.append("resourceType", "recipe-guidance")
      formData.append("resourceId", recipeId)
      const response = await apiFetch<UploadResponse>("/api/uploads", {
        method: "POST",
        label: "RecipeGuidanceUpload",
        body: formData,
      })
      setFile(null)
      await loadUploads()
      setSelectedUploadId(response.file.id)
      setMessage(`${response.file.originalName} is stored privately and ready to attach.`)
    } catch (uploadError) {
      setError(errorText(uploadError, "Unable to upload recipe media"))
    } finally {
      setUploading(false)
    }
  }

  const attach = async () => {
    if (!selectedAssetId || !selectedUploadId) return
    setError("")
    setMessage("")
    await onAttach({
      mediaAssetId: selectedAssetId,
      uploadId: selectedUploadId,
      rightsBasis: rightsBasis.trim(),
      attributionText: attributionText.trim(),
    })
  }

  return (
    <section className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Media intake and plan</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Plan deterministic section slots, then attach private HOV uploads with explicit rights
            and attribution. No image generation occurs here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onPlan()}
          disabled={disabled || busy}
          className="border-border bg-background inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Plan missing media
        </button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {message && <p className="text-muted-foreground text-sm">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-muted/30 space-y-3 rounded-lg p-3">
          <label className="text-muted-foreground block text-xs">
            Private image upload
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={disabled || uploading}
              className="border-border bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void uploadFile()}
            disabled={disabled || uploading || !file}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload privately
          </button>
        </div>

        <div className="bg-muted/30 space-y-3 rounded-lg p-3">
          <div className="flex items-end gap-2">
            <label className="text-muted-foreground min-w-0 flex-1 text-xs">
              Stored recipe upload
              <select
                value={selectedUploadId}
                onChange={(event) => setSelectedUploadId(event.target.value)}
                disabled={disabled || loadingUploads || uploads.length === 0}
                className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              >
                {uploads.length === 0 && <option value="">No recipe uploads</option>}
                {uploads.map((upload) => (
                  <option key={upload.id} value={upload.id}>
                    {upload.originalName} · {Math.ceil(upload.size / 1024)} KB
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadUploads()}
              disabled={loadingUploads}
              aria-label="Refresh recipe uploads"
              className="border-border bg-background rounded-md border p-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingUploads ? "animate-spin" : ""}`} />
            </button>
          </div>
          <label className="text-muted-foreground block text-xs">
            Planned or replaceable media slot
            <select
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              disabled={disabled || attachableAssets.length === 0}
              className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            >
              {attachableAssets.length === 0 && <option value="">Plan media first</option>}
              {attachableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.role.replaceAll("_", " ")} · {asset.status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground block text-xs">
            Rights basis
            <input
              value={rightsBasis}
              onChange={(event) => setRightsBasis(event.target.value)}
              placeholder="Example: Estate-owned photograph"
              disabled={disabled}
              className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-muted-foreground block text-xs">
            Attribution
            <input
              value={attributionText}
              onChange={(event) => setAttributionText(event.target.value)}
              placeholder="Photographer or source attribution"
              disabled={disabled}
              className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void attach()}
            disabled={
              disabled ||
              busy ||
              !selectedUploadId ||
              !selectedAssetId ||
              !rightsBasis.trim() ||
              !attributionText.trim()
            }
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Attach for review
          </button>
        </div>
      </div>

      {document.imageBriefs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Deterministic image briefs</h4>
          {document.imageBriefs.map((brief) => (
            <ImageBriefEditor
              key={brief.id}
              brief={brief}
              disabled={disabled || busy}
              canPrepareRequest={document.mediaAssets.some(
                (asset) => asset.imageBriefId === brief.id && asset.status === "planned"
              )}
              onReview={onReviewBrief}
              onPrepareRequest={onPrepareRequest}
            />
          ))}
        </div>
      )}
    </section>
  )
}
