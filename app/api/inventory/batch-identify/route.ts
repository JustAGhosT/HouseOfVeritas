import { NextResponse } from "next/server"
import { readFile, readdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { withAuth } from "@/lib/auth/rbac"
import { isPostgresConfigured, query, ensureSchema } from "@/lib/db/postgres"
import {
  identifyInventoryBatchWithSluice,
  type SluiceInventoryImage,
} from "@/lib/integrations/sluice"

const UPLOAD_DIR = "/tmp/hov-uploads"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
}

let schemaEnsured = false

async function ensureSchemaOnce() {
  if (!schemaEnsured && isPostgresConfigured()) {
    await ensureSchema()
    schemaEnsured = true
  }
}

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

  let storedName: string | null = null
  let mimeType = image.mimeType || "application/octet-stream"

  if (isPostgresConfigured()) {
    await ensureSchemaOnce()
    const { rows } = await query<{ stored_name: string; mime_type: string }>(
      `SELECT stored_name, mime_type FROM file_uploads WHERE id = $1`,
      [image.uploadId]
    )
    if (rows[0]) {
      storedName = rows[0].stored_name
      mimeType = rows[0].mime_type
    }
  }

  if (!storedName && existsSync(UPLOAD_DIR)) {
    const files = await readdir(UPLOAD_DIR)
    const match = files.find((file) => path.basename(file, path.extname(file)) === image.uploadId)
    if (match) {
      storedName = match
      mimeType = MIME_BY_EXT[path.extname(match).toLowerCase()] || mimeType
    }
  }

  if (!storedName) return image

  const filePath = path.join(UPLOAD_DIR, storedName)
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
