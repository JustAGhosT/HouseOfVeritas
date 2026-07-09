import { NextResponse } from "next/server"
import { getTemplates, isDocuSealConfigured } from "@/lib/services/docuseal"
import { logger } from "@/lib/logger"

export async function GET() {
  try {
    const templates = await getTemplates()

    return NextResponse.json({
      templates,
      configured: isDocuSealConfigured(),
      message: isDocuSealConfigured() ? "Connected to DocuSeal" : "DocuSeal not configured",
    })
  } catch (error) {
    logger.error("Error fetching templates", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}
