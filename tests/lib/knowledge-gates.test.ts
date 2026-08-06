import { describe, it, expect } from "vitest"
import {
  CHECKLIST_GATE_PROFILE,
  enabledGates,
  evaluateKnowledgeCandidate,
  getGateProfile,
  getKnowledgeGate,
  isGateEnabled,
  KNOWLEDGE_GATE_IDS,
  KNOWLEDGE_PUBLICATION_GATES,
  NON_WAIVABLE_GATE_IDS,
  knowledgeCandidateSubmissionSchema,
  parseKnowledgeCandidateSubmission,
  RECIPE_GATE_PROFILE,
  STRICT_GATE_PROFILE,
  withGateDisabled,
  withGateEnabled,
  type KnowledgeCandidateSubmission,
  type KnowledgeGateId,
  type KnowledgeGateResult,
} from "@/lib/knowledge/gates"
import type { KnowledgeCandidateFacts } from "@/lib/knowledge/rubrics"

/** All gates pass unless overridden — keeps each fixture to its own point. */
function gatesAllPass(
  overrides: Partial<Record<KnowledgeGateId, KnowledgeGateResult>> = {}
): Record<KnowledgeGateId, KnowledgeGateResult> {
  const base = Object.fromEntries(KNOWLEDGE_GATE_IDS.map((id) => [id, "pass"])) as Record<
    KnowledgeGateId,
    KnowledgeGateResult
  >
  return { ...base, ...overrides }
}

function submission(
  candidateId: string,
  gateResults: Partial<Record<KnowledgeGateId, KnowledgeGateResult>>,
  facts: KnowledgeCandidateFacts | null = null
): KnowledgeCandidateSubmission {
  return { candidateId, gateResults, facts }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Spec §8.1 — the shipped reference entry. Composite 8.0. */
const COPPER_PIPE_FACTS: KnowledgeCandidateFacts = {
  recurrencePerYear: 4,
  costAvoidedCents: 90_000, // ~R900 plumber call-out
  consequenceOfDelay: "compounding-structural",
  personaFit: "named-owner-routine",
  assetCoverage: "owned-multiple",
  repeatability: "diagnostic-branching",
  symptomCount: 11,
  keywordCount: 15,
  authoringEffortHours: 8,
  localeReach: "both-locales-planned",
}

/** Spec §8.4 — passes every gate, declines on worth. Composite 3.69. */
const WELDER_SELECTION_FACTS: KnowledgeCandidateFacts = {
  recurrencePerYear: 0.1, // once per decade — below the lowest band
  costAvoidedCents: null, // a purchase, not a saving
  consequenceOfDelay: "none",
  personaFit: "shared",
  assetCoverage: "not-owned",
  repeatability: "deterministic",
  symptomCount: 2,
  keywordCount: 6,
  authoringEffortHours: 4,
  localeReach: "en-sufficient",
}

describe("knowledge gate catalogue", () => {
  it("declares every id exactly once", () => {
    const ids = KNOWLEDGE_PUBLICATION_GATES.map((gate) => gate.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.slice().sort()).toEqual(KNOWLEDGE_GATE_IDS.slice().sort())
  })

  it("has every gate on by default — nothing is opt-in", () => {
    expect(enabledGates(STRICT_GATE_PROFILE)).toHaveLength(KNOWLEDGE_GATE_IDS.length)
    // A profile authored without thinking about gates still runs all of them,
    // so a gate added later cannot silently skip existing profiles.
    const naive = { id: "naive", label: "", description: "", disabledGates: [] }
    expect(enabledGates(naive).map((gate) => gate.id)).toEqual([...KNOWLEDGE_GATE_IDS])
  })

  it("reserves the decline failure mode for ungroundable content only", () => {
    const declining = KNOWLEDGE_PUBLICATION_GATES.filter((g) => g.failureMode === "decline")
    expect(declining.map((g) => g.id)).toEqual(["verifiable_ground_truth"])
  })
})

describe("gate profiles are selectable and toggleable", () => {
  it("resolves named profiles and rejects unknown ones", () => {
    expect(getGateProfile("strict")).toEqual(STRICT_GATE_PROFILE)
    expect(getGateProfile("household-recipe")).toEqual(RECIPE_GATE_PROFILE)
    expect(getGateProfile("nope")).toBeNull()
  })

  it("disables only what a profile names", () => {
    expect(isGateEnabled(RECIPE_GATE_PROFILE, "statutory_competence")).toBe(false)
    expect(isGateEnabled(RECIPE_GATE_PROFILE, "irreversible_harm")).toBe(true)
    expect(isGateEnabled(CHECKLIST_GATE_PROFILE, "diagnosis_before_action")).toBe(false)
    expect(isGateEnabled(CHECKLIST_GATE_PROFILE, "statutory_competence")).toBe(true)
  })

  it("toggles without mutating the source profile", () => {
    const off = withGateDisabled(STRICT_GATE_PROFILE, "commercial_neutrality")
    expect(isGateEnabled(off, "commercial_neutrality")).toBe(false)
    expect(isGateEnabled(STRICT_GATE_PROFILE, "commercial_neutrality")).toBe(true)
    expect(STRICT_GATE_PROFILE.disabledGates).toHaveLength(0)

    const backOn = withGateEnabled(off, "commercial_neutrality")
    expect(isGateEnabled(backOn, "commercial_neutrality")).toBe(true)
  })

  it("is idempotent in both directions", () => {
    // Uses a waivable gate deliberately: disabling a non-waivable one is a
    // no-op, which would make this pass without exercising anything.
    const once = withGateDisabled(STRICT_GATE_PROFILE, "irreversible_harm")
    expect(once).not.toBe(STRICT_GATE_PROFILE)
    expect(withGateDisabled(once, "irreversible_harm")).toBe(once)
    expect(withGateEnabled(STRICT_GATE_PROFILE, "irreversible_harm")).toBe(STRICT_GATE_PROFILE)
  })

  it("treats disabling a non-waivable gate as a no-op", () => {
    for (const id of NON_WAIVABLE_GATE_IDS) {
      expect(withGateDisabled(STRICT_GATE_PROFILE, id)).toBe(STRICT_GATE_PROFILE)
    }
  })
})

describe("the welding trio — three dispositions from one topic", () => {
  it("'how to weld safely' re-scopes to a safety entry (single rescope-mode gate)", () => {
    const result = evaluateKnowledgeCandidate(
      submission("weld-safely", gatesAllPass({ irreversible_harm: "fail" }), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("rescope_as_safety")
    expect(result.failedGates).toEqual(["irreversible_harm"])
    // Never scored: a high composite must not read as mitigating an unsafe entry.
    expect(result.composite).toBeNull()
    expect(result.priority).toBeNull()
  })

  it("'how to build a welder' declines outright (ungroundable)", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "build-a-welder",
        gatesAllPass({ irreversible_harm: "fail", verifiable_ground_truth: "fail" })
      )
    )
    expect(result.disposition).toBe("decline_unsafe")
    expect(result.failedGates).toContain("verifiable_ground_truth")
    expect(result.composite).toBeNull()
  })

  it("'which welder to buy' passes every gate and declines on worth", () => {
    const result = evaluateKnowledgeCandidate(
      submission("welder-selection", gatesAllPass(), WELDER_SELECTION_FACTS)
    )
    expect(result.failedGates).toHaveLength(0)
    expect(result.disposition).toBe("decline_not_worthwhile")
    expect(result.composite).toBeCloseTo(3.69, 2)
    expect(result.priority).toBeNull()
  })

  it("distinguishes the two declines — they are not the same record", () => {
    const unsafe = evaluateKnowledgeCandidate(
      submission("build-a-welder", gatesAllPass({ verifiable_ground_truth: "fail" }))
    )
    const notWorth = evaluateKnowledgeCandidate(
      submission("welder-selection", gatesAllPass(), WELDER_SELECTION_FACTS)
    )
    expect(unsafe.disposition).not.toBe(notWorth.disposition)
    // The worth-based decline is revisitable: buying the welder flips it.
    const owned = evaluateKnowledgeCandidate(
      submission("welder-selection", gatesAllPass(), {
        ...WELDER_SELECTION_FACTS,
        assetCoverage: "owned-single",
        recurrencePerYear: 4,
        personaFit: "named-owner-occasional",
      })
    )
    expect(owned.composite!).toBeGreaterThan(notWorth.composite!)
  })
})

describe("dispositions the spec does not walk through", () => {
  it("scores the shipped copper-pipe entry at P0", () => {
    const result = evaluateKnowledgeCandidate(
      submission("copper-pipe", gatesAllPass(), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("author")
    expect(result.composite).toBeCloseTo(8.0, 5)
    expect(result.priority).toBe("P0")
  })

  it("re-scopes on statutory competence — a different gate from irreversible harm", () => {
    const result = evaluateKnowledgeCandidate(
      submission("db-board-work", gatesAllPass({ statutory_competence: "fail" }), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("rescope_as_safety")
    expect(result.failedGates).toEqual(["statutory_competence"])
  })

  it("holds at draft when a gate was never tested", () => {
    const result = evaluateKnowledgeCandidate(
      submission("half-reviewed", gatesAllPass({ data_boundary: "not_tested" }), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.untestedGates).toEqual(["data_boundary"])
  })

  it("treats an omitted gate result as not_tested, never as a pass", () => {
    const partial = gatesAllPass()
    delete (partial as Record<string, unknown>).commercial_neutrality
    const result = evaluateKnowledgeCandidate(
      submission("omitted-gate", partial, COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.untestedGates).toEqual(["commercial_neutrality"])
  })

  it("holds at draft when gates clear but Tier-1 facts are missing", () => {
    const result = evaluateKnowledgeCandidate(submission("no-facts", gatesAllPass(), null))
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.subScores).toBeNull()
  })

  it("prioritises Tier 0 over Tier 1 — an unsafe candidate is never scored", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "unsafe-but-valuable",
        gatesAllPass({ irreversible_harm: "fail" }),
        COPPER_PIPE_FACTS
      )
    )
    expect(result.subScores).toBeNull()
    expect(result.composite).toBeNull()
  })
})

describe("a disabled gate is recorded, never silently passed", () => {
  it("lists profile-disabled gates as skipped rather than folding them into passes", () => {
    const result = evaluateKnowledgeCandidate(
      submission("recipe-entry", gatesAllPass(), COPPER_PIPE_FACTS),
      { profile: RECIPE_GATE_PROFILE }
    )
    expect(result.profileId).toBe("household-recipe")
    expect(result.skippedGates.slice().sort()).toEqual(
      ["diagnosis_before_action", "statutory_competence"].sort()
    )
    expect(result.failedGates).toHaveLength(0)
    expect(result.disposition).toBe("author")
  })

  it("ignores a result submitted for a gate the profile disabled", () => {
    // statutory_competence is off for recipes; a stray "fail" must not block.
    const result = evaluateKnowledgeCandidate(
      submission("recipe-entry", gatesAllPass({ statutory_competence: "fail" }), COPPER_PIPE_FACTS),
      { profile: RECIPE_GATE_PROFILE }
    )
    expect(result.disposition).toBe("author")
    expect(result.failedGates).toHaveLength(0)
    expect(result.skippedGates).toContain("statutory_competence")
  })

  it("still fails on a gate the profile leaves enabled", () => {
    const result = evaluateKnowledgeCandidate(
      submission("allergen-recipe", gatesAllPass({ irreversible_harm: "fail" }), COPPER_PIPE_FACTS),
      { profile: RECIPE_GATE_PROFILE }
    )
    expect(result.disposition).toBe("rescope_as_safety")
  })

  it("treats an explicit not_applicable as untested, not as a pass", () => {
    const result = evaluateKnowledgeCandidate(
      submission("sneaky", gatesAllPass({ data_boundary: "not_applicable" }), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.untestedGates).toEqual(["data_boundary"])
  })

  it("cannot disable the non-waivable gates, however the profile is built", () => {
    // The schema and the store-read sanitiser both guard this, but neither sees
    // a profile assembled in code — so the evaluator has to hold the line too.
    let profile = STRICT_GATE_PROFILE
    for (const id of KNOWLEDGE_GATE_IDS) profile = withGateDisabled(profile, id)

    for (const id of NON_WAIVABLE_GATE_IDS) {
      expect(profile.disabledGates).not.toContain(id)
      expect(isGateEnabled(profile, id)).toBe(true)
    }
    expect(
      enabledGates(profile)
        .map((gate) => gate.id)
        .sort()
    ).toEqual([...NON_WAIVABLE_GATE_IDS].sort())
  })

  it("ignores a hand-built profile that names a non-waivable gate directly", () => {
    // Bypasses withGateDisabled() entirely — the object literal a caller could
    // construct, or a stored record that reached the evaluator unsanitised.
    const rogue = {
      id: "rogue",
      label: "",
      description: "",
      disabledGates: [...KNOWLEDGE_GATE_IDS],
    }
    const result = evaluateKnowledgeCandidate(submission("bypass", {}, WELDER_SELECTION_FACTS), {
      profile: rogue,
    })

    // data_boundary and verifiable_ground_truth still ran, were never answered,
    // and so hold the candidate at draft rather than waving it through.
    expect(result.skippedGates.sort()).toEqual(
      KNOWLEDGE_GATE_IDS.filter((id) => !NON_WAIVABLE_GATE_IDS.includes(id)).sort()
    )
    expect(result.untestedGates.sort()).toEqual([...NON_WAIVABLE_GATE_IDS].sort())
    expect(result.disposition).toBe("hold_as_draft")
  })

  it("still lets a fully-relaxed profile through Tier 1 once the fixed gates pass", () => {
    let profile = STRICT_GATE_PROFILE
    for (const id of KNOWLEDGE_GATE_IDS) profile = withGateDisabled(profile, id)
    const result = evaluateKnowledgeCandidate(
      submission(
        "bypass",
        { data_boundary: "pass", verifiable_ground_truth: "pass" },
        WELDER_SELECTION_FACTS
      ),
      { profile }
    )
    expect(result.disposition).toBe("decline_not_worthwhile")
  })
})

describe("submission parsing", () => {
  it("accepts a partial gate map and defaults facts to null", () => {
    const parsed = parseKnowledgeCandidateSubmission({
      candidateId: "x",
      gateResults: { data_boundary: "pass" },
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.facts).toBeNull()
    expect(parsed!.gateResults).toEqual({ data_boundary: "pass" })
  })

  it("rejects unknown gate ids and unknown result values", () => {
    expect(
      knowledgeCandidateSubmissionSchema.safeParse({
        candidateId: "x",
        gateResults: { not_a_gate: "pass" },
      }).success
    ).toBe(false)
    expect(
      knowledgeCandidateSubmissionSchema.safeParse({
        candidateId: "x",
        gateResults: { data_boundary: "probably" },
      }).success
    ).toBe(false)
  })

  it("rejects an implausible recurrence rather than scoring it", () => {
    expect(
      knowledgeCandidateSubmissionSchema.safeParse({
        candidateId: "x",
        facts: { ...COPPER_PIPE_FACTS, recurrencePerYear: 5_000 },
      }).success
    ).toBe(false)
  })

  it("exposes the trial gate each knowledge gate mirrors", () => {
    expect(getKnowledgeGate("data_boundary").trialGate).toBe("data_boundary")
    expect(getKnowledgeGate("commercial_neutrality").trialGate).toBe("independence")
    expect(getKnowledgeGate("diagnosis_before_action").trialGate).toBeNull()
  })
})
