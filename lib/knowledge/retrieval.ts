import { KNOWLEDGE_SEED } from "@/lib/knowledge/seed"
import type { KnowledgeEntry, KnowledgeMatch, KnowledgeQuery } from "@/lib/knowledge/types"

/**
 * Lightweight, deterministic symptom→knowledge matching.
 *
 * This is intentionally dependency-free keyword/symptom scoring so it is fast,
 * testable, and grounds AI generation in curated entries without an embedding
 * service. Swapping in vector retrieval later only changes rankKnowledge; the
 * query/match contracts stay the same.
 */

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "was",
  "are",
  "has",
  "have",
  "this",
  "that",
  "from",
  "our",
  "your",
  "there",
  "near",
  "onto",
  "into",
  "only",
  "getting",
  "could",
  "would",
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

/** Weights reflect precision: a matched symptom phrase is stronger signal than a bare keyword. */
const WEIGHTS = {
  symptomPhrase: 5,
  keyword: 2,
  symptomToken: 1,
  titleToken: 1,
  assetType: 3,
} as const

function scoreEntry(
  entry: KnowledgeEntry,
  queryText: string,
  queryTokens: Set<string>,
  assetType?: string
): { score: number; matchedTerms: string[] } {
  const matchedTerms = new Set<string>()
  let score = 0

  const haystack = queryText.toLowerCase()

  // Full symptom phrases present verbatim in the query are the strongest signal.
  for (const symptom of entry.symptoms) {
    if (haystack.includes(symptom.toLowerCase())) {
      score += WEIGHTS.symptomPhrase
      matchedTerms.add(symptom)
    }
  }

  for (const keyword of entry.keywords) {
    if (queryTokens.has(keyword.toLowerCase())) {
      score += WEIGHTS.keyword
      matchedTerms.add(keyword)
    }
  }

  const symptomTokens = new Set(entry.symptoms.flatMap((symptom) => tokenize(symptom)))
  for (const token of symptomTokens) {
    if (queryTokens.has(token)) {
      score += WEIGHTS.symptomToken
      matchedTerms.add(token)
    }
  }

  for (const token of tokenize(entry.guidance.title)) {
    if (queryTokens.has(token)) {
      score += WEIGHTS.titleToken
      matchedTerms.add(token)
    }
  }

  if (
    assetType &&
    entry.assetTypes.some((type) => type.toLowerCase() === assetType.toLowerCase())
  ) {
    score += WEIGHTS.assetType
    matchedTerms.add(assetType)
  }

  return { score, matchedTerms: [...matchedTerms] }
}

export interface RankOptions {
  /** Minimum score to be considered a match. Default 3 (roughly one keyword + token). */
  minScore?: number
  /** Maximum matches to return. Default 5. */
  limit?: number
}

/** Pure ranking over a supplied entry set — the unit-testable core. */
export function rankKnowledge(
  entries: KnowledgeEntry[],
  query: KnowledgeQuery,
  options: RankOptions = {}
): KnowledgeMatch[] {
  const minScore = options.minScore ?? 3
  const limit = options.limit ?? 5
  const queryTokens = new Set(tokenize(query.text))
  const locale = query.locale

  return entries
    .filter((entry) => entry.status === "published")
    .filter((entry) => !query.domain || entry.domain === query.domain)
    .filter((entry) => !locale || entry.guidance.locale === locale)
    .map((entry) => {
      const { score, matchedTerms } = scoreEntry(entry, query.text, queryTokens, query.assetType)
      return { entry, score, matchedTerms }
    })
    .filter((match) => match.score >= minScore)
    .sort(
      (left, right) => right.score - left.score || left.entry.slug.localeCompare(right.entry.slug)
    )
    .slice(0, limit)
}

/** Convenience over the curated seed (later: seed + stored entries from the repository). */
export function findKnowledge(query: KnowledgeQuery, options: RankOptions = {}): KnowledgeMatch[] {
  return rankKnowledge(KNOWLEDGE_SEED, query, options)
}

export function getKnowledgeBySlug(slug: string): KnowledgeEntry | null {
  return KNOWLEDGE_SEED.find((entry) => entry.slug === slug) ?? null
}
