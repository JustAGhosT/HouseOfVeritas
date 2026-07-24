import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import { logger } from "@/lib/logger"
import { existsSync } from "fs"
import path from "path"
import { withAuth } from "@/lib/auth/rbac"
import { isPostgresConfigured, withClient, query, ensureSchema } from "@/lib/db/postgres"
import {
  deleteLocalUploadMetadata,
  inMemoryUploadStore,
  persistLocalUploadMetadata,
  UPLOAD_DIR,
} from "@/lib/uploads"
import { resolveTaskAccess } from "@/lib/task-access"

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  spreadsheet: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
  receipt: ["image/jpeg", "image/png", "application/pdf"],
  general: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

let schemaEnsured = false

async function ensureSchemaOnce() {
  if (!schemaEnsured && isPostgresConfigured()) {
    await ensureSchema()
    schemaEnsured = true
  }
}

async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

async function persistToPostgres(metadata: {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  uploadedBy: string
  category: string
  resourceType?: string
  resourceId?: string
}) {
  if (!isPostgresConfigured()) return
  await ensureSchemaOnce()
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO file_uploads (id, original_name, stored_name, mime_type, size, uploaded_by, category, resource_type, resource_id, storage, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'local', $10)`,
      [
        metadata.id,
        metadata.originalName,
        metadata.storedName,
        metadata.mimeType,
        metadata.size,
        metadata.uploadedBy,
        metadata.category,
        metadata.resourceType ?? null,
        metadata.resourceId ?? null,
        path.join(UPLOAD_DIR, metadata.storedName),
      ]
    )
  })
}

async function getFilesFromPostgres(filters: {
  userId?: string
  category?: string
  resourceType?: string
  resourceId?: string
}) {
  let sql = `SELECT id, original_name as "originalName", stored_name as "storedName", mime_type as "mimeType", size, uploaded_by as "uploadedBy", created_at as "uploadedAt", category, resource_type as "resourceType", resource_id as "resourceId" FROM file_uploads WHERE 1=1`
  const params: unknown[] = []
  let i = 1
  if (filters.userId) {
    sql += ` AND uploaded_by = $${i++}`
    params.push(filters.userId)
  }
  if (filters.category) {
    sql += ` AND category = $${i++}`
    params.push(filters.category)
  }
  if (filters.resourceType) {
    sql += ` AND resource_type = $${i++}`
    params.push(filters.resourceType)
  }
  if (filters.resourceId) {
    sql += ` AND resource_id = $${i++}`
    params.push(filters.resourceId)
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
  }>(sql, params)
  return rows.map((r) => ({
    ...r,
    resourceType: r.resourceType ?? undefined,
    resourceId: r.resourceId ?? undefined,
    url: `/api/uploads/${r.id}`,
  }))
}

export const GET = withAuth(async (request, context) => {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  const category = searchParams.get("category")
  const resourceType = searchParams.get("resourceType")
  const resourceId = searchParams.get("resourceId")

  const filters = {
    userId: userId || undefined,
    category: category || undefined,
    resourceType: resourceType || undefined,
    resourceId: resourceId || undefined,
  }

  const isAuthorizedTaskGuidanceList = resourceType === "task-guidance" && Boolean(resourceId)
  if (resourceType === "task-guidance") {
    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId is required when listing task guidance uploads." },
        { status: 400 }
      )
    }

    const taskAccess = await resolveTaskAccess(resourceId, context.userId, context.role)
    if (taskAccess.status === 404) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }
    if (taskAccess.status === 403) {
      return NextResponse.json(
        { error: "You do not have access to this task." },
        { status: 403 }
      )
    }
  }

  if (isPostgresConfigured()) {
    await ensureSchemaOnce()
    let files = await getFilesFromPostgres(filters)
    if (!isAuthorizedTaskGuidanceList) {
      files = files.filter((file) => file.resourceType !== "task-guidance")
    }
    return NextResponse.json({ files, total: files.length })
  }

  let files = Array.from(inMemoryUploadStore.values())
  if (userId) files = files.filter((f) => f.uploadedBy === userId)
  if (category) files = files.filter((f) => f.category === category)
  if (resourceType) files = files.filter((f) => f.resourceType === resourceType)
  if (resourceId) files = files.filter((f) => f.resourceId === resourceId)
  if (!isAuthorizedTaskGuidanceList) {
    files = files.filter((file) => file.resourceType !== "task-guidance")
  }

  return NextResponse.json({
    files: files.map((f) => ({ ...f, url: `/api/uploads/${f.id}` })),
    total: files.length,
  })
})

export const POST = withAuth(async (request, context) => {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const category = (formData.get("category") as string) || "general"
    const resourceType = formData.get("resourceType") as string | null
    const resourceId = formData.get("resourceId") as string | null
    const uploader = context.userId

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      )
    }

    const allowedTypes = ALLOWED_TYPES[category] || Object.values(ALLOWED_TYPES).flat()
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      )
    }

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const ext = path.extname(file.name)
    const storedName = `${fileId}${ext}`
    const filePath = path.join(UPLOAD_DIR, storedName)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    const metadata = {
      id: fileId,
      originalName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedBy: uploader,
      uploadedAt: new Date(),
      category,
      resourceType: resourceType || undefined,
      resourceId: resourceId || undefined,
    }
    inMemoryUploadStore.set(fileId, metadata)
    await persistLocalUploadMetadata(metadata)
    await persistToPostgres(metadata)

    return NextResponse.json({
      success: true,
      file: { ...metadata, url: `/api/uploads/${fileId}` },
    })
  } catch (error) {
    logger.error("Upload error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get("id")

  if (!fileId) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 })
  }

  const file = inMemoryUploadStore.get(fileId)
  if (isPostgresConfigured()) {
    await ensureSchemaOnce()
    const { rows } = await query<{ stored_name: string }>(
      `SELECT stored_name FROM file_uploads WHERE id = $1`,
      [fileId]
    )
    if (rows[0]) {
      const filePath = path.join(UPLOAD_DIR, rows[0].stored_name)
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => {})
      }
      await withClient((client) => client.query(`DELETE FROM file_uploads WHERE id = $1`, [fileId]))
    }
  } else if (file) {
    const filePath = path.join(UPLOAD_DIR, file.storedName)
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => {})
    }
  }
  inMemoryUploadStore.delete(fileId)
  await deleteLocalUploadMetadata(fileId)

  return NextResponse.json({ success: true, deletedId: fileId })
})
