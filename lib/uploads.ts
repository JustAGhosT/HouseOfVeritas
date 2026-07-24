import { readFile, unlink, writeFile } from "fs/promises"
import path from "path"

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

export async function deleteLocalUploadMetadata(id: string): Promise<void> {
  if (!isUploadId(id)) return
  await unlink(metadataPath(id)).catch(() => {})
}
