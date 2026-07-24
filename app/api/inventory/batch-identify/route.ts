import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { withAuth } from "@/lib/auth/rbac"
import {
  identifyInventoryBatchWithSluice,
  type SluiceInventoryImage,
} from "@/lib/integrations/sluice"
import { getUploadFilePath, getUploadMetadataById } from "@/lib/uploads"

function validImage(value: unknown): value is SluiceInventoryImage {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.uploadId === "string" &&
    typeof item.photoUrl === "string" &&
    item.photoUrl.startsWith("/api/uploads/")
  )
}

async function readUploadForService(image: SluiceInventoryImage): Promise<SluiceInventoryImage> {
  if (!/^file_[a-zA-Z0-9_-]+$/.test(image.uploadId)) return image

  const metadata = await getUploadMetadataById(image.uploadId)
  if (!metadata) return image

  const mimeType = metadata.mimeType || image.mimeType || "application/octet-stream"
  const filePath = getUploadFilePath(metadata.storedName)
  if (!existsSync(filePath)) return image

  const buffer = await readFile(filePath)
  const imageBase64 = buffer.toString("base64")
  return {
    ...image,
    mimeType,
    imageBase64,
    dataUrl: `data:${mimeType};base64,${imageBase64}`,
  }
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

    const serviceImages = await Promise.all(images.map(readUploadForService))
    const result = await identifyInventoryBatchWithSluice(serviceImages)

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
