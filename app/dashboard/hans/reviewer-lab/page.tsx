"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError, apiFetch } from "@/lib/api-client"
import type {
  DomainSafetyCriticalGateId,
  DomainSafetyQualityId,
  DomainSafetyTrialEvaluation,
  DomainSafetyVariant,
} from "@/lib/reviewer-trials/domain-safety-trial"
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"

type GateResult = "pass" | "fail" | "not_tested"
type QualityResult = "clear" | "friction" | "failure" | "not_tested"
type FindingSeverity = "none" | "critical" | "high" | "medium" | "low"

interface LabDefinitionResponse {
  data: {
    schemaVersion: "domain-reviewer-lab-v1"
    packVersion: "DSR-SYNTH-001-v1"
    profileVersion: "za-domestic-drainage-v1"
    candidateId: "DSR-SIM-001"
    variants: Array<{ id: DomainSafetyVariant; title: string; description: string }>
    scenarioSteps: Array<{ id: string; title: string; body: string }>
    criticalGates: Array<{
      id: DomainSafetyCriticalGateId
      label: string
      description: string
    }>
    qualityDimensions: Array<{ id: DomainSafetyQualityId; label: string }>
    findingCategories: string[]
    provider: {
      id: "pirb"
      name: string
      integrationStatus: "manual_preview_only"
      verificationPerformed: false
      officialUrl: string
    }
  }
  summary: {
    mode: "synthetic_rehearsal"
    persisted: false
    externalEffects: false
    pirbEligibility: "not_evaluated"
    o5Activation: false
  }
}

interface EvaluationResponse {
  data: { evaluation: DomainSafetyTrialEvaluation }
  summary: { accepted: boolean; persisted: false; externalEffects: false }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && typeof error.body === "object" && error.body !== null) {
    const body = error.body as { error?: unknown }
    if (typeof body.error === "string") return body.error
  }
  return "The synthetic rehearsal could not be evaluated."
}

function resultClasses(result: GateResult | QualityResult) {
  if (result === "pass" || result === "clear") return "border-emerald-500/30 bg-emerald-500/5"
  if (result === "fail" || result === "failure") return "border-red-500/30 bg-red-500/5"
  if (result === "friction") return "border-amber-500/30 bg-amber-500/5"
  return "border-border"
}

export default function ReviewerLabPage() {
  const [definition, setDefinition] = useState<LabDefinitionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [variant, setVariant] = useState<DomainSafetyVariant>("A")
  const [criticalGates, setCriticalGates] = useState<Record<string, GateResult>>({})
  const [qualityDimensions, setQualityDimensions] = useState<Record<string, QualityResult>>({})
  const [findingSeverity, setFindingSeverity] = useState<FindingSeverity>("none")
  const [findingCategory, setFindingCategory] = useState("unsafe_authority_inference")
  const [findingStep, setFindingStep] = useState("classify")
  const [reproducibility, setReproducibility] = useState<
    "single" | "variant_specific" | "repeated"
  >("variant_specific")
  const [acknowledgements, setAcknowledgements] = useState([false, false, false])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<DomainSafetyTrialEvaluation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setDefinition(null)
    setVariant("A")
    setCriticalGates({})
    setQualityDimensions({})
    setFindingSeverity("none")
    setFindingCategory("unsafe_authority_inference")
    setFindingStep("classify")
    setReproducibility("variant_specific")
    setAcknowledgements([false, false, false])
    setSubmitting(false)
    setSubmitError(null)
    setEvaluation(null)
    try {
      const response = await apiFetch<LabDefinitionResponse>("/api/reviewer-trials/domain-safety", {
        label: "DomainReviewerLab",
      })
      setDefinition(response)
      setCriticalGates(
        Object.fromEntries(response.data.criticalGates.map(({ id }) => [id, "not_tested"]))
      )
      setQualityDimensions(
        Object.fromEntries(response.data.qualityDimensions.map(({ id }) => [id, "not_tested"]))
      )
      setFindingCategory(response.data.findingCategories[0] ?? "unsafe_authority_inference")
      setFindingStep(response.data.scenarioSteps[0]?.id ?? "classify")
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedVariant = useMemo(
    () => definition?.data.variants.find((item) => item.id === variant),
    [definition, variant]
  )
  const canSubmit = acknowledgements.every(Boolean) && definition !== null && !submitting

  const submitRehearsal = async () => {
    if (!definition) return
    setSubmitting(true)
    setSubmitError(null)
    setEvaluation(null)
    try {
      const response = await apiFetch<EvaluationResponse>("/api/reviewer-trials/domain-safety", {
        method: "POST",
        label: "DomainReviewerLabEvaluation",
        body: {
          schemaVersion: definition.data.schemaVersion,
          mode: "synthetic_rehearsal",
          candidateId: definition.data.candidateId,
          packVersion: definition.data.packVersion,
          profileVersion: definition.data.profileVersion,
          variant,
          dataClass: "synthetic",
          pirbVerification: { mode: "manual_preview_only", status: "not_performed" },
          externalEffects: {
            contacted: false,
            invited: false,
            recorded: false,
            paid: false,
            posted: false,
            productionAccess: false,
            registryCall: false,
          },
          criticalGates,
          qualityDimensions,
          finding:
            findingSeverity === "none"
              ? null
              : {
                  scenarioStep: findingStep,
                  category: findingCategory,
                  severity: findingSeverity,
                  reproducibility,
                },
        },
      })
      setEvaluation(response.data.evaluation)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout persona="hans">
      <div className="relative z-10 space-y-6" data-testid="domain-reviewer-lab-page">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-foreground flex items-center gap-3 text-2xl font-bold sm:text-3xl">
              <FlaskConical className="text-primary h-8 w-8" />
              Domain Reviewer Lab
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              Rehearse the synthetic South African plumbing-review contract before any PIRB
              verification, candidate contact, or Gate activation.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Reset rehearsal
          </Button>
        </div>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex gap-3 pt-6 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium">Internal synthetic testing only</p>
              <p className="text-muted-foreground mt-1">
                Do not enter a name, contact detail, PIRB number, credential artifact, raw note,
                recording, address, or real household evidence. This surface stores nothing and
                cannot appoint a reviewer or activate O5.
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-16" role="status">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <span className="sr-only">Loading synthetic reviewer lab</span>
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
        ) : definition ? (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Trial pack</CardDescription>
                  <CardTitle className="text-lg">{definition.data.packVersion}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  Profile {definition.data.profileVersion}; fixed synthetic candidate{" "}
                  {definition.data.candidateId}.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>PIRB integration</CardDescription>
                  <CardTitle className="text-lg">Manual preview only</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    No registry request or verification has been performed.
                  </p>
                  <a
                    href={definition.data.provider.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 underline"
                  >
                    Official PIRB site <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Runtime effects</CardDescription>
                  <CardTitle className="text-lg">None</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">Ephemeral</Badge>
                  <Badge variant="outline">No contact</Badge>
                  <Badge variant="outline">No O5 activation</Badge>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="h-5 w-5" /> Choose the first-exposure variant
                </CardTitle>
                <CardDescription>
                  The assigned variant is shown before the scenario; the baseline must not prime the
                  rehearsal.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {definition.data.variants.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setVariant(item.id)
                      setEvaluation(null)
                    }}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      variant === item.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                    aria-pressed={variant === item.id}
                    data-testid={`reviewer-variant-${item.id}`}
                  >
                    <span className="font-semibold">
                      Variant {item.id}: {item.title}
                    </span>
                    <span className="text-muted-foreground mt-2 block text-sm">
                      {item.description}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-primary/30">
              <CardHeader>
                <CardDescription>Assigned injection</CardDescription>
                <CardTitle>{selectedVariant?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{selectedVariant?.description}</p>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {definition.data.scenarioSteps.map((step, index) => (
                <Card key={step.id} data-testid={`reviewer-step-${step.id}`}>
                  <CardHeader>
                    <CardDescription>Step {index + 1}</CardDescription>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">{step.body}</CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Critical-gate rehearsal</CardTitle>
                <CardDescription>
                  These are simulated workflow outcomes, not candidate evidence or eligibility.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {definition.data.criticalGates.map((gate) => {
                  const result = criticalGates[gate.id] ?? "not_tested"
                  return (
                    <div
                      key={gate.id}
                      className={`grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_180px] ${resultClasses(result)}`}
                    >
                      <div>
                        <p className="font-medium">{gate.label}</p>
                        <p className="text-muted-foreground text-sm">{gate.description}</p>
                      </div>
                      <label className="text-sm">
                        <span className="sr-only">{gate.label} result</span>
                        <select
                          value={result}
                          onChange={(event) =>
                            setCriticalGates((current) => ({
                              ...current,
                              [gate.id]: event.target.value as GateResult,
                            }))
                          }
                          className="border-input bg-background h-10 w-full rounded-md border px-3"
                          data-testid={`critical-gate-${gate.id}`}
                        >
                          <option value="not_tested">Not tested</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                        </select>
                      </label>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quality dimensions</CardTitle>
                <CardDescription>
                  Capture bounded categories only; do not enter raw notes.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {definition.data.qualityDimensions.map((dimension) => {
                  const result = qualityDimensions[dimension.id] ?? "not_tested"
                  return (
                    <label
                      key={dimension.id}
                      className={`rounded-lg border p-4 ${resultClasses(result)}`}
                    >
                      <span className="mb-2 block font-medium">{dimension.label}</span>
                      <select
                        value={result}
                        onChange={(event) =>
                          setQualityDimensions((current) => ({
                            ...current,
                            [dimension.id]: event.target.value as QualityResult,
                          }))
                        }
                        className="border-input bg-background h-10 w-full rounded-md border px-3"
                        data-testid={`quality-dimension-${dimension.id}`}
                      >
                        <option value="not_tested">Not tested</option>
                        <option value="clear">Clear</option>
                        <option value="friction">Friction</option>
                        <option value="failure">Failure</option>
                      </select>
                    </label>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optional minimized finding</CardTitle>
                <CardDescription>
                  Select categories only. The surface intentionally has no free-text field.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Severity</span>
                  <select
                    value={findingSeverity}
                    onChange={(event) => setFindingSeverity(event.target.value as FindingSeverity)}
                    className="border-input bg-background h-10 w-full rounded-md border px-3"
                    data-testid="finding-severity"
                  >
                    <option value="none">No finding</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Step</span>
                  <select
                    value={findingStep}
                    onChange={(event) => setFindingStep(event.target.value)}
                    className="border-input bg-background h-10 w-full rounded-md border px-3"
                    disabled={findingSeverity === "none"}
                  >
                    {definition.data.scenarioSteps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Category</span>
                  <select
                    value={findingCategory}
                    onChange={(event) => setFindingCategory(event.target.value)}
                    className="border-input bg-background h-10 w-full rounded-md border px-3"
                    disabled={findingSeverity === "none"}
                  >
                    {definition.data.findingCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-2 block font-medium">Reproducibility</span>
                  <select
                    value={reproducibility}
                    onChange={(event) =>
                      setReproducibility(
                        event.target.value as "single" | "variant_specific" | "repeated"
                      )
                    }
                    className="border-input bg-background h-10 w-full rounded-md border px-3"
                    disabled={findingSeverity === "none"}
                  >
                    <option value="single">Single</option>
                    <option value="variant_specific">Variant specific</option>
                    <option value="repeated">Repeated</option>
                  </select>
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fail-closed acknowledgements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Every person, provider, location, observation, and attachment in this rehearsal is fictional.",
                  "No registry call, candidate contact, invitation, recording, payment, posting, production access, or persistence will occur.",
                  "The result is not participant, usability, market, safety, PIRB eligibility, or Gate evidence.",
                ].map((label, index) => (
                  <label key={label} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={acknowledgements[index]}
                      onChange={(event) =>
                        setAcknowledgements((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index ? event.target.checked : value
                          )
                        )
                      }
                      data-testid={`lab-acknowledgement-${index + 1}`}
                    />
                    {label}
                  </label>
                ))}
                {submitError && (
                  <p className="text-destructive text-sm" role="alert">
                    {submitError}
                  </p>
                )}
                <Button
                  onClick={() => void submitRehearsal()}
                  disabled={!canSubmit}
                  data-testid="evaluate-domain-rehearsal"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Evaluate synthetic rehearsal
                </Button>
              </CardContent>
            </Card>

            {evaluation && (
              <Card className="border-emerald-500/30" data-testid="domain-rehearsal-result">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {evaluation.disposition === "ready_for_internal_replay" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-amber-500" />
                    )}
                    {evaluation.disposition.replaceAll("_", " ")}
                  </CardTitle>
                  <CardDescription>
                    Variant {evaluation.variant}; reliance {evaluation.reliance}; PIRB eligibility{" "}
                    {evaluation.pirbEligibility.replaceAll("_", " ")}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">Not persisted</Badge>
                  <Badge variant="outline">No external effects</Badge>
                  <Badge variant="outline">O5 inactive</Badge>
                  <Badge variant="outline">
                    {evaluation.incompleteCriticalGates.length} critical gates incomplete
                  </Badge>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
