"use client"

import { useCallback, useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiFetch } from "@/lib/api-client"
import {
  KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
  type KnowledgeSafeguardProfileProjection,
} from "@/lib/knowledge/safeguard-profile-events"
import type { KnowledgeSafeguard, KnowledgeSafeguardId } from "@/lib/knowledge/safeguards"
import { AlertTriangle, History, Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react"

interface ProfileProjection extends KnowledgeSafeguardProfileProjection {
  relaxedBeyondBuiltin: KnowledgeSafeguardId[]
}

interface SafeguardProfilesResponse {
  data: {
    safeguards: KnowledgeSafeguard[]
    nonWaivableSafeguards: KnowledgeSafeguardId[]
    profiles: ProfileProjection[]
    storage: "mongodb" | "memory"
  }
  summary: { total: number; stored: number; deviating: number }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.body === "object" && error.body !== null) {
    const body = error.body as { error?: unknown; messages?: unknown }
    if (typeof body.error === "string") {
      if (Array.isArray(body.messages) && body.messages.length > 0) {
        return `${body.error}: ${body.messages.join("; ")}`
      }
      return body.error
    }
  }
  return "The safeguard profile request could not be completed."
}

function sourceBadge(source: ProfileProjection["source"]) {
  if (source === "stored") return <Badge className="bg-amber-600">Administrator-set</Badge>
  if (source === "builtin-fallback") return <Badge variant="destructive">Outage fallback</Badge>
  return <Badge variant="secondary">Built-in default</Badge>
}

export default function KnowledgeSafeguardsPage() {
  const [response, setResponse] = useState<SafeguardProfilesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProfileProjection | null>(null)
  const [disabled, setDisabled] = useState<KnowledgeSafeguardId[]>([])
  const [rationale, setRationale] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setResponse(
        await apiFetch<SafeguardProfilesResponse>("/api/knowledge/safeguard-profiles", {
          label: "KnowledgeSafeguardProfiles",
        })
      )
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openProfile = (profile: ProfileProjection) => {
    setSelected(profile)
    setDisabled([...profile.effective.disabledSafeguards])
    setRationale("")
    setMutationError(null)
    setSavedMessage(null)
  }

  const toggleSafeguard = (id: KnowledgeSafeguardId, checked: boolean) => {
    setDisabled((current) =>
      checked ? current.filter((safeguard) => safeguard !== id) : [...new Set([...current, id])]
    )
  }

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    setMutationError(null)
    try {
      await apiFetch("/api/knowledge/safeguard-profiles", {
        method: "POST",
        label: "KnowledgeSafeguardProfileMutation",
        body: {
          schemaVersion: KNOWLEDGE_SAFEGUARD_PROFILE_SCHEMA_VERSION,
          profileId: selected.profileId,
          label: selected.effective.label,
          description: selected.effective.description,
          disabledSafeguards: disabled,
          rationale,
          expectedVersion: selected.current?.version ?? 0,
          idempotencyKey: crypto.randomUUID(),
        },
      })
      setSelected(null)
      setSavedMessage(`Recorded a new version of "${selected.profileId}".`)
      await load()
    } catch (error) {
      setMutationError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const safeguards = response?.data.safeguards ?? []

  return (
    <DashboardLayout persona="hans">
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6" />
              Knowledge publication safeguards
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
              Which admission checks a process must clear before it can be published to the
              knowledge base. Every change is recorded as an append-only event with your user ID, a
              rationale and a version — switching a safeguard off is a decision, not a setting.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </header>

        {savedMessage && (
          <p className="rounded-md border border-emerald-600/40 bg-emerald-600/10 p-3 text-sm">
            {savedMessage}
          </p>
        )}
        {loadError && (
          <p className="border-destructive/40 bg-destructive/10 rounded-md border p-3 text-sm">
            {loadError}
          </p>
        )}

        {response && (
          <p className="text-muted-foreground text-sm" data-testid="safeguard-profile-summary">
            {response.summary.total} profiles · {response.summary.stored} administrator-set ·{" "}
            {response.summary.deviating} deviating from the built-in default · storage:{" "}
            {response.data.storage}
          </p>
        )}

        <p
          className="rounded-md border border-sky-600/40 bg-sky-600/10 p-3 text-sm"
          data-testid="safeguard-enforcement-notice"
        >
          <strong>Live.</strong> These profiles are checked by <code>/api/knowledge/apply</code>{" "}
          every time an entry is turned into a task, so tightening a safeguard here takes effect
          immediately — no deploy. Entries are separately checked against their built-in profile
          when the seed loads, so one that never cleared its safeguards cannot ship in the first
          place.
        </p>

        {response && response.data.nonWaivableSafeguards.length > 0 && (
          <Card className="border-amber-600/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" />
                Safeguards that cannot be switched off
              </CardTitle>
              <CardDescription>
                These encode obligations rather than editorial policy, so no profile — and no
                administrator — may waive them. The API rejects any attempt.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {response.data.nonWaivableSafeguards.map((id) => (
                <Badge key={id} variant="outline">
                  {safeguards.find((safeguard) => safeguard.id === id)?.label ?? id}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {response?.data.profiles.map((profile) => (
            <Card key={profile.profileId} data-testid={`safeguard-profile-${profile.profileId}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{profile.effective.label}</CardTitle>
                    <CardDescription>{profile.effective.description}</CardDescription>
                  </div>
                  {sourceBadge(profile.source)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.relaxedBeyondBuiltin.length > 0 && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-600/10 p-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Relaxed beyond the built-in default:{" "}
                      {profile.relaxedBeyondBuiltin
                        .map(
                          (id) => safeguards.find((safeguard) => safeguard.id === id)?.label ?? id
                        )
                        .join(", ")}
                    </span>
                  </p>
                )}

                <ul className="space-y-1 text-sm">
                  {safeguards.map((safeguard) => {
                    const off = profile.effective.disabledSafeguards.includes(safeguard.id)
                    return (
                      <li key={safeguard.id} className="flex items-center justify-between gap-2">
                        <span className={off ? "text-muted-foreground line-through" : ""}>
                          {safeguard.label}
                        </span>
                        {off ? (
                          <Badge variant="outline">Skipped</Badge>
                        ) : (
                          <Badge variant="secondary">Runs</Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <History className="h-3 w-3" />
                    {profile.history.length} recorded change
                    {profile.history.length === 1 ? "" : "s"}
                    {profile.current ? ` · v${profile.current.version}` : ""}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openProfile(profile)}>
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Change &ldquo;{selected?.profileId}&rdquo;</DialogTitle>
              <DialogDescription>
                Unticking a safeguard means it will not run for this profile. Skipped safeguards are
                recorded as skipped on every evaluation — they never count as having passed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                {safeguards.map((safeguard) => {
                  const locked = !safeguard.waivable
                  return (
                    <div key={safeguard.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`safeguard-${safeguard.id}`}
                        checked={locked || !disabled.includes(safeguard.id)}
                        disabled={locked}
                        onCheckedChange={(checked) =>
                          toggleSafeguard(safeguard.id, checked === true)
                        }
                      />
                      <Label htmlFor={`safeguard-${safeguard.id}`} className="text-sm leading-snug">
                        <span className="flex items-center gap-1 font-medium">
                          {safeguard.label}
                          {locked && <Lock className="h-3 w-3" />}
                        </span>
                        <span className="text-muted-foreground block font-normal">
                          {safeguard.description}
                        </span>
                      </Label>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-1">
                <Label htmlFor="safeguard-rationale">Rationale</Label>
                <Textarea
                  id="safeguard-rationale"
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  placeholder="Why is this the right configuration? Recorded against your user ID."
                  rows={3}
                />
              </div>

              {mutationError && (
                <p className="border-destructive/40 bg-destructive/10 rounded-md border p-2 text-sm">
                  {mutationError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setSelected(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={submitting || rationale.trim().length < 3}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record change
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
