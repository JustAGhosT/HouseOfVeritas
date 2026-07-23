import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { withAuth } from "@/lib/auth/rbac"

const UPLOAD_DIR = "/tmp/uploads"
const ALLOWED_CATEGORIES = ["asset-photos", "invoice-scans", "invoices", "documents", "general"]

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const filename = searchParams.get("filename")

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
