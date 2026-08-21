import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  ensureSchema: vi.fn(),
  isPostgresConfigured: vi.fn(() => true),
  query: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => dbMocks)

import {
  deleteAzureFileMetadata,
  getAzureFileMetadata,
  persistAzureFileMetadata,
} from "@/lib/storage/azure-file-metadata"

const fileId = "82e54ed5-200d-4ce0-86f4-ff1f27689031"

describe("authoritative Azure file metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.isPostgresConfigured.mockReturnValue(true)
    dbMocks.ensureSchema.mockResolvedValue(undefined)
    dbMocks.query.mockResolvedValue({ rows: [], rowCount: 1 })
  })

  it("persists the opaque mapping before callers return a serving URL", async () => {
    await persistAzureFileMetadata({
      id: fileId,
      originalName: "document.pdf",
      storedName: "document-unique.pdf",
      mimeType: "application/pdf",
      size: 42,
      uploadedBy: "resident-1",
      category: "documents",
      containerName: "asset-uploads",
      blobName: "123/document-unique.pdf",
      ownerIdHash: "a".repeat(64),
      url: `/api/files/serve?id=${fileId}`,
    })

    expect(dbMocks.ensureSchema).toHaveBeenCalled()
    expect(dbMocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO file_uploads"),
      expect.arrayContaining([fileId, "asset-uploads", "123/document-unique.pdf", "a".repeat(64)])
    )
  })

  it("returns the exact persisted Azure location", async () => {
    const metadata = {
      id: fileId,
      containerName: "asset-uploads",
      blobName: "123/document-unique.pdf",
      ownerIdHash: "a".repeat(64),
    }
    dbMocks.query.mockResolvedValue({ rows: [metadata], rowCount: 1 })

    await expect(getAzureFileMetadata(fileId)).resolves.toEqual(metadata)
  })

  it("rejects invalid identifiers without querying PostgreSQL", async () => {
    await expect(getAzureFileMetadata("not-a-file-id")).resolves.toBeNull()
    await deleteAzureFileMetadata("not-a-file-id")
    expect(dbMocks.query).not.toHaveBeenCalled()
  })
})
