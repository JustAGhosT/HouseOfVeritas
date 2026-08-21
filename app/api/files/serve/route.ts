import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { withAuth } from "@/lib/auth/rbac"
import { createAzureBlobServiceClient, isAzureBlobConfigured } from "@/lib/storage/azure-blob"

const UPLOAD_DIR = "/tmp/uploads"
const ALLOWED_CATEGORIES = ["asset-photos", "invoice-scans", "invoices", "documents", "general"]
const AZURE_CONFIG = {
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
}

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const filename = searchParams.get("filename")
  const storage = searchParams.get("storage")

  if (storage === "azure") {
    const container = searchParams.get("container")
    const blobName = searchParams.get("blobName")
    if (
      !container ||
      !blobName ||
      !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(container) ||
      !/^[A-Za-z0-9._/-]+$/.test(blobName) ||
      blobName.startsWith("/") ||
      blobName.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return NextResponse.json({ error: "Valid container and blobName required" }, { status: 400 })
    }
    if (!isAzureBlobConfigured(AZURE_CONFIG)) {
      return NextResponse.json({ error: "Azure storage is not configured" }, { status: 503 })
    }
    const blobClient = createAzureBlobServiceClient(AZURE_CONFIG)
      .getContainerClient(container)
      .getBlobClient(blobName)
    if (!(await blobClient.exists())) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    const [buffer, properties] = await Promise.all([
      blobClient.downloadToBuffer(),
      blobClient.getProperties(),
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
