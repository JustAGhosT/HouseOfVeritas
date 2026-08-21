import { ensureSchema, isPostgresConfigured, query } from "@/lib/db/postgres"

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface AzureFileMetadata {
  id: string
  containerName: string
  blobName: string
  ownerIdHash: string
}

let schemaPromise: Promise<void> | null = null

async function ensureFileSchema(): Promise<void> {
  if (!isPostgresConfigured()) {
    throw new Error("PostgreSQL is required for authoritative Azure file metadata")
  }
  schemaPromise ??= ensureSchema().catch((error) => {
    schemaPromise = null
    throw error
  })
  await schemaPromise
}

export async function persistAzureFileMetadata(
  metadata: AzureFileMetadata & {
    originalName: string
    storedName: string
    mimeType: string
    size: number
    uploadedBy: string
    category: string
    assetId?: string
    url: string
  }
): Promise<void> {
  await ensureFileSchema()
  await query(
    `INSERT INTO file_uploads (
       id, original_name, stored_name, mime_type, size, uploaded_by, category,
       resource_type, resource_id, storage, blob_name, container_name, owner_id_hash, url
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'asset', $8, 'azure', $9, $10, $11, $12)`,
    [
      metadata.id,
      metadata.originalName,
      metadata.storedName,
      metadata.mimeType,
      metadata.size,
      metadata.uploadedBy,
      metadata.category,
      metadata.assetId ?? null,
      metadata.blobName,
      metadata.containerName,
      metadata.ownerIdHash,
      metadata.url,
    ]
  )
}

export async function getAzureFileMetadata(fileId: string): Promise<AzureFileMetadata | null> {
  if (!FILE_ID_PATTERN.test(fileId) || !isPostgresConfigured()) return null
  await ensureFileSchema()
  const { rows } = await query<{
    id: string
    containerName: string
    blobName: string
    ownerIdHash: string
  }>(
    `SELECT id, container_name AS "containerName", blob_name AS "blobName",
            owner_id_hash AS "ownerIdHash"
     FROM file_uploads
     WHERE id = $1 AND storage = 'azure'
       AND container_name IS NOT NULL AND blob_name IS NOT NULL AND owner_id_hash IS NOT NULL
     LIMIT 1`,
    [fileId]
  )
  return rows[0] ?? null
}

export async function deleteAzureFileMetadata(fileId: string): Promise<void> {
  if (!FILE_ID_PATTERN.test(fileId) || !isPostgresConfigured()) return
  await ensureFileSchema()
  await query(`DELETE FROM file_uploads WHERE id = $1 AND storage = 'azure'`, [fileId])
}
