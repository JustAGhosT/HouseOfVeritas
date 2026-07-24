"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { GuidanceDraft, GuidanceLocale, GuidancePack } from "@/lib/guidance"
import { apiFetch } from "@/lib/api-client"

interface GuidanceTask {
  id: string | number
  title: string
  description?: string
}

interface TaskGuidanceDialogProps {
  task: GuidanceTask
}

interface UploadResponse {
  file: {
    url: string
    mimeType: string
    originalName: string
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid photo"))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"))
    reader.readAsDataURL(file)
  })
}

function GuidanceViewer({
  guidance,
  imageUrl,
}: {
  guidance: GuidanceDraft | GuidancePack
  imageUrl?: string
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = guidance.steps[stepIndex]

  return (
    <div className="space-y-5" data-testid="task-guidance-viewer">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{guidance.kind}</Badge>
            <Badge variant="secondary">
              {guidance.locale === "af" ? "Afrikaans" : "English"}
            </Badge>
          </div>
          <h3 className="text-xl font-semibold text-foreground">{guidance.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guidance.summary}</p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          Step {stepIndex + 1} of {guidance.steps.length}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          {imageUrl && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
              <Image
                src={imageUrl}
                alt={`Reference photo for ${guidance.title}`}
                fill
                className="object-contain"
                sizes="(min-width: 1024px) 36vw, 92vw"
                unoptimized={
                  imageUrl.startsWith("blob:") || imageUrl.startsWith("/api/uploads/")
                }
              />
            </div>
          )}

          {(guidance.materials.length > 0 || guidance.tools.length > 0) && (
            <details className="rounded-xl border border-border bg-muted/40 p-4">
              <summary className="cursor-pointer font-medium text-foreground">
                Materials and tools
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {guidance.materials.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Materials
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-foreground">
                      {guidance.materials.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {guidance.tools.length > 0 && (
                  <div>
                    <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <Wrench className="h-3.5 w-3.5" /> Tools
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-foreground">
                      {guidance.tools.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        <div className="flex min-h-72 flex-col rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
            {step.order}
          </div>
          <h4 className="text-lg font-semibold text-foreground">{step.title}</h4>
          <p className="mt-3 text-base leading-7 text-foreground">{step.instruction}</p>

          <div className="mt-5 space-y-3">
            {step.visualCue && (
              <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                <Eye className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Look for</p>
                  <p className="mt-0.5 text-muted-foreground">{step.visualCue}</p>
                </div>
              </div>
            )}
            {step.check && (
              <div className="flex gap-3 rounded-xl border border-secondary/25 bg-secondary/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                <div>
                  <p className="font-medium text-foreground">Quality check</p>
                  <p className="mt-0.5 text-muted-foreground">{step.check}</p>
                </div>
              </div>
            )}
            {step.warning && (
              <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">Stop and check</p>
                  <p className="mt-0.5 text-muted-foreground">{step.warning}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous guidance step"
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous step</TooltipContent>
            </Tooltip>
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {guidance.steps.map((item, index) => (
                <span
                  key={`${item.order}-${item.title}`}
                  className={`h-1.5 flex-1 rounded-full ${
                    index <= stepIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next guidance step"
                  disabled={stepIndex === guidance.steps.length - 1}
                  onClick={() =>
                    setStepIndex((current) => Math.min(guidance.steps.length - 1, current + 1))
                  }
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next step</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {guidance.safety.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Safety before you start
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {guidance.safety.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function TaskGuidanceDialog({ task }: TaskGuidanceDialogProps) {
  const taskId = String(task.id)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [guidance, setGuidance] = useState<GuidancePack | null>(null)
  const [draft, setDraft] = useState<GuidanceDraft | null>(null)
  const [description, setDescription] = useState(task.description || task.title)
  const [locale, setLocale] = useState<GuidanceLocale>("en")
  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    if (!open || guidance || draft) return
    setLoading(true)
    apiFetch<{ data: { guidance: GuidancePack | null } }>(
      `/api/guidance?taskId=${encodeURIComponent(taskId)}`,
      { label: "Task guidance" }
    )
      .then((response) => setGuidance(response.data.guidance))
      .catch(() => setError("Guidance could not be loaded. You can still try again."))
      .finally(() => setLoading(false))
  }, [draft, guidance, open, taskId])

  const generate = async () => {
    if (!photo) {
      setError("Take or choose a photo first.")
      return
    }
    if (photo.size > 10 * 1024 * 1024) {
      setError("The photo must be smaller than 10 MB.")
      return
    }

    setGenerating(true)
    setError(undefined)
    try {
      const imageBase64 = await fileToDataUrl(photo)
      const response = await apiFetch<{ data: { draft: GuidanceDraft } }>(
        "/api/guidance/analyze",
        {
          method: "POST",
          body: {
            taskId,
            title: task.title,
            description,
            imageBase64,
            imageMimeType: photo.type,
            locale,
          },
          label: "Visual guidance",
        }
      )
      setDraft(response.data.draft)
    } catch {
      setError("Visual guidance is unavailable. Check the photo and AI configuration, then retry.")
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!draft || !photo) return
    setSaving(true)
    setError(undefined)
    try {
      const formData = new FormData()
      formData.append("file", photo)
      formData.append("category", "image")
      formData.append("resourceType", "task-guidance")
      formData.append("resourceId", taskId)
      const uploaded = await apiFetch<UploadResponse>("/api/uploads", {
        method: "POST",
        body: formData,
        label: "Guidance photo upload",
      })
      const response = await apiFetch<{ data: { guidance: GuidancePack } }>("/api/guidance", {
        method: "POST",
        body: {
          taskId,
          draft,
          source: {
            type: "photo",
            imageUrl: uploaded.file.url,
            mimeType: uploaded.file.mimeType,
            fileName: uploaded.file.originalName,
            description,
          },
        },
        label: "Task guidance",
      })
      setGuidance(response.data.guidance)
      setDraft(null)
    } catch {
      setError("The guidance could not be attached to this task. Please retry.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          data-testid={`task-guidance-${taskId}`}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Guidance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto border-border bg-card p-4 text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle>Guidance for {task.title}</DialogTitle>
          <DialogDescription>
            Use a photo and a clear description to get task-specific, reviewable steps.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : guidance ? (
          <GuidanceViewer
            key={`${guidance.id}-${guidance.version}`}
            guidance={guidance}
            imageUrl={guidance.source.imageUrl}
          />
        ) : draft ? (
          <div className="space-y-5">
            <GuidanceViewer
              key={`${draft.locale}-${draft.title}`}
              guidance={draft}
              imageUrl={previewUrl}
            />
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Change photo or description
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Attach to task
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <Label
                htmlFor={`guidance-photo-${taskId}`}
                className="flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center hover:border-primary/60"
              >
                {previewUrl ? (
                  <span className="relative block h-64 w-full">
                    <Image
                      src={previewUrl}
                      alt="Selected task reference"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span className="px-6">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                      <Camera className="h-7 w-7 text-primary" />
                    </span>
                    <span className="mt-4 block font-medium text-foreground">
                      Take or choose a photo
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      JPEG, PNG or WebP, up to 10 MB
                    </span>
                  </span>
                )}
              </Label>
              <input
                id={`guidance-photo-${taskId}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  setPhoto(event.target.files?.[0] ?? null)
                  setError(undefined)
                }}
              />
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor={`guidance-description-${taskId}`}>What needs to be done?</Label>
                <Textarea
                  id={`guidance-description-${taskId}`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  maxLength={2_000}
                  className="mt-2"
                  placeholder="Describe the damage, desired result, materials already available, and anything that must not be changed."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Include constraints such as drainage openings, fragile surfaces, or unavailable tools.
                </p>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-foreground">Guidance language</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["en", "af"] as GuidanceLocale[]).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={locale === option ? "default" : "outline"}
                      onClick={() => setLocale(option)}
                      aria-pressed={locale === option}
                    >
                      {option === "en" ? "English" : "Afrikaans"}
                    </Button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Review before starting
                </p>
                AI guidance is advisory. Stop for structural, electrical, gas, asbestos, or other
                hazardous work and ask a qualified person.
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="button"
                className="h-11 w-full"
                onClick={generate}
                disabled={generating || !photo || description.trim().length < 3}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-5 w-5" />
                )}
                Ask for visual guidance
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
