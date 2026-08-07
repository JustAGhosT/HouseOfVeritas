import {
  CHECKLIST_SAFEGUARD_PROFILE,
  evaluateSafeguardResults,
  RECIPE_SAFEGUARD_PROFILE,
  STRICT_SAFEGUARD_PROFILE,
  type KnowledgeSafeguardEvaluation,
  type KnowledgeSafeguardProfile,
  type KnowledgeSafeguardProfileSource,
} from "@/lib/knowledge/safeguards"
import type { KnowledgeEntry } from "@/lib/knowledge/types"
import { hasGuidanceSafetyBoundaries } from "@/lib/guidance"

/**
 * House of Veritas — applying the Tier-0 safeguards to real knowledge entries.
 *
 * There is no publication API: entries live in `seed.ts` and are published by
 * merging a PR. So the safeguards are enforced at two chokepoints rather than one.
 *
 *  1. **Module load / CI** — `assertPublishable()` runs over every seed entry
 *     against the *built-in* profile. A published entry whose recorded review
 *     does not clear its safeguards fails the seed at import, so it cannot merge.
 *  2. **Runtime** — `/api/knowledge/apply` re-checks against the *effective*
 *     profile, which an administrator may have made stricter than the built-in.
 *     Tightening a safeguard therefore stops application immediately, without a
 *     deploy.
 *
 * The two layers answer different questions: the first is "should this have
 * shipped", the second is "may it be used right now".
 */

/**
 * Which profile governs an entry, keyed on `guidance.kind` rather than domain —
 * the profiles are defined by what the content *does*, not where it lives.
 */
export function builtinProfileForEntry(entry: KnowledgeEntry): KnowledgeSafeguardProfile {
  if (entry.guidance.kind === "recipe") return RECIPE_SAFEGUARD_PROFILE
  if (entry.guidance.kind === "checklist") return CHECKLIST_SAFEGUARD_PROFILE
  return STRICT_SAFEGUARD_PROFILE
}

export const profileIdForEntry = (entry: KnowledgeEntry): string => builtinProfileForEntry(entry).id

export interface PublicationCheck {
  publishable: boolean
  /** Null when the entry carries no recorded review at all. */
  safeguards: KnowledgeSafeguardEvaluation | null
  /**
   * `safety[]` is non-empty and at least one step carries a warning. Enforced
   * here rather than merely reported, closing the gap where
   * `hasGuidanceSafetyBoundaries()` was computed and then ignored.
   */
  hasSafetyBoundaries: boolean
  reasons: string[]
}

/**
 * Check an entry against a profile. `profile` defaults to the entry's built-in;
 * callers with an administrator's stored configuration pass that instead.
 */
export function checkPublishable(
  entry: KnowledgeEntry,
  profile: KnowledgeSafeguardProfile = builtinProfileForEntry(entry),
  profileSource: KnowledgeSafeguardProfileSource = "builtin"
): PublicationCheck {
  const reasons: string[] = []
  const hasSafetyBoundaries = hasGuidanceSafetyBoundaries(entry.guidance)

  if (!entry.review) {
    return {
      publishable: false,
      safeguards: null,
      hasSafetyBoundaries,
      reasons: ["no recorded safeguard review"],
    }
  }

  const safeguards = evaluateSafeguardResults(entry.review.safeguardResults, profile, profileSource)

  if (safeguards.outcome !== "cleared") {
    // Report both sets when both exist. The outcome names only the more severe
    // one, so omitting the other loses context a reader needs to fix the entry.
    const detail = [
      safeguards.failedSafeguards.length > 0
        ? `failed: ${safeguards.failedSafeguards.join(", ")}`
        : null,
      safeguards.untestedSafeguards.length > 0
        ? `untested: ${safeguards.untestedSafeguards.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("; ")
    reasons.push(`${safeguards.outcome} (${detail})`)
  }
  if (!hasSafetyBoundaries) {
    reasons.push("guidance declares no safety boundaries")
  }

  return { publishable: reasons.length === 0, safeguards, hasSafetyBoundaries, reasons }
}

/**
 * Throw if a published entry would not clear its own safeguards. Called from the
 * seed so a bad entry fails at import — in CI, not in front of a user.
 */
export function assertPublishable(entry: KnowledgeEntry): void {
  if (entry.status !== "published") return
  const check = checkPublishable(entry)
  if (!check.publishable) {
    throw new Error(
      `Knowledge entry "${entry.slug}" is marked published but does not clear its safeguards: ${check.reasons.join("; ")}`
    )
  }
}
