import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import { logger } from "@/lib/logger"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"
import { withAuth } from "@/lib/auth/rbac"
import { createAzureBlobServiceClient, isAzureBlobConfigured } from "@/lib/storage/azure-blob"

// Configuration
const UPLOAD_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
  uploadDir: "/tmp/uploads", // Local fallback, Azure preferred
}

const LOCAL_UPLOAD_ROOT = "/tmp/uploads"

// Azure Blob Storage configuration (optional)
const AZURE_CONFIG = {
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
  containerName: process.env.AZURE_STORAGE_CONTAINER || "house-of-veritas",
}

// Check if Azure is configured
function isAzureConfigured(): boolean {
  return isAzureBlobConfigured(AZURE_CONFIG)
}

// Generate unique filename
function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName)
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, "-") || "file"
  const timestamp = Date.now()
  const hash = crypto.randomBytes(8).toString("hex")
  return `${baseName}-${timestamp}-${hash}${ext}`
}

// Validate file
function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB`,
    }
  }

  if (!UPLOAD_CONFIG.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Allowed: ${UPLOAD_CONFIG.allowedMimeTypes.join(", ")}`,
    }
  }

  return { valid: true }
}

function normalizeStorageSegment(value: string | null | undefined, fallback: string): string {
  const segment = value?.trim()
  if (!segment) return fallback
  return segment.replace(/[^a-zA-Z0-9._-]/g, "-")
}

// Upload to Azure Blob Storage
async function uploadToAzure(
  buffer: Buffer,
  filename: string,
  contentType: string,
  container: string
): Promise<{ url: string; blobName: string }> {
  const blobServiceClient = createAzureBlobServiceClient(AZURE_CONFIG)

  const containerClient = blobServiceClient.getContainerClient(container)

  // The target storage account prohibits public blob access. Omitting an access
  // option creates a private container.
  await containerClient.createIfNotExists()

  const blobName = `${Date.now()}/${filename}`
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  })

  return {
    url: blockBlobClient.url,
    blobName,
  }
}

// Upload to local filesystem (fallback)
async function uploadToLocal(
  buffer: Buffer,
  filename: string,
  category: string
): Promise<{ url: string; path: string }> {
  const uploadDir = `${LOCAL_UPLOAD_ROOT}/${category}`

  // Ensure directory exists
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }

  const filePath = `${uploadDir}/${filename}`
  await writeFile(filePath, buffer)

  const url = `/api/files/serve?category=${encodeURIComponent(category)}&filename=${encodeURIComponent(filename)}`
  return {
    url,
    path: filePath,
  }
}

export const POST = withAuth(async (request) => {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const category = normalizeStorageSegment(formData.get("category") as string | null, "general")
    const assetId = formData.get("assetId") as string
    const userId = formData.get("userId") as string

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uniqueFilename = generateUniqueFilename(file.name)

    let uploadResult: { url: string; storage: string; blobName?: string; path?: string }

    if (isAzureConfigured()) {
      // Upload to Azure Blob Storage
      const containerName =
        category === "asset-photos"
          ? "asset-photos"
          : category === "invoices"
            ? "invoice-scans"
            : AZURE_CONFIG.containerName

      const result = await uploadToAzure(buffer, uniqueFilename, file.type, containerName)
      uploadResult = {
        url: result.url,
        storage: "azure",
        blobName: result.blobName,
      }
    } else {
      // Fallback to local storage
      const result = await uploadToLocal(buffer, uniqueFilename, category)
      uploadResult = {
        url: result.url,
        storage: "local",
        path: result.path,
      }
    }

    // Create file metadata
    const fileMetadata = {
      id: crypto.randomUUID(),
      originalName: file.name,
      filename: uniqueFilename,
      url: uploadResult.url,
      size: file.size,
      mimeType: file.type,
      category,
      assetId,
      userId,
      storage: uploadResult.storage,
      blobName: uploadResult.blobName,
      uploadedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      file: fileMetadata,
      azureConfigured: isAzureConfigured(),
    })
  } catch (error) {
    logger.error("Upload error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async () => {
  return NextResponse.json({
    maxFileSize: UPLOAD_CONFIG.maxFileSize,
    allowedMimeTypes: UPLOAD_CONFIG.allowedMimeTypes,
    azureConfigured: isAzureConfigured(),
    containers: ["asset-photos", "invoice-scans", "documents"],
  })
})

export const DELETE = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get("id")
  const blobName = searchParams.get("blobName")
  const storage = searchParams.get("storage")
  const localPath = searchParams.get("path")

  if (!fileId) {
    return NextResponse.json({ success: false, error: "File ID required" }, { status: 400 })
  }

  try {
    if (storage === "azure" && blobName && isAzureConfigured()) {
      const blobServiceClient = createAzureBlobServiceClient(AZURE_CONFIG)
      const containerClient = blobServiceClient.getContainerClient(AZURE_CONFIG.containerName)
      const blobClient = containerClient.getBlobClient(blobName)
      await blobClient.deleteIfExists()
    } else if (storage === "local") {
      // Reconstruct path server-side to prevent path traversal
      const category = searchParams.get("category")
      const filename = searchParams.get("filename")
      if (!category || !filename) {
        return NextResponse.json(
          { success: false, error: "category and filename required for local delete" },
          { status: 400 }
        )
      }
      if (
        category !== normalizeStorageSegment(category, "") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return NextResponse.json({ success: false, error: "Invalid path" }, { status: 400 })
      }
      const filePath = `${LOCAL_UPLOAD_ROOT}/${category}/${filename}`
      await unlink(filePath)
    }

    return NextResponse.json({ success: true, deleted: fileId })
  } catch (error) {
    logger.error("Delete error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    )
  }
})
