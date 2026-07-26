"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiFetch } from "@/lib/api-client"
import {
  GATE_ZERO_ID,
  GATE_ZERO_PROTOCOL_VERSION,
  getAllowedTransitions,
  type GateDecisionProjection,
  type GateDecisionStatus,
} from "@/lib/governance/gate-definitions"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

interface GovernanceResponse {
  data: {
    gate: { id: string; name: string; protocolVersion: string }
    decisions: GateDecisionProjection[]
    storage: "mongodb" | "memory"
  }
  summary: { total: number; active: number; approvedInPrinciple: number }
}

interface GovernanceForm {
  status: GateDecisionStatus
  rationale: string
  evidenceRefs: string
  reviewerCandidateId: string
  responsiblePartyId: string
  privacyReviewerId: string
  researchOwnerId: string
  restrictedStoreApproved: boolean
  authorizedResearcherIds: string
  retentionDeletionDeadline: string
  correctionDeletionOwnerId: string
  incidentOwnerId: string
}

const EMPTY_FORM: GovernanceForm = {
  status: "approved_in_principle",
  rationale: "",
  evidenceRefs: "",
  reviewerCandidateId: "",
  responsiblePartyId: "",
  privacyReviewerId: "",
  researchOwnerId: "",
  restrictedStoreApproved: false,
  authorizedResearcherIds: "",
  retentionDeletionDeadline: "",
  correctionDeletionOwnerId: "",
  incidentOwnerId: "",
}

const STATUS_LABELS: Record<GateDecisionStatus, string> = {
  approved_in_principle: "Approved in principle",
  active: "Active",
  rejected: "Rejected",
  superseded: "Superseded",
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.body === "object" && error.body !== null) {
    const body = error.body as { error?: unknown; missingPrerequisites?: unknown }
    if (typeof body.error === "string") {
      if (Array.isArray(body.missingPrerequisites)) {
        return `${body.error}: ${body.missingPrerequisites.join(", ")}`
      }
      return body.error
    }
  }
  return "The governance request could not be completed."
}

function statusBadge(status: GateDecisionStatus | null) {
  if (status === "active") return <Badge className="bg-emerald-600">Active</Badge>
  if (status === "approved_in_principle") {
    return <Badge className="bg-amber-600">Approved in principle</Badge>
  }
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>
  if (status === "superseded") return <Badge variant="secondary">Superseded</Badge>
  return <Badge variant="outline">Pending</Badge>
}

export default function GovernancePage() {
  const [response, setResponse] = useState<GovernanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<GateDecisionProjection | null>(null)
  const [form, setForm] = useState<GovernanceForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setResponse(
        await apiFetch<GovernanceResponse>("/api/governance/gates", {
          label: "GateGovernance",
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

  const availableStatuses = useMemo(
    () => getAllowedTransitions(selected?.current?.status ?? null),
    [selected]
  )

  const openDecision = (decision: GateDecisionProjection) => {
    const nextStatuses = getAllowedTransitions(decision.current?.status ?? null)
    setSelected(decision)
    setMutationError(null)
    setSavedMessage(null)
    setForm({ ...EMPTY_FORM, status: nextStatuses[0] ?? "approved_in_principle" })
  }

  const closeDecision = () => {
    if (submitting) return
    setSelected(null)
    setMutationError(null)
  }

  const submitDecision = async () => {
    if (!selected) return
    setSubmitting(true)
    setMutationError(null)
    try {
      const evidenceRefs = form.evidenceRefs
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
      const authorizedResearcherIds = form.authorizedResearcherIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)

      await apiFetch("/api/governance/gates", {
        method: "POST",
        label: "GateGovernanceMutation",
        body: {
          gateId: GATE_ZERO_ID,
          protocolVersion: GATE_ZERO_PROTOCOL_VERSION,
          decisionId: selected.definition.id,
          status: form.status,
          rationale: form.rationale,
          evidenceRefs,
          expectedVersion: selected.current?.version ?? 0,
          idempotencyKey: crypto.randomUUID(),
          prerequisites:
            selected.definition.id === "O5"
              ? { reviewerCandidateId: form.reviewerCandidateId || undefined }
              : selected.definition.id === "O6"
                ? {
                    responsiblePartyId: form.responsiblePartyId || undefined,
                    privacyReviewerId: form.privacyReviewerId || undefined,
                    researchOwnerId: form.researchOwnerId || undefined,
                    restrictedStoreApproved: form.restrictedStoreApproved,
                    authorizedResearcherIds,
                    retentionDeletionDeadline: form.retentionDeletionDeadline || undefined,
                    correctionDeletionOwnerId: form.correctionDeletionOwnerId || undefined,
                    incidentOwnerId: form.incidentOwnerId || undefined,
                  }
                : undefined,
        },
      })
      setSelected(null)
      setSavedMessage(`${selected.definition.id} decision recorded.`)
      await load()
    } catch (error) {
      setMutationError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout persona="hans">
      <div className="relative z-10 space-y-6" data-testid="gate-governance-page">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-foreground flex items-center gap-3 text-2xl font-bold sm:text-3xl">
              <ShieldCheck className="text-primary h-8 w-8" />
              Gate Governance
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              Record bounded owner decisions and activate them only when their prerequisites pass.
              Decisions never launch recruitment, messaging, payment, fieldwork, or Gate 1.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex gap-3 pt-6 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p>
              Store only pseudonymous IDs and non-sensitive evidence references here. Names, contact
              details, credentials, consent evidence, raw notes, and restricted-store details belong
              outside the general application datastore.
            </p>
          </CardContent>
        </Card>

        {savedMessage && (
          <div
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4" />
            {savedMessage}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16" role="status">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <span className="sr-only">Loading Gate decisions</span>
          </div>
        ) : loadError ? (
          <Card className="border-destructive/40">
            <CardContent className="space-y-4 pt-6">
              <p className="text-destructive" role="alert">
                {loadError}
              </p>
              <Button onClick={() => void load()}>Retry</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Decisions</CardDescription>
                  <CardTitle>{response?.summary.total ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Approved in principle</CardDescription>
                  <CardTitle>{response?.summary.approvedInPrinciple ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active</CardDescription>
                  <CardTitle>{response?.summary.active ?? 0}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {response?.data.decisions.map((decision) => (
                <Card
                  key={decision.definition.id}
                  data-testid={`gate-decision-${decision.definition.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>{decision.definition.id}</span>
                          <span>{decision.definition.title}</span>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {decision.definition.description}
                        </CardDescription>
                      </div>
                      {statusBadge(decision.current?.status ?? null)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {decision.definition.activationRequirements.length > 0 && (
                      <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm">
                        <p className="mb-2 font-medium">Activation prerequisites</p>
                        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                          {decision.definition.activationRequirements.map((requirement) => (
                            <li key={requirement}>{requirement}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {decision.current && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Clock3 className="h-4 w-4" />
                        Version {decision.current.version} recorded{" "}
                        {new Date(decision.current.createdAt).toLocaleString("en-ZA")}
                      </div>
                    )}

                    {decision.history.length > 0 && (
                      <details className="border-border rounded-lg border p-3 text-sm">
                        <summary className="flex cursor-pointer items-center gap-2 font-medium">
                          <History className="h-4 w-4" />
                          Immutable history ({decision.history.length})
                        </summary>
                        <ol className="mt-3 space-y-3">
                          {[...decision.history].reverse().map((event) => (
                            <li key={event.id} className="border-border border-l-2 pl-3">
                              <p className="font-medium">
                                v{event.version}: {STATUS_LABELS[event.status]}
                              </p>
                              <p className="text-muted-foreground">{event.rationale}</p>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}

                    <Button
                      onClick={() => openDecision(decision)}
                      disabled={
                        getAllowedTransitions(decision.current?.status ?? null).length === 0
                      }
                      data-testid={`record-decision-${decision.definition.id}`}
                    >
                      Record decision
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <Dialog open={selected !== null} onOpenChange={(open) => !open && closeDecision()}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selected?.definition.id}: {selected?.definition.title}
              </DialogTitle>
              <DialogDescription>
                The server records your authenticated admin account and rejects stale or incomplete
                activation attempts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="gate-status">Decision status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, status: value as GateDecisionStatus }))
                  }
                >
                  <SelectTrigger id="gate-status" data-testid="gate-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gate-rationale">Rationale or constraint</Label>
                <Textarea
                  id="gate-rationale"
                  value={form.rationale}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, rationale: event.target.value }))
                  }
                  maxLength={1000}
                  required
                  data-testid="gate-rationale"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gate-evidence">Non-sensitive evidence references</Label>
                <Textarea
                  id="gate-evidence"
                  value={form.evidenceRefs}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, evidenceRefs: event.target.value }))
                  }
                  placeholder="One reference per line"
                />
              </div>

              {selected?.definition.id === "O5" && form.status === "active" && (
                <div className="border-border space-y-2 rounded-lg border p-4">
                  <Label htmlFor="reviewer-candidate-id">Pseudonymous reviewer candidate ID</Label>
                  <Input
                    id="reviewer-candidate-id"
                    value={form.reviewerCandidateId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reviewerCandidateId: event.target.value,
                      }))
                    }
                    placeholder="R1"
                    data-testid="reviewer-candidate-id"
                  />
                </div>
              )}

              {selected?.definition.id === "O6" && form.status === "active" && (
                <div className="border-border grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  {[
                    ["responsiblePartyId", "Responsible party ID"],
                    ["privacyReviewerId", "Privacy/legal reviewer ID"],
                    ["researchOwnerId", "Research owner ID"],
                    ["correctionDeletionOwnerId", "Correction/deletion owner ID"],
                    ["incidentOwnerId", "Incident owner ID"],
                  ].map(([field, label]) => (
                    <div className="space-y-2" key={field}>
                      <Label htmlFor={field}>{label}</Label>
                      <Input
                        id={field}
                        value={form[field as keyof GovernanceForm] as string}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, [field]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor="authorizedResearcherIds">Authorized researcher IDs</Label>
                    <Input
                      id="authorizedResearcherIds"
                      value={form.authorizedResearcherIds}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          authorizedResearcherIds: event.target.value,
                        }))
                      }
                      placeholder="researcher-1, researcher-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retentionDeletionDeadline">Retention/deletion deadline</Label>
                    <Input
                      id="retentionDeletionDeadline"
                      type="date"
                      value={form.retentionDeletionDeadline}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          retentionDeletionDeadline: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <label className="flex items-center gap-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.restrictedStoreApproved}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          restrictedStoreApproved: event.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Restricted store approved (details held outside this application)
                  </label>
                </div>
              )}

              {mutationError && (
                <p className="text-destructive text-sm" role="alert">
                  {mutationError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDecision} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => void submitDecision()}
                disabled={submitting || form.rationale.trim().length < 3}
                data-testid="submit-gate-decision"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record immutable event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
