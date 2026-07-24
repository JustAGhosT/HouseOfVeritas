import { readFile, unlink, writeFile } from "fs/promises"
import path from "path"
import { ensureSchema, isPostgresConfigured, query } from "@/lib/db/postgres"

export const UPLOAD_DIR = "/tmp/hov-uploads"

export interface UploadMetadata {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  uploadedBy: string
  uploadedAt: Date
  category: string
  resourceType?: string
  resourceId?: string
}

export const inMemoryUploadStore = new Map<string, UploadMetadata>()

let schemaEnsured = false

function metadataPath(id: string): string {
  return path.join(/*turbopackIgnore: true*/ "/tmp/hov-uploads", `${id}.metadata.json`)
}

export function isUploadId(id: string): boolean {
  return /^file_[a-zA-Z0-9_-]+$/.test(id)
}

export async function persistLocalUploadMetadata(metadata: UploadMetadata): Promise<void> {
  await writeFile(metadataPath(metadata.id), JSON.stringify(metadata), {
    encoding: "utf8",
    mode: 0o600,
  })
}

export async function readLocalUploadMetadata(id: string): Promise<UploadMetadata | null> {
  if (!isUploadId(id)) return null

  try {
    const parsed = JSON.parse(await readFile(metadataPath(id), "utf8")) as UploadMetadata
    return { ...parsed, uploadedAt: new Date(parsed.uploadedAt) }
  } catch {
    return null
  }
}

export async function getUploadMetadataById(id: string): Promise<UploadMetadata | null> {
  if (!isUploadId(id)) return null

  if (isPostgresConfigured()) {
    if (!schemaEnsured) {
      await ensureSchema()
      schemaEnsured = true
    }

    const { rows } = await query<{
      id: string
      originalName: string
      storedName: string
      mimeType: string
      size: number
      uploadedBy: string
      uploadedAt: Date
      category: string
      resourceType: string | null
      resourceId: string | null
    }>(
      `SELECT id, original_name as "originalName", stored_name as "storedName",
              mime_type as "mimeType", size, uploaded_by as "uploadedBy",
              created_at as "uploadedAt", category, resource_type as "resourceType",
              resource_id as "resourceId"
       FROM file_uploads
       WHERE id = $1
       LIMIT 1`,
      [id]
    )

    if (rows[0]) {
      return {
        ...rows[0],
        resourceType: rows[0].resourceType ?? undefined,
        resourceId: rows[0].resourceId ?? undefined,
      }
    }
  }

  return inMemoryUploadStore.get(id) ?? (await readLocalUploadMetadata(id))
}

export async function deleteLocalUploadMetadata(id: string): Promise<void> {
  if (!isUploadId(id)) return
  await unlink(metadataPath(id)).catch(() => {})
}
