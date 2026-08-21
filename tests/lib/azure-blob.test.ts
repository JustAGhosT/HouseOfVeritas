import { describe, expect, it, vi } from "vitest"

const storageMocks = vi.hoisted(() => ({
  fromConnectionString: vi.fn(),
  blobServiceClient: vi.fn(),
  sharedKeyCredential: vi.fn(),
  managedIdentityCredential: vi.fn(class ManagedIdentityCredential {}),
}))

vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: Object.assign(storageMocks.blobServiceClient, {
    fromConnectionString: storageMocks.fromConnectionString,
  }),
  StorageSharedKeyCredential: storageMocks.sharedKeyCredential,
}))

vi.mock("@azure/identity", () => ({
  ManagedIdentityCredential: storageMocks.managedIdentityCredential,
}))

import {
  createAzureBlobServiceClient,
  hashAzureFileOwner,
  isAzureBlobConfigured,
  resolveAzureFileById,
} from "@/lib/storage/azure-blob"

describe("Azure Blob authentication", () => {
  it("treats an account name without a shared key as managed-identity configuration", () => {
    expect(isAzureBlobConfigured({ accountName: "nexprodhovst" })).toBe(true)
  })

  it("uses deterministic managed identity when only the account name is set", () => {
    createAzureBlobServiceClient({ accountName: "nexprodhovst" })

    expect(storageMocks.managedIdentityCredential).toHaveBeenCalledOnce()
    expect(storageMocks.blobServiceClient).toHaveBeenCalledWith(
      "https://nexprodhovst.blob.core.windows.net",
      expect.any(storageMocks.managedIdentityCredential)
    )
  })

  it("preserves connection-string compatibility during rollback", () => {
    createAzureBlobServiceClient({ connectionString: "UseDevelopmentStorage=true" })

    expect(storageMocks.fromConnectionString).toHaveBeenCalledWith("UseDevelopmentStorage=true")
  })

  it("resolves an opaque file id to its authoritative blob and owner metadata", async () => {
    const blobClient = {
      getProperties: vi.fn().mockResolvedValue({ metadata: { hovowneridhash: "a".repeat(64) } }),
    }
    const serviceClient = {
      findBlobsByTags: vi.fn(async function* () {
        yield { containerName: "asset-uploads", name: "path/photo.jpg" }
      }),
      getContainerClient: vi.fn(() => ({ getBlobClient: vi.fn(() => blobClient) })),
    }

    const resolved = await resolveAzureFileById(
      serviceClient as never,
      "82e54ed5-200d-4ce0-86f4-ff1f27689031"
    )

    expect(serviceClient.findBlobsByTags).toHaveBeenCalledWith(
      "hovFileId='82e54ed5-200d-4ce0-86f4-ff1f27689031'"
    )
    expect(resolved).toEqual({ blobClient, ownerIdHash: "a".repeat(64) })
  })

  it("rejects invalid and ambiguous file identifiers", async () => {
    const serviceClient = {
      findBlobsByTags: vi.fn(async function* () {
        yield { containerName: "documents", name: "one" }
        yield { containerName: "documents", name: "two" }
      }),
    }

    await expect(resolveAzureFileById(serviceClient as never, "not-a-uuid")).resolves.toBeNull()
    await expect(
      resolveAzureFileById(serviceClient as never, "82e54ed5-200d-4ce0-86f4-ff1f27689031")
    ).rejects.toThrow("Azure file metadata is ambiguous")
  })

  it("hashes owner identifiers without persisting the identifier itself", () => {
    expect(hashAzureFileOwner("resident-1")).toMatch(/^[a-f0-9]{64}$/)
    expect(hashAzureFileOwner("resident-1")).not.toContain("resident-1")
  })
})
