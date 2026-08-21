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

import { createAzureBlobServiceClient, isAzureBlobConfigured } from "@/lib/storage/azure-blob"

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
})
