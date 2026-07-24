import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { withAuth } from "@/lib/auth/rbac"
import { isPostgresConfigured, query, ensureSchema } from "@/lib/db/postgres"
import { resolveTaskAccess } from "@/lib/task-access"
import {
  getUploadFilePath,
  inMemoryUploadStore,
  isUploadId,
  readLocalUploadMetadata,
} from "@/lib/uploads"

let schemaEnsured = false

async function ensureSchemaOnce() {
  if (!schemaEnsured && isPostgresConfigured()) {
    await ensureSchema()
    schemaEnsured = true
  }
}

export const GET = withAuth(async (_request, context) => {
  const { id } = (await context.params) ?? {}
  if (!id) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 })
  }
  if (!isUploadId(id)) {
    return NextResponse.json({ error: "Invalid file ID." }, { status: 400 })
  }

  try {
    let storedName: string | null = null
    let mimeType = "application/octet-stream"
    let resourceType: string | undefined
    let resourceId: string | undefined

    if (isPostgresConfigured()) {
      await ensureSchemaOnce()
      const { rows } = await query<{
        stored_name: string
        mime_type: string
        resource_type: string | null
        resource_id: string | null
      }>(
        `SELECT stored_name, mime_type, resource_type, resource_id FROM file_uploads WHERE id = $1`,
        [id]
      )
      if (rows[0]) {
        storedName = rows[0].stored_name
        mimeType = rows[0].mime_type
        resourceType = rows[0].resource_type ?? undefined
        resourceId = rows[0].resource_id ?? undefined
      }
    }

    if (!storedName) {
      const metadata = inMemoryUploadStore.get(id) ?? (await readLocalUploadMetadata(id))
      if (metadata) {
        storedName = metadata.storedName
        mimeType = metadata.mimeType
        resourceType = metadata.resourceType
        resourceId = metadata.resourceId
      }
    }

    if (resourceType === "task-guidance") {
      if (!resourceId) {
        return NextResponse.json({ error: "Upload task binding is missing." }, { status: 403 })
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

    if (!storedName) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const filePath = getUploadFilePath(storedName)
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 })
  }
})
