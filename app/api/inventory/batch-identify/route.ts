import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"
import {
  identifyInventoryBatchWithSluice,
  type SluiceInventoryImage,
} from "@/lib/integrations/sluice"

function validImage(value: unknown): value is SluiceInventoryImage {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.uploadId === "string" &&
    typeof item.photoUrl === "string" &&
    item.photoUrl.startsWith("/api/uploads/")
  )
}

export const POST = withAuth(async (request: Request) => {
  try {
    const body = await request.json()
    const images = Array.isArray(body.images) ? body.images.filter(validImage) : []

    if (images.length === 0) {
      return NextResponse.json({ error: "images are required" }, { status: 400 })
    }

    if (images.length > 20) {
      return NextResponse.json(
        { error: "Batch preview is limited to 20 images" },
        { status: 400 }
      )
    }

    const result = await identifyInventoryBatchWithSluice(images)

    return NextResponse.json({
      previewOnly: true,
      aiPowered: result.aiPowered,
      suggestions: result.suggestions,
      message: result.aiPowered
        ? "Preview suggestions from Sluice. Review before saving."
        : "Preview only. Sluice is unavailable or unconfigured; review and correct manually.",
    })
  } catch {
    return NextResponse.json({ error: "Batch identification failed" }, { status: 500 })
  }
})
