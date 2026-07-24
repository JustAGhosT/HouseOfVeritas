import { NextResponse } from "next/server"
import { z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { generateTaskGuidanceWithSluice } from "@/lib/integrations/sluice"
import { logger } from "@/lib/logger"

const requestSchema = z.object({
  taskId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(3).max(2_000),
  imageBase64: z.string().min(16).max(14_000_000),
  imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  locale: z.enum(["en", "af"]).default("en"),
})

export const POST = withRole("admin", "operator", "employee", "resident")(async (request) => {
  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A task description and a JPEG, PNG, or WebP photo are required." },
        { status: 400 }
      )
    }

    const draft = await generateTaskGuidanceWithSluice(parsed.data)
    if (!draft) {
      return NextResponse.json(
        { error: "Visual guidance is unavailable because Sluice is not configured or reachable." },
        { status: 503 }
      )
    }

    return NextResponse.json({
      data: { draft },
      summary: { aiPowered: true, requiresHumanReview: true },
    })
  } catch (error) {
    logger.error("Failed to analyze task photo for guidance", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to analyze the task photo." }, { status: 500 })
  }
})
