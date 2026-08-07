import { describe, it, expect } from "vitest"
import {
  CHECKLIST_SAFEGUARD_PROFILE,
  enabledSafeguards,
  evaluateKnowledgeCandidate,
  getSafeguardProfile,
  getKnowledgeSafeguard,
  isSafeguardEnabled,
  KNOWLEDGE_SAFEGUARD_IDS,
  KNOWLEDGE_PUBLICATION_SAFEGUARDS,
  NON_WAIVABLE_SAFEGUARD_IDS,
  knowledgeCandidateSubmissionSchema,
  parseKnowledgeCandidateSubmission,
  RECIPE_SAFEGUARD_PROFILE,
  STRICT_SAFEGUARD_PROFILE,
  withSafeguardDisabled,
  withSafeguardEnabled,
  type KnowledgeCandidateSubmission,
  type KnowledgeSafeguardId,
  type KnowledgeSafeguardResult,
} from "@/lib/knowledge/safeguards"
import type { KnowledgeCandidateFacts } from "@/lib/knowledge/rubrics"

/** All safeguards pass unless overridden — keeps each fixture to its own point. */
function safeguardsAllPass(
  overrides: Partial<Record<KnowledgeSafeguardId, KnowledgeSafeguardResult>> = {}
): Record<KnowledgeSafeguardId, KnowledgeSafeguardResult> {
  const base = Object.fromEntries(KNOWLEDGE_SAFEGUARD_IDS.map((id) => [id, "pass"])) as Record<
    KnowledgeSafeguardId,
    KnowledgeSafeguardResult
  >
  return { ...base, ...overrides }
}

function submission(
  candidateId: string,
  safeguardResults: Partial<Record<KnowledgeSafeguardId, KnowledgeSafeguardResult>>,
  facts: KnowledgeCandidateFacts | null = null
): KnowledgeCandidateSubmission {
  return { candidateId, safeguardResults, facts }
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

/** Spec §8.4 — passes every safeguard, declines on worth. Composite 3.69. */
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

describe("knowledge safeguard catalogue", () => {
  it("declares every id exactly once", () => {
    const ids = KNOWLEDGE_PUBLICATION_SAFEGUARDS.map((safeguard) => safeguard.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.slice().sort()).toEqual(KNOWLEDGE_SAFEGUARD_IDS.slice().sort())
  })

  it("has every safeguard on by default — nothing is opt-in", () => {
    expect(enabledSafeguards(STRICT_SAFEGUARD_PROFILE)).toHaveLength(KNOWLEDGE_SAFEGUARD_IDS.length)
    // A profile authored without thinking about safeguards still runs all of them,
    // so a safeguard added later cannot silently skip existing profiles.
    const naive = { id: "naive", label: "", description: "", disabledSafeguards: [] }
    expect(enabledSafeguards(naive).map((safeguard) => safeguard.id)).toEqual([
      ...KNOWLEDGE_SAFEGUARD_IDS,
    ])
  })

  it("reserves the decline failure mode for ungroundable content only", () => {
    const declining = KNOWLEDGE_PUBLICATION_SAFEGUARDS.filter((g) => g.failureMode === "decline")
    expect(declining.map((g) => g.id)).toEqual(["verifiable_ground_truth"])
  })
})

describe("safeguard profiles are selectable and toggleable", () => {
  it("resolves named profiles and rejects unknown ones", () => {
    expect(getSafeguardProfile("strict")).toEqual(STRICT_SAFEGUARD_PROFILE)
    expect(getSafeguardProfile("household-recipe")).toEqual(RECIPE_SAFEGUARD_PROFILE)
    expect(getSafeguardProfile("nope")).toBeNull()
  })

  it("disables only what a profile names", () => {
    expect(isSafeguardEnabled(RECIPE_SAFEGUARD_PROFILE, "statutory_competence")).toBe(false)
    expect(isSafeguardEnabled(RECIPE_SAFEGUARD_PROFILE, "irreversible_harm")).toBe(true)
    expect(isSafeguardEnabled(CHECKLIST_SAFEGUARD_PROFILE, "diagnosis_before_action")).toBe(false)
    expect(isSafeguardEnabled(CHECKLIST_SAFEGUARD_PROFILE, "statutory_competence")).toBe(true)
  })

  it("toggles without mutating the source profile", () => {
    const off = withSafeguardDisabled(STRICT_SAFEGUARD_PROFILE, "commercial_neutrality")
    expect(isSafeguardEnabled(off, "commercial_neutrality")).toBe(false)
    expect(isSafeguardEnabled(STRICT_SAFEGUARD_PROFILE, "commercial_neutrality")).toBe(true)
    expect(STRICT_SAFEGUARD_PROFILE.disabledSafeguards).toHaveLength(0)

    const backOn = withSafeguardEnabled(off, "commercial_neutrality")
    expect(isSafeguardEnabled(backOn, "commercial_neutrality")).toBe(true)
  })

  it("is idempotent in both directions", () => {
    // Uses a waivable safeguard deliberately: disabling a non-waivable one is a
    // no-op, which would make this pass without exercising anything.
    const once = withSafeguardDisabled(STRICT_SAFEGUARD_PROFILE, "irreversible_harm")
    expect(once).not.toBe(STRICT_SAFEGUARD_PROFILE)
    expect(withSafeguardDisabled(once, "irreversible_harm")).toBe(once)
    expect(withSafeguardEnabled(STRICT_SAFEGUARD_PROFILE, "irreversible_harm")).toBe(
      STRICT_SAFEGUARD_PROFILE
    )
  })

  it("treats disabling a non-waivable safeguard as a no-op", () => {
    for (const id of NON_WAIVABLE_SAFEGUARD_IDS) {
      expect(withSafeguardDisabled(STRICT_SAFEGUARD_PROFILE, id)).toBe(STRICT_SAFEGUARD_PROFILE)
    }
  })
})

describe("the welding trio — three dispositions from one topic", () => {
  it("'how to weld safely' re-scopes to a safety entry (single rescope-mode safeguard)", () => {
    const result = evaluateKnowledgeCandidate(
      submission("weld-safely", safeguardsAllPass({ irreversible_harm: "fail" }), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("rescope_as_safety")
    expect(result.failedSafeguards).toEqual(["irreversible_harm"])
    // Never scored: a high composite must not read as mitigating an unsafe entry.
    expect(result.composite).toBeNull()
    expect(result.priority).toBeNull()
  })

  it("'how to build a welder' declines outright (ungroundable)", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "build-a-welder",
        safeguardsAllPass({ irreversible_harm: "fail", verifiable_ground_truth: "fail" })
      )
    )
    expect(result.disposition).toBe("decline_unsafe")
    expect(result.failedSafeguards).toContain("verifiable_ground_truth")
    expect(result.composite).toBeNull()
  })

  it("'which welder to buy' passes every safeguard and declines on worth", () => {
    const result = evaluateKnowledgeCandidate(
      submission("welder-selection", safeguardsAllPass(), WELDER_SELECTION_FACTS)
    )
    expect(result.failedSafeguards).toHaveLength(0)
    expect(result.disposition).toBe("decline_not_worthwhile")
    expect(result.composite).toBeCloseTo(3.69, 2)
    expect(result.priority).toBeNull()
  })

  it("distinguishes the two declines — they are not the same record", () => {
    const unsafe = evaluateKnowledgeCandidate(
      submission("build-a-welder", safeguardsAllPass({ verifiable_ground_truth: "fail" }))
    )
    const notWorth = evaluateKnowledgeCandidate(
      submission("welder-selection", safeguardsAllPass(), WELDER_SELECTION_FACTS)
    )
    expect(unsafe.disposition).not.toBe(notWorth.disposition)
    // The worth-based decline is revisitable: buying the welder flips it.
    const owned = evaluateKnowledgeCandidate(
      submission("welder-selection", safeguardsAllPass(), {
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
      submission("copper-pipe", safeguardsAllPass(), COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("author")
    expect(result.composite).toBeCloseTo(8.0, 5)
    expect(result.priority).toBe("P0")
  })

  it("re-scopes on statutory competence — a different safeguard from irreversible harm", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "db-board-work",
        safeguardsAllPass({ statutory_competence: "fail" }),
        COPPER_PIPE_FACTS
      )
    )
    expect(result.disposition).toBe("rescope_as_safety")
    expect(result.failedSafeguards).toEqual(["statutory_competence"])
  })

  it("holds at draft when a safeguard was never tested", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "half-reviewed",
        safeguardsAllPass({ data_boundary: "not_tested" }),
        COPPER_PIPE_FACTS
      )
    )
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.untestedSafeguards).toEqual(["data_boundary"])
  })

  it("treats an omitted safeguard result as not_tested, never as a pass", () => {
    const partial = safeguardsAllPass()
    delete (partial as Record<string, unknown>).commercial_neutrality
    const result = evaluateKnowledgeCandidate(
      submission("omitted-safeguard", partial, COPPER_PIPE_FACTS)
    )
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.untestedSafeguards).toEqual(["commercial_neutrality"])
  })

  it("holds at draft when safeguards clear but Tier-1 facts are missing", () => {
    const result = evaluateKnowledgeCandidate(submission("no-facts", safeguardsAllPass(), null))
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.subScores).toBeNull()
  })

  it("prioritises Tier 0 over Tier 1 — an unsafe candidate is never scored", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "unsafe-but-valuable",
        safeguardsAllPass({ irreversible_harm: "fail" }),
        COPPER_PIPE_FACTS
      )
    )
    expect(result.subScores).toBeNull()
    expect(result.composite).toBeNull()
  })
})

describe("a disabled safeguard is recorded, never silently passed", () => {
  it("lists profile-disabled safeguards as skipped rather than folding them into passes", () => {
    const result = evaluateKnowledgeCandidate(
      submission("recipe-entry", safeguardsAllPass(), COPPER_PIPE_FACTS),
      { profile: RECIPE_SAFEGUARD_PROFILE }
    )
    expect(result.profileId).toBe("household-recipe")
    expect(result.skippedSafeguards.slice().sort()).toEqual(
      ["diagnosis_before_action", "statutory_competence"].sort()
    )
    expect(result.failedSafeguards).toHaveLength(0)
    expect(result.disposition).toBe("author")
  })

  it("ignores a result submitted for a safeguard the profile disabled", () => {
    // statutory_competence is off for recipes; a stray "fail" must not block.
    const result = evaluateKnowledgeCandidate(
      submission(
        "recipe-entry",
        safeguardsAllPass({ statutory_competence: "fail" }),
        COPPER_PIPE_FACTS
      ),
      { profile: RECIPE_SAFEGUARD_PROFILE }
    )
    expect(result.disposition).toBe("author")
    expect(result.failedSafeguards).toHaveLength(0)
    expect(result.skippedSafeguards).toContain("statutory_competence")
  })

  it("still fails on a safeguard the profile leaves enabled", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "allergen-recipe",
        safeguardsAllPass({ irreversible_harm: "fail" }),
        COPPER_PIPE_FACTS
      ),
      { profile: RECIPE_SAFEGUARD_PROFILE }
    )
    expect(result.disposition).toBe("rescope_as_safety")
  })

  it("treats an explicit not_applicable as untested, not as a pass", () => {
    const result = evaluateKnowledgeCandidate(
      submission(
        "sneaky",
        safeguardsAllPass({ data_boundary: "not_applicable" }),
        COPPER_PIPE_FACTS
      )
    )
    expect(result.disposition).toBe("hold_as_draft")
    expect(result.untestedSafeguards).toEqual(["data_boundary"])
  })

  it("cannot disable the non-waivable safeguards, however the profile is built", () => {
    // The schema and the store-read sanitiser both guard this, but neither sees
    // a profile assembled in code — so the evaluator has to hold the line too.
    let profile = STRICT_SAFEGUARD_PROFILE
    for (const id of KNOWLEDGE_SAFEGUARD_IDS) profile = withSafeguardDisabled(profile, id)

    for (const id of NON_WAIVABLE_SAFEGUARD_IDS) {
      expect(profile.disabledSafeguards).not.toContain(id)
      expect(isSafeguardEnabled(profile, id)).toBe(true)
    }
    expect(
      enabledSafeguards(profile)
        .map((safeguard) => safeguard.id)
        .sort()
    ).toEqual([...NON_WAIVABLE_SAFEGUARD_IDS].sort())
  })

  it("ignores a hand-built profile that names a non-waivable safeguard directly", () => {
    // Bypasses withSafeguardDisabled() entirely — the object literal a caller could
    // construct, or a stored record that reached the evaluator unsanitised.
    const rogue = {
      id: "rogue",
      label: "",
      description: "",
      disabledSafeguards: [...KNOWLEDGE_SAFEGUARD_IDS],
    }
    const result = evaluateKnowledgeCandidate(submission("bypass", {}, WELDER_SELECTION_FACTS), {
      profile: rogue,
    })

    // data_boundary and verifiable_ground_truth still ran, were never answered,
    // and so hold the candidate at draft rather than waving it through.
    expect(result.skippedSafeguards.sort()).toEqual(
      KNOWLEDGE_SAFEGUARD_IDS.filter((id) => !NON_WAIVABLE_SAFEGUARD_IDS.includes(id)).sort()
    )
    expect(result.untestedSafeguards.sort()).toEqual([...NON_WAIVABLE_SAFEGUARD_IDS].sort())
    expect(result.disposition).toBe("hold_as_draft")
  })

  it("still lets a fully-relaxed profile through Tier 1 once the fixed safeguards pass", () => {
    let profile = STRICT_SAFEGUARD_PROFILE
    for (const id of KNOWLEDGE_SAFEGUARD_IDS) profile = withSafeguardDisabled(profile, id)
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
  it("accepts a partial safeguard map and defaults facts to null", () => {
    const parsed = parseKnowledgeCandidateSubmission({
      candidateId: "x",
      safeguardResults: { data_boundary: "pass" },
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.facts).toBeNull()
    expect(parsed!.safeguardResults).toEqual({ data_boundary: "pass" })
  })

  it("rejects unknown safeguard ids and unknown result values", () => {
    expect(
      knowledgeCandidateSubmissionSchema.safeParse({
        candidateId: "x",
        safeguardResults: { not_a_safeguard: "pass" },
      }).success
    ).toBe(false)
    expect(
      knowledgeCandidateSubmissionSchema.safeParse({
        candidateId: "x",
        safeguardResults: { data_boundary: "probably" },
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

  it("exposes the trial safeguard each knowledge safeguard mirrors", () => {
    expect(getKnowledgeSafeguard("data_boundary").trialGate).toBe("data_boundary")
    expect(getKnowledgeSafeguard("commercial_neutrality").trialGate).toBe("independence")
    expect(getKnowledgeSafeguard("diagnosis_before_action").trialGate).toBeNull()
  })
})
