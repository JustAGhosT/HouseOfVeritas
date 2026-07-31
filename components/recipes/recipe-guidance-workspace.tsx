"use client"

import { ApiError, apiFetch } from "@/lib/api-client"
import {
  type RecipeGuidanceBlock,
  type RecipeGuidanceDocument,
  type RecipeGuidanceReviewEvidence,
  type RecipeGuidanceSection,
  type RecipeGuidanceSectionKind,
  type RecipeMediaAsset,
} from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FilePlus2,
  Loader2,
  RefreshCw,
  Save,
  Send,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  RecipeGuidanceDocumentView,
  type RecipeGuidanceLanguageMode,
} from "./recipe-guidance-document-view"
import { RecipeGuidanceMediaIntake } from "./recipe-guidance-media-intake"

interface GuidanceListResponse {
  data: { documents: RecipeGuidanceDocument[] }
}

interface GuidanceMutationResponse {
  data: { recipe?: RecipeRecord; document: RecipeGuidanceDocument }
}

interface GuidancePreviewResponse {
  data: { recipe: RecipeRecord; document: RecipeGuidanceDocument }
  summary: { persisted: false; nextVersion: number }
}

interface ReadinessIssue {
  code: string
  message: string
}

interface ReadinessResponse {
  data: {
    documentId: string
    version: number
    status: RecipeGuidanceDocument["status"]
    ready: boolean
    issues: ReadinessIssue[]
  }
}

type TransitionAction = "submit_for_review" | "approve_review" | "publish" | "archive"

const FOUNDATIONAL_SECTIONS = new Set<RecipeGuidanceSectionKind>([
  "identity",
  "ingredients",
  "cooking",
])

const TEXT_SECTION_KINDS = new Set<RecipeGuidanceSectionKind>([
  "identity",
  "before_start",
  "preparation",
  "finish_and_serve",
  "storage_and_reheating",
  "provenance_and_feedback",
])

const SECTION_NAMES: Record<RecipeGuidanceSectionKind, string> = {
  identity: "Recipe overview",
  hero: "Hero image",
  before_start: "Before you start",
  ingredients: "Ingredients",
  preparation: "Preparation",
  cooking: "Cooking",
  finish_and_serve: "Finish and serve",
  storage_and_reheating: "Storage and reheating",
  provenance_and_feedback: "Source and feedback",
}

function getErrorMessage(error: unknown, fallback: string) {
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

function sortedDocuments(documents: RecipeGuidanceDocument[]) {
  return [...documents].sort((left, right) => right.version - left.version)
}

function blockDescription(block: RecipeGuidanceBlock) {
  if (block.type === "metrics") return "Canonical recipe timings and servings"
  if (block.type === "ingredient_references") {
    return `${block.ingredientIds.length} canonical ingredient references`
  }
  if (block.type === "step_reference") return `Canonical recipe step ${block.recipeStepId}`
  if (block.type === "media_reference") return `Media asset ${block.mediaAssetId}`
  return block.type
}

function SectionEditor({
  section,
  disabled,
  busy,
  removableMediaAssetIds,
  onSave,
}: {
  section: RecipeGuidanceSection
  disabled: boolean
  busy: boolean
  removableMediaAssetIds: ReadonlySet<string>
  onSave: (section: RecipeGuidanceSection) => Promise<void>
}) {
  const [draft, setDraft] = useState(section)

  const updateText = (index: number, language: "en" | "af", value: string) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block, blockIndex) => {
        if (blockIndex !== index || (block.type !== "text" && block.type !== "notice")) return block
        if (block.type === "text") {
          return {
            ...block,
            source: "reviewed" as const,
            text: { ...block.text, [language]: value },
          }
        }
        return { ...block, text: { ...block.text, [language]: value } }
      }),
    }))
  }

  const addReviewedParagraph = () => {
    const newBlock: RecipeGuidanceBlock = {
      id: `${section.id}-reviewed-${globalThis.crypto.randomUUID()}`,
      type: "text",
      source: "reviewed",
      text: { en: "", af: "" },
    }
    setDraft((current) => ({ ...current, blocks: [...current.blocks, newBlock] }))
  }

  const removeBlock = (index: number) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.filter((_block, blockIndex) => blockIndex !== index),
    }))
  }

  const hasIncompleteLocalizedText = draft.blocks.some(
    (block) =>
      (block.type === "text" || block.type === "notice") &&
      (!block.text.en.trim() || !block.text.af.trim())
  )

  return (
    <section className="border-border space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">{SECTION_NAMES[section.kind]}</h4>
          <p className="text-muted-foreground text-xs">{section.kind.replaceAll("_", " ")}</p>
        </div>
        <label className="text-muted-foreground text-xs">
          Applicability
          <select
            value={draft.applicability}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                applicability: event.target.value as RecipeGuidanceSection["applicability"],
              }))
            }
            disabled={disabled || FOUNDATIONAL_SECTIONS.has(section.kind)}
            className="border-border bg-background ml-2 rounded-md border px-2 py-1"
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
            <option value="not_applicable">Not applicable</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {draft.blocks.map((block, index) =>
          block.type === "text" || block.type === "notice" ? (
            <div key={block.id} className="bg-muted/30 space-y-3 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  {block.type === "notice" ? `${block.noticeType} notice` : `${block.source} text`}
                </p>
                {block.type === "text" && draft.blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    disabled={disabled}
                    className="text-destructive text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <label className="text-muted-foreground block text-xs">
                English
                <textarea
                  value={block.text.en}
                  onChange={(event) => updateText(index, "en", event.target.value)}
                  disabled={disabled}
                  rows={3}
                  placeholder="Add reviewed English guidance"
                  className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
              <label className="text-muted-foreground block text-xs">
                Afrikaans
                <textarea
                  value={block.text.af}
                  onChange={(event) => updateText(index, "af", event.target.value)}
                  disabled={disabled}
                  rows={3}
                  placeholder="Voeg nagegane Afrikaanse leiding by"
                  className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : (
            <div
              key={block.id}
              className="border-border text-muted-foreground flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-xs"
            >
              <span>{blockDescription(block)}</span>
              {block.type === "media_reference" &&
                removableMediaAssetIds.has(block.mediaAssetId) && (
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    disabled={disabled}
                    className="text-destructive shrink-0 font-semibold disabled:opacity-50"
                  >
                    Remove rejected media reference
                  </button>
                )}
            </div>
          )
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TEXT_SECTION_KINDS.has(section.kind) && (
          <button
            type="button"
            onClick={addReviewedParagraph}
            disabled={disabled}
            className="border-border bg-background rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
          >
            Add reviewed paragraph
          </button>
        )}
        <button
          type="button"
          onClick={() => void onSave(draft)}
          disabled={disabled || busy || hasIncompleteLocalizedText}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save section
        </button>
      </div>
    </section>
  )
}

function MediaReviewCard({
  asset,
  disabled,
  busy,
  onReview,
}: {
  asset: RecipeMediaAsset
  disabled: boolean
  busy: boolean
  onReview: (
    asset: RecipeMediaAsset,
    review:
      | { decision: "approve"; altText: { en: string; af: string } }
      | { decision: "reject"; rejectionReason: string }
  ) => Promise<void>
}) {
  const [altEn, setAltEn] = useState(asset.altText?.en ?? "")
  const [altAf, setAltAf] = useState(asset.altText?.af ?? "")
  const [rejectionReason, setRejectionReason] = useState(asset.rejectionReason ?? "")

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{asset.role.replaceAll("_", " ")}</p>
          <p className="text-muted-foreground text-xs">{asset.id}</p>
        </div>
        <span className="bg-muted rounded-full px-3 py-1 text-xs uppercase">
          {asset.status.replaceAll("_", " ")}
        </span>
      </div>
      {asset.status === "review_required" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-muted-foreground text-xs">
              English alt text
              <input
                value={altEn}
                onChange={(event) => setAltEn(event.target.value)}
                disabled={disabled}
                className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-muted-foreground text-xs">
              Afrikaans alt text
              <input
                value={altAf}
                onChange={(event) => setAltAf(event.target.value)}
                disabled={disabled}
                className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              void onReview(asset, {
                decision: "approve",
                altText: { en: altEn.trim(), af: altAf.trim() },
              })
            }
            disabled={disabled || busy || !altEn.trim() || !altAf.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Approve media
          </button>
          <div className="border-border border-t pt-3">
            <label className="text-muted-foreground text-xs">
              Rejection reason
              <input
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                disabled={disabled}
                className="border-border bg-background text-foreground mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void onReview(asset, {
                  decision: "reject",
                  rejectionReason: rejectionReason.trim(),
                })
              }
              disabled={disabled || busy || !rejectionReason.trim()}
              className="border-destructive/40 text-destructive mt-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Reject media
            </button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {asset.status === "approved"
            ? "Reviewed media is ready for publication."
            : (asset.rejectionReason ??
              asset.unavailableReason ??
              "No client action is available.")}
        </p>
      )}
    </div>
  )
}

export function RecipeGuidanceWorkspace({
  recipe,
  language,
}: {
  recipe: RecipeRecord
  language: RecipeGuidanceLanguageMode
}) {
  const [documents, setDocuments] = useState<RecipeGuidanceDocument[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [preview, setPreview] = useState<GuidancePreviewResponse["data"] | null>(null)
  const [readiness, setReadiness] = useState<ReadinessResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [reviewChecks, setReviewChecks] = useState({
    bilingual: false,
    safety: false,
    provenance: false,
  })
  const [waiverAssetIds, setWaiverAssetIds] = useState<string[]>([])

  const selectedDocument = useMemo(
    () => documents.find((document) => document.version === selectedVersion) ?? null,
    [documents, selectedVersion]
  )
  const displayDocument = preview?.document ?? selectedDocument
  const displayRecipe = preview?.recipe ?? recipe

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch<GuidanceListResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts`,
        { label: "RecipeGuidanceVersions" }
      )
      const next = sortedDocuments(response.data.documents)
      setDocuments(next)
      setSelectedVersion((current) =>
        current !== null && next.some((document) => document.version === current)
          ? current
          : (next[0]?.version ?? null)
      )
    } catch (loadError) {
      setDocuments([])
      setSelectedVersion(null)
      setError(getErrorMessage(loadError, "Unable to load recipe guidance versions"))
    } finally {
      setLoading(false)
    }
  }, [recipe.id])

  const loadReadiness = useCallback(async (document: RecipeGuidanceDocument) => {
    try {
      const response = await apiFetch<ReadinessResponse>(
        `/api/recipes/${document.recipeId}/guidance-drafts/${document.version}/publication-readiness`,
        { label: "RecipeGuidanceReadiness" }
      )
      setReadiness(response.data)
    } catch (readinessError) {
      setReadiness(null)
      setError(getErrorMessage(readinessError, "Unable to inspect publication readiness"))
    }
  }, [])

  useEffect(() => {
    setPreview(null)
    setMessage("")
    void loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    setReviewChecks({ bilingual: false, safety: false, provenance: false })
    setWaiverAssetIds(selectedDocument?.reviewEvidence?.optionalMediaWaiverAssetIds ?? [])
    if (selectedDocument) void loadReadiness(selectedDocument)
    else setReadiness(null)
  }, [loadReadiness, selectedDocument])

  const replaceDocument = (updated: RecipeGuidanceDocument) => {
    setDocuments((current) =>
      sortedDocuments([
        updated,
        ...current.filter((document) => document.version !== updated.version),
      ])
    )
    setSelectedVersion(updated.version)
    setPreview(null)
  }

  const handleMutationError = async (mutationError: unknown, fallback: string) => {
    setError(getErrorMessage(mutationError, fallback))
    if (mutationError instanceof ApiError && mutationError.status === 409) {
      await loadDocuments()
      setMessage(
        "The guidance changed. The latest version has been loaded; review it before retrying."
      )
    }
  }

  const previewDraft = async () => {
    setBusy("preview")
    setError("")
    setMessage("")
    try {
      const response = await apiFetch<GuidancePreviewResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts/preview`,
        { method: "POST", label: "RecipeGuidancePreview" }
      )
      setPreview(response.data)
      setMessage(`Previewing version ${response.summary.nextVersion}. Nothing has been persisted.`)
    } catch (previewError) {
      await handleMutationError(previewError, "Unable to preview recipe guidance")
    } finally {
      setBusy("")
    }
  }

  const createDraft = async () => {
    setBusy("create")
    setError("")
    setMessage("")
    try {
      const response = await apiFetch<GuidanceMutationResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts`,
        { method: "POST", label: "RecipeGuidanceCreate" }
      )
      replaceDocument(response.data.document)
      setMessage(`Version ${response.data.document.version} was created as a draft.`)
    } catch (createError) {
      await handleMutationError(createError, "Unable to create recipe guidance")
    } finally {
      setBusy("")
    }
  }

  const saveSection = async (section: RecipeGuidanceSection) => {
    if (!selectedDocument) return
    setBusy(`section-${section.id}`)
    setError("")
    try {
      const response = await apiFetch<GuidanceMutationResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts/${selectedDocument.version}`,
        {
          method: "PATCH",
          label: "RecipeGuidanceSection",
          body: {
            expectedUpdatedAt: selectedDocument.updatedAt,
            section: {
              kind: section.kind,
              applicability: section.applicability,
              blocks: section.blocks,
            },
          },
        }
      )
      replaceDocument(response.data.document)
      setMessage(`${SECTION_NAMES[section.kind]} was saved. Review approval was cleared.`)
    } catch (saveError) {
      await handleMutationError(saveError, "Unable to save the guidance section")
    } finally {
      setBusy("")
    }
  }

  const reviewMedia = async (
    asset: RecipeMediaAsset,
    review:
      | { decision: "approve"; altText: { en: string; af: string } }
      | { decision: "reject"; rejectionReason: string }
  ) => {
    if (!selectedDocument) return
    setBusy(`media-${asset.id}`)
    setError("")
    try {
      const response = await apiFetch<GuidanceMutationResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts/${selectedDocument.version}`,
        {
          method: "PATCH",
          label: "RecipeGuidanceMediaReview",
          body: {
            expectedUpdatedAt: selectedDocument.updatedAt,
            mediaReview: { assetId: asset.id, ...review },
          },
        }
      )
      replaceDocument(response.data.document)
      setMessage(`Media ${review.decision === "approve" ? "approved" : "rejected"}.`)
    } catch (reviewError) {
      await handleMutationError(reviewError, "Unable to record the media review")
    } finally {
      setBusy("")
    }
  }

  const planMedia = async () => {
    if (!selectedDocument) return
    setBusy("media-plan")
    setError("")
    setMessage("")
    try {
      const response = await apiFetch<GuidanceMutationResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts/${selectedDocument.version}`,
        {
          method: "PATCH",
          label: "RecipeGuidanceMediaPlan",
          body: {
            expectedUpdatedAt: selectedDocument.updatedAt,
            mediaPlan: { action: "create_missing" },
          },
        }
      )
      replaceDocument(response.data.document)
      setMessage("Missing recipe media slots were planned deterministically.")
    } catch (planError) {
      await handleMutationError(planError, "Unable to plan recipe guidance media")
    } finally {
      setBusy("")
    }
  }

  const attachUpload = async (input: {
    mediaAssetId: string
    uploadId: string
    rightsBasis: string
    attributionText: string
  }) => {
    if (!selectedDocument) return
    setBusy("media-attach")
    setError("")
    setMessage("")
    try {
      const response = await apiFetch<GuidanceMutationResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts/${selectedDocument.version}`,
        {
          method: "PATCH",
          label: "RecipeGuidanceMediaAttachment",
          body: {
            expectedUpdatedAt: selectedDocument.updatedAt,
            mediaAttachment: input,
          },
        }
      )
      replaceDocument(response.data.document)
      setMessage("Private upload attached for bilingual media review.")
    } catch (attachmentError) {
      await handleMutationError(attachmentError, "Unable to attach recipe guidance media")
    } finally {
      setBusy("")
    }
  }

  const transition = async (action: TransitionAction) => {
    if (!selectedDocument) return
    setBusy(action)
    setError("")
    setMessage("")
    const evidence: RecipeGuidanceReviewEvidence = {
      bilingualContentReviewed: true,
      allergensAndSafetyReviewed: true,
      provenanceAndRightsReviewed: true,
      optionalMediaWaiverAssetIds: waiverAssetIds,
    }
    try {
      const response = await apiFetch<GuidanceMutationResponse>(
        `/api/recipes/${recipe.id}/guidance-drafts/${selectedDocument.version}/transitions`,
        {
          method: "POST",
          label: "RecipeGuidanceTransition",
          body: {
            action,
            expectedUpdatedAt: selectedDocument.updatedAt,
            ...(action === "approve_review" ? { evidence } : {}),
          },
        }
      )
      replaceDocument(response.data.document)
      setMessage(
        `${action.replaceAll("_", " ")} completed for version ${selectedDocument.version}.`
      )
    } catch (transitionError) {
      await handleMutationError(transitionError, "Unable to change the guidance lifecycle")
    } finally {
      setBusy("")
    }
  }

  const editable = selectedDocument?.status === "draft" || selectedDocument?.status === "in_review"
  const reviewConfirmed = reviewChecks.bilingual && reviewChecks.safety && reviewChecks.provenance
  const unavailableAssets =
    selectedDocument?.mediaAssets.filter((asset) => asset.status === "unavailable") ?? []
  const rejectedMediaAssetIds = useMemo(
    () =>
      new Set(
        selectedDocument?.mediaAssets
          .filter((asset) => asset.status === "rejected")
          .map((asset) => asset.id) ?? []
      ),
    [selectedDocument]
  )

  return (
    <section
      className="border-primary/20 bg-primary/5 space-y-5 rounded-2xl border p-4 sm:p-5"
      data-testid="recipe-guidance-workspace"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            Hans review workspace
          </p>
          <h2 className="text-foreground mt-1 text-xl font-semibold">Recipe guidance lifecycle</h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Preview deterministic guidance, persist a version, review bilingual sections and media,
            then publish only after every readiness blocker is cleared.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDocuments()}
          disabled={loading || Boolean(busy)}
          className="border-border bg-background inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh versions
        </button>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">{message}</div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-muted-foreground text-xs">
          Stored version
          <select
            value={selectedVersion ?? ""}
            onChange={(event) => {
              setPreview(null)
              setSelectedVersion(event.target.value ? Number(event.target.value) : null)
            }}
            disabled={loading || documents.length === 0}
            className="border-border bg-background text-foreground mt-1 block min-w-48 rounded-lg border px-3 py-2 text-sm"
          >
            {documents.length === 0 && <option value="">No stored versions</option>}
            {documents.map((document) => (
              <option key={document.id} value={document.version}>
                Version {document.version} · {document.status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void previewDraft()}
          disabled={Boolean(busy)}
          className="border-border bg-background inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === "preview" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Preview next version
        </button>
        <button
          type="button"
          onClick={() => void createDraft()}
          disabled={Boolean(busy)}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "create" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FilePlus2 className="h-4 w-4" />
          )}
          Create draft
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading guidance versions…
        </p>
      ) : displayDocument ? (
        <div className="space-y-5">
          {preview && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              This is a non-persisted preview. Create the draft before editing or transitioning it.
            </div>
          )}

          {!preview && selectedDocument && (
            <>
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-4">
                  <h3 className="font-semibold">Section authoring</h3>
                  {selectedDocument.sections.map((section) => (
                    <SectionEditor
                      key={`${selectedDocument.updatedAt}:${section.id}`}
                      section={section}
                      disabled={!editable || Boolean(busy)}
                      busy={busy === `section-${section.id}`}
                      removableMediaAssetIds={rejectedMediaAssetIds}
                      onSave={saveSection}
                    />
                  ))}
                </div>

                <aside className="space-y-5">
                  <section className="border-border bg-card rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">Publication readiness</h3>
                      {readiness?.ready ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    {readiness ? (
                      readiness.ready ? (
                        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                          All deterministic publication checks pass.
                        </p>
                      ) : (
                        <ul className="text-muted-foreground mt-3 space-y-2 text-xs">
                          {readiness.issues.map((issue, index) => (
                            <li
                              key={`${issue.code}-${index}`}
                              className="border-border border-l-2 pl-2"
                            >
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <p className="text-muted-foreground mt-3 text-sm">
                        Readiness is unavailable.
                      </p>
                    )}
                  </section>

                  <section className="border-border bg-card space-y-3 rounded-xl border p-4">
                    <h3 className="font-semibold">Lifecycle actions</h3>
                    {selectedDocument.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => void transition("submit_for_review")}
                        disabled={Boolean(busy)}
                        className="bg-primary text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        Submit for review
                      </button>
                    )}
                    {selectedDocument.status === "in_review" && (
                      <>
                        {[
                          ["bilingual", "English and Afrikaans content reviewed"],
                          ["safety", "Allergens and food safety reviewed"],
                          ["provenance", "Media provenance and rights reviewed"],
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={reviewChecks[key as keyof typeof reviewChecks]}
                              onChange={(event) =>
                                setReviewChecks((current) => ({
                                  ...current,
                                  [key]: event.target.checked,
                                }))
                              }
                              className="mt-0.5"
                            />
                            {label}
                          </label>
                        ))}
                        {unavailableAssets.map((asset) => (
                          <label key={asset.id} className="flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={waiverAssetIds.includes(asset.id)}
                              onChange={(event) =>
                                setWaiverAssetIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, asset.id])]
                                    : current.filter((id) => id !== asset.id)
                                )
                              }
                              className="mt-0.5"
                            />
                            Explicitly waive unavailable optional media:{" "}
                            {asset.role.replaceAll("_", " ")}
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => void transition("approve_review")}
                          disabled={Boolean(busy) || !reviewConfirmed}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Record review approval
                        </button>
                        <button
                          type="button"
                          onClick={() => void transition("publish")}
                          disabled={Boolean(busy) || !readiness?.ready}
                          className="bg-primary text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Publish guidance
                        </button>
                      </>
                    )}
                    {selectedDocument.status === "published" && (
                      <button
                        type="button"
                        onClick={() => void transition("archive")}
                        disabled={Boolean(busy)}
                        className="border-border bg-background inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        <Archive className="h-4 w-4" />
                        Archive version
                      </button>
                    )}
                    {selectedDocument.status === "archived" && (
                      <p className="text-muted-foreground text-sm">
                        Archived versions are immutable.
                      </p>
                    )}
                  </section>
                </aside>
              </div>

              <RecipeGuidanceMediaIntake
                recipeId={recipe.id}
                document={selectedDocument}
                disabled={!editable || Boolean(busy)}
                busy={Boolean(busy)}
                onPlan={planMedia}
                onAttach={attachUpload}
              />

              {selectedDocument.mediaAssets.length > 0 && (
                <section className="space-y-3">
                  <h3 className="font-semibold">Media review</h3>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {selectedDocument.mediaAssets.map((asset) => (
                      <MediaReviewCard
                        key={`${selectedDocument.updatedAt}:${asset.id}`}
                        asset={asset}
                        disabled={!editable || Boolean(busy)}
                        busy={busy === `media-${asset.id}`}
                        onReview={reviewMedia}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <details className="group">
            <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
              {preview ? "Open draft preview" : "Open rendered version"}
            </summary>
            <div className="mt-4">
              <RecipeGuidanceDocumentView
                document={displayDocument}
                recipe={displayRecipe}
                language={language}
                heading={preview ? "Non-persisted preview" : "Admin preview"}
              />
            </div>
          </details>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No guidance versions exist. Preview the deterministic next version before creating it.
        </p>
      )}
    </section>
  )
}
