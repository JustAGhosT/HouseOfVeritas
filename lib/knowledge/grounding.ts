import type { KnowledgeMatch } from "@/lib/knowledge/types"

/**
 * Renders curated knowledge into a reference block for AI guidance generation.
 *
 * Trust boundary: entries rendered here are git-versioned and code-reviewed, so
 * they are TRUSTED prompt content and belong in the system message. The task
 * title/description and the photo remain untrusted and stay fenced in the user
 * message. Never render untrusted task text through this module.
 */

export interface KnowledgeGroundingRef {
  slug: string
  title: string
  score: number
}

export interface KnowledgeGrounding {
  /** Compact curated reference text, safe to place in the system prompt. */
  text: string
  /** Provenance so a caller can report which entries grounded the answer. */
  refs: KnowledgeGroundingRef[]
}

export interface GroundingOptions {
  /** Entries to render. Default 2 — enough to cover a differential, small enough to stay cheap. */
  maxEntries?: number
  /** Steps rendered per entry. Default 8. */
  maxStepsPerEntry?: number
}

function renderEntry(match: KnowledgeMatch, maxSteps: number): string {
  const { guidance } = match.entry
  const lines = [`### ${guidance.title} (${match.entry.slug})`, guidance.summary]

  if (guidance.safety.length > 0) {
    lines.push("Safety boundaries:")
    lines.push(...guidance.safety.map((item) => `- ${item}`))
  }

  const steps = guidance.steps
    .slice()
    .sort((left, right) => left.order - right.order)
    .slice(0, maxSteps)

  if (steps.length > 0) {
    lines.push("Curated steps:")
    lines.push(...steps.map((step) => `${step.order}. ${step.title} — ${step.instruction}`))
  }

  return lines.join("\n")
}

/**
 * Builds the grounding block, or null when nothing matched — callers should then
 * fall back to ungrounded generation rather than injecting an empty section.
 */
export function buildKnowledgeGrounding(
  matches: KnowledgeMatch[],
  options: GroundingOptions = {}
): KnowledgeGrounding | null {
  const maxEntries = options.maxEntries ?? 2
  const maxStepsPerEntry = options.maxStepsPerEntry ?? 8
  const selected = matches.slice(0, maxEntries)
  if (selected.length === 0) return null

  return {
    text: selected.map((match) => renderEntry(match, maxStepsPerEntry)).join("\n\n"),
    refs: selected.map((match) => ({
      slug: match.entry.slug,
      title: match.entry.guidance.title,
      score: match.score,
    })),
  }
}
