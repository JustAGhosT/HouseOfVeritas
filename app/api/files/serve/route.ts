import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { withAuth } from "@/lib/auth/rbac"
import {
  createAzureBlobServiceClient,
  hashAzureFileOwner,
  isAzureBlobConfigured,
  resolveAzureFileById,
} from "@/lib/storage/azure-blob"

const UPLOAD_DIR = "/tmp/uploads"
const ALLOWED_CATEGORIES = ["asset-photos", "invoice-scans", "invoices", "documents", "general"]
const AZURE_CONFIG = {
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
}

export const GET = withAuth(async (request, context) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const filename = searchParams.get("filename")
  const fileId = searchParams.get("id")

  if (fileId) {
    if (!isAzureBlobConfigured(AZURE_CONFIG)) {
      return NextResponse.json({ error: "Azure storage is not configured" }, { status: 503 })
    }
    const resolved = await resolveAzureFileById(createAzureBlobServiceClient(AZURE_CONFIG), fileId)
    if (!resolved) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    const canRead =
      context.role === "admin" ||
      context.role === "operator" ||
      resolved.ownerIdHash === hashAzureFileOwner(context.userId)
    if (!canRead) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }
    const [buffer, properties] = await Promise.all([
      resolved.blobClient.downloadToBuffer(),
      resolved.blobClient.getProperties(),
    ])
    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": properties.contentType || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    })
  }

  if (!category || !filename) {
    return NextResponse.json({ error: "category and filename required" }, { status: 400 })
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  const filePath = `${UPLOAD_DIR}/${category}/${filename}`
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  }

  const buffer = await readFile(filePath)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  })
})
