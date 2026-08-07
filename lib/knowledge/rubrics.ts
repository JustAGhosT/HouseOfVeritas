/**
 * House of Veritas — Knowledge base: process priority rubric (Tier 1).
 *
 * Thresholds live here as DATA with a documented "why" per band, mirroring
 * `lib/services/radar/rubrics.ts`. Derivation and worked examples:
 * `docs/specs/knowledge-base-process-rubric.md`.
 *
 * Band-table conventions (identical to Deal Radar):
 *  - "higher-is-better" tables are ordered by DESCENDING threshold; the first
 *    band whose threshold is <= the value wins.
 *  - "lower-is-better" tables are ordered by ASCENDING threshold; the first
 *    band whose threshold is >= the value wins.
 *  - Every table declares an explicit FLOOR for values below the smallest band
 *    (cf. `LAND_ERF_FLOOR`). Spec §8.4 found this missing: a once-per-decade
 *    candidate matched no `recurrence` band at all.
 *
 * The band scorers below intentionally duplicate the four-line helpers in
 * `lib/services/radar/scoring.ts` rather than importing them. Coupling the
 * estate knowledge base to the property deal tool buys nothing, and neither
 * copy is complex enough to drift meaningfully. Extracting a shared
 * `lib/scoring/bands.ts` is the follow-up if a third consumer appears.
 */

export interface ScoreBand {
  threshold: number
  score: number
}

/** Rand → integer cents. Monetary thresholds are always cents (ZAR). */
export const rands = (rand: number): number => Math.round(rand * 100)

/** Higher raw value = better. Bands descending; first threshold <= value wins. */
export function scoreHigherIsBetter(
  value: number,
  bands: readonly ScoreBand[],
  floor: number
): number {
  for (const band of bands) {
    if (value >= band.threshold) return band.score
  }
  return floor
}

/** Lower raw value = better. Bands ascending; first threshold >= value wins. */
export function scoreLowerIsBetter(
  value: number,
  bands: readonly ScoreBand[],
  floor: number
): number {
  for (const band of bands) {
    if (value <= band.threshold) return band.score
  }
  return floor
}

// ── Ordinal levels ───────────────────────────────────────────────────────────

export const CONSEQUENCE_LEVELS = [
  "compounding-structural",
  "compounding-asset",
  "degrading",
  "cosmetic",
  "none",
] as const
export type ConsequenceLevel = (typeof CONSEQUENCE_LEVELS)[number]

export const PERSONA_FIT_LEVELS = [
  "named-owner-routine",
  "named-owner-occasional",
  "shared",
  "unassigned",
  "outside-estate-roles",
] as const
export type PersonaFitLevel = (typeof PERSONA_FIT_LEVELS)[number]

export const ASSET_COVERAGE_LEVELS = [
  "owned-multiple",
  "owned-single",
  "planned",
  "not-owned",
] as const
export type AssetCoverageLevel = (typeof ASSET_COVERAGE_LEVELS)[number]

export const REPEATABILITY_LEVELS = [
  "deterministic",
  "parameterised",
  "diagnostic-branching",
  "case-by-case",
] as const
export type RepeatabilityLevel = (typeof REPEATABILITY_LEVELS)[number]

export const LOCALE_REACH_LEVELS = ["both-locales-planned", "en-sufficient", "af-gap"] as const
export type LocaleReachLevel = (typeof LOCALE_REACH_LEVELS)[number]

// ── Scored dimensions ────────────────────────────────────────────────────────

/**
 * recurrence — times per year the estate actually performs the task. Authoring
 * cost is paid once; value accrues per use.
 */
export const RECURRENCE_BANDS: readonly ScoreBand[] = [
  { threshold: 24, score: 10 }, // fortnightly+ — the entry pays for itself within a month
  { threshold: 12, score: 8 }, // monthly
  { threshold: 4, score: 6 }, // quarterly — routine enough to be forgotten between runs
  { threshold: 2, score: 4 }, // semi-annual
  { threshold: 1, score: 2 }, // annual — relearned each time, but slowly
]
/** Below annual there is almost nothing to amortise the authoring cost against. */
export const RECURRENCE_FLOOR = 1
/** More than daily is a capture error, not a real cadence (cf. MAX_PLAUSIBLE_ERF_M2). */
export const MAX_PLAUSIBLE_RECURRENCE = 365

/** costAvoided — cents saved per occurrence versus calling a trade. */
export const COST_AVOIDED_BANDS: readonly ScoreBand[] = [
  { threshold: rands(2_500), score: 10 }, // a full contractor visit with materials
  { threshold: rands(1_200), score: 8 }, // call-out plus an hour of labour
  { threshold: rands(600), score: 6 }, // around the typical SA trade call-out floor
  { threshold: rands(250), score: 4 }, // sub-call-out; convenience value only
  { threshold: rands(100), score: 2 }, // marginal
]
export const COST_AVOIDED_FLOOR = 1

/**
 * An unquantified saving must not read as an average one — mirrors
 * `FLIP_PCT_UNKNOWN_SUBSCORE`, which penalises an unknown flip margin to 3.
 */
export const COST_AVOIDED_UNKNOWN_SUBSCORE = 3

/** consequenceOfDelay — how fast unattended damage compounds. */
export const CONSEQUENCE_SUBSCORES: Record<ConsequenceLevel, number> = {
  "compounding-structural": 10, // damp into plaster/brick, roof leak — cost grows monthly
  "compounding-asset": 8, // pump, engine or battery destroyed by neglect
  degrading: 6, // garden loss, food spoilage — recoverable but real
  cosmetic: 4, // looks worse, works fine
  none: 2, // purely elective
}

/** personaFit — does a named persona actually own this work? */
export const PERSONA_FIT_SUBSCORES: Record<PersonaFitLevel, number> = {
  "named-owner-routine": 10, // inside charl/lucky/irma/hans's standing scope
  "named-owner-occasional": 8, // clearly theirs, but not weekly
  shared: 6, // two or more personas; entry needs an explicit owner
  unassigned: 3, // nobody currently does this
  "outside-estate-roles": 1, // would require hiring for it
}

/** assetCoverage — does the estate own the thing? */
export const ASSET_COVERAGE_SUBSCORES: Record<AssetCoverageLevel, number> = {
  "owned-multiple": 10, // one entry, many uses
  "owned-single": 8, // one asset on site
  planned: 5, // acquisition is on the roadmap
  "not-owned": 1, // speculative content
}

/** repeatability — how stable the steps are across instances. */
export const REPEATABILITY_SUBSCORES: Record<RepeatabilityLevel, number> = {
  deterministic: 10, // identical every time — tyre pressures, mix ratios
  parameterised: 8, // same steps, values vary by asset
  "diagnostic-branching": 6, // a tree, not a line — authorable but longer
  "case-by-case": 3, // belongs in a per-task guidance pack instead
}

/**
 * retrievability — will `rankKnowledge` actually surface it? Scored on the
 * vocabulary the entry can offer, because `WEIGHTS.symptomPhrase` (5) dominates
 * match scoring and the default `minScore` is 3. Both counts must clear a band
 * for it to win: a rich keyword list cannot rescue an entry with one symptom.
 */
export interface RetrievabilityBand {
  symptoms: number
  keywords: number
  score: number
}
export const RETRIEVABILITY_BANDS: readonly RetrievabilityBand[] = [
  { symptoms: 8, keywords: 10, score: 10 }, // matches loose natural phrasing
  { symptoms: 5, keywords: 8, score: 8 }, // clears minScore on a single symptom hit
  { symptoms: 3, keywords: 5, score: 6 }, // workable
  { symptoms: 1, keywords: 3, score: 4 }, // findable only by near-exact phrasing
]
export const RETRIEVABILITY_FLOOR = 1

/** authoringEffort — hours to draft AND verify sources. Lower-is-better. */
export const AUTHORING_EFFORT_BANDS: readonly ScoreBand[] = [
  { threshold: 2, score: 10 }, // single session
  { threshold: 4, score: 8 }, // half a day
  { threshold: 8, score: 6 }, // full day including source verification
  { threshold: 16, score: 4 }, // multi-day; needs its own task
  { threshold: 32, score: 2 }, // effectively a project
]
export const AUTHORING_EFFORT_FLOOR = 1

/** localeReach — Charl and Lucky are the personas most likely to need Afrikaans. */
export const LOCALE_REACH_SUBSCORES: Record<LocaleReachLevel, number> = {
  "both-locales-planned": 10, // EN + AF authored together, as the copper-pipe seed was
  "en-sufficient": 7, // audience for this entry reads English
  "af-gap": 3, // primary persona needs AF and it is not planned
}

// ── Facts, sub-scores, weights ───────────────────────────────────────────────

export interface KnowledgeCandidateFacts {
  /** Times per year the estate performs this. */
  recurrencePerYear: number
  /** Cents saved per occurrence vs a trade call-out; null when unquantified. */
  costAvoidedCents: number | null
  consequenceOfDelay: ConsequenceLevel
  personaFit: PersonaFitLevel
  assetCoverage: AssetCoverageLevel
  repeatability: RepeatabilityLevel
  /** Distinct symptom phrases the entry can offer to retrieval. */
  symptomCount: number
  /** Distinct retrieval keywords the entry can offer. */
  keywordCount: number
  authoringEffortHours: number
  localeReach: LocaleReachLevel
}

export interface KnowledgeSubScores {
  recurrence: number
  costAvoided: number
  consequenceOfDelay: number
  personaFit: number
  assetCoverage: number
  repeatability: number
  retrievability: number
  authoringEffort: number
  localeReach: number
}

export type KnowledgeWeights = Record<keyof KnowledgeSubScores, number>

/**
 * Default weights. Use-frequency and rand value are the heavy drivers; the rest
 * ask "is it really ours to do?". Callers may override — the reviewer workspace
 * is expected to re-weight, exactly as the Radar frontend does with
 * `DEFAULT_WEIGHTS`.
 */
export const DEFAULT_KNOWLEDGE_WEIGHTS: KnowledgeWeights = {
  recurrence: 3,
  costAvoided: 3,
  consequenceOfDelay: 2,
  personaFit: 2,
  assetCoverage: 2,
  repeatability: 1,
  retrievability: 1,
  authoringEffort: 1,
  localeReach: 1,
}

export const scoreRecurrence = (perYear: number): number =>
  scoreHigherIsBetter(
    Math.min(perYear, MAX_PLAUSIBLE_RECURRENCE),
    RECURRENCE_BANDS,
    RECURRENCE_FLOOR
  )

export const scoreCostAvoided = (cents: number | null): number =>
  cents == null
    ? COST_AVOIDED_UNKNOWN_SUBSCORE
    : scoreHigherIsBetter(cents, COST_AVOIDED_BANDS, COST_AVOIDED_FLOOR)

export const scoreAuthoringEffort = (hours: number): number =>
  scoreLowerIsBetter(hours, AUTHORING_EFFORT_BANDS, AUTHORING_EFFORT_FLOOR)

export function scoreRetrievability(symptomCount: number, keywordCount: number): number {
  for (const band of RETRIEVABILITY_BANDS) {
    if (symptomCount >= band.symptoms && keywordCount >= band.keywords) return band.score
  }
  return RETRIEVABILITY_FLOOR
}

/** A cadence above one-per-day is a capture error, not a real value (§5.1). */
export const isPlausibleRecurrence = (perYear: number): boolean =>
  Number.isFinite(perYear) && perYear >= 0 && perYear <= MAX_PLAUSIBLE_RECURRENCE

export function computeKnowledgeSubScores(facts: KnowledgeCandidateFacts): KnowledgeSubScores {
  return {
    recurrence: scoreRecurrence(facts.recurrencePerYear),
    costAvoided: scoreCostAvoided(facts.costAvoidedCents),
    consequenceOfDelay: CONSEQUENCE_SUBSCORES[facts.consequenceOfDelay],
    personaFit: PERSONA_FIT_SUBSCORES[facts.personaFit],
    assetCoverage: ASSET_COVERAGE_SUBSCORES[facts.assetCoverage],
    repeatability: REPEATABILITY_SUBSCORES[facts.repeatability],
    retrievability: scoreRetrievability(facts.symptomCount, facts.keywordCount),
    authoringEffort: scoreAuthoringEffort(facts.authoringEffortHours),
    localeReach: LOCALE_REACH_SUBSCORES[facts.localeReach],
  }
}

/** composite = sum(weight × subScore) / sum(weight), on the same 0–10 scale. */
export function computeKnowledgeComposite(
  subScores: KnowledgeSubScores,
  weights: KnowledgeWeights = DEFAULT_KNOWLEDGE_WEIGHTS
): number {
  let weighted = 0
  let total = 0
  for (const key of Object.keys(weights) as (keyof KnowledgeSubScores)[]) {
    weighted += weights[key] * subScores[key]
    total += weights[key]
  }
  return total === 0 ? 0 : weighted / total
}

// ── Priority bands ───────────────────────────────────────────────────────────

export const KNOWLEDGE_PRIORITIES = ["P0", "P1", "P2"] as const
export type KnowledgePriority = (typeof KNOWLEDGE_PRIORITIES)[number]

export const PRIORITY_BANDS: readonly { threshold: number; priority: KnowledgePriority }[] = [
  { threshold: 7.5, priority: "P0" }, // author now — next knowledge-base PR
  { threshold: 6.0, priority: "P1" }, // author this quarter
  { threshold: 4.5, priority: "P2" }, // backlog; revisit when the asset or persona changes
]

/** Below the lowest band the candidate is not worth authoring at all. */
export const PRIORITY_DECLINE_THRESHOLD = 4.5

/** Returns null when the composite falls below `PRIORITY_DECLINE_THRESHOLD`. */
export function resolvePriority(composite: number): KnowledgePriority | null {
  for (const band of PRIORITY_BANDS) {
    if (composite >= band.threshold) return band.priority
  }
  return null
}
