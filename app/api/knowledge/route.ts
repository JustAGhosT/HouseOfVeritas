import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { findKnowledge } from "@/lib/knowledge/retrieval"
import { KNOWLEDGE_DOMAINS } from "@/lib/knowledge/types"
import { GUIDANCE_LOCALES } from "@/lib/guidance"
import { logger } from "@/lib/logger"

const querySchema = z.object({
  q: z.string().trim().min(2).max(2_000),
  domain: z.enum(KNOWLEDGE_DOMAINS).optional(),
  assetType: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(GUIDANCE_LOCALES).optional(),
})

/**
 * GET /api/knowledge?q=...&domain=...&assetType=...&locale=...
 * Ranked curated troubleshooting/procedure entries matching a reported symptom.
 * Read access for every role; this is reference content, not mutable data.
 */
export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      domain: searchParams.get("domain") ?? undefined,
      assetType: searchParams.get("assetType") ?? undefined,
      locale: searchParams.get("locale") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "A search query (q) of at least 2 characters is required." },
        { status: 400 }
      )
    }

    const matches = findKnowledge({
      text: parsed.data.q,
      domain: parsed.data.domain,
      assetType: parsed.data.assetType,
      locale: parsed.data.locale,
    })

    return NextResponse.json({
      data: {
        matches: matches.map((match) => ({
          slug: match.entry.slug,
          domain: match.entry.domain,
          title: match.entry.guidance.title,
          summary: match.entry.guidance.summary,
          score: match.score,
          matchedTerms: match.matchedTerms,
          guidance: match.entry.guidance,
          suppliers: match.entry.suppliers,
        })),
      },
      summary: {
        count: matches.length,
        query: parsed.data.q,
      },
    })
  } catch (error) {
    logger.error("Failed to search knowledge base", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to search the knowledge base." }, { status: 500 })
  }
})
