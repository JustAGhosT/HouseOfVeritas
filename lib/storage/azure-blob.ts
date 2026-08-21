import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob"
import { ManagedIdentityCredential } from "@azure/identity"
import { createHash } from "node:crypto"

export interface AzureBlobConfiguration {
  connectionString?: string
  accountName?: string
  accountKey?: string
}

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function hashAzureFileOwner(userId: string): string {
  return createHash("sha256").update(userId, "utf8").digest("hex")
}

export async function resolveAzureFileById(serviceClient: BlobServiceClient, fileId: string) {
  if (!FILE_ID_PATTERN.test(fileId)) return null

  const matches = []
  for await (const item of serviceClient.findBlobsByTags(`hovFileId='${fileId}'`)) {
    matches.push(item)
    if (matches.length > 1) {
      throw new Error("Azure file metadata is ambiguous")
    }
  }
  if (matches.length === 0) return null

  const match = matches[0]
  const blobClient = serviceClient.getContainerClient(match.containerName).getBlobClient(match.name)
  const properties = await blobClient.getProperties()
  const ownerIdHash = properties.metadata?.hovowneridhash
  if (!ownerIdHash || !/^[a-f0-9]{64}$/.test(ownerIdHash)) {
    throw new Error("Azure file owner metadata is missing or invalid")
  }

  return { blobClient, ownerIdHash }
}

export function isAzureBlobConfigured(config: AzureBlobConfiguration): boolean {
  return Boolean(config.connectionString || config.accountName)
}

export function createAzureBlobServiceClient(config: AzureBlobConfiguration): BlobServiceClient {
  if (config.connectionString) {
    return BlobServiceClient.fromConnectionString(config.connectionString)
  }

  if (!config.accountName) {
    throw new Error("Azure Blob Storage account name is required")
  }

  const serviceUrl = `https://${config.accountName}.blob.core.windows.net`

  if (config.accountKey) {
    return new BlobServiceClient(
      serviceUrl,
      new StorageSharedKeyCredential(config.accountName, config.accountKey)
    )
  }

  // Production uses the App Service system-assigned identity. This intentionally
  // avoids DefaultAzureCredential so hosted authentication cannot fall through
  // to developer or CLI credentials.
  return new BlobServiceClient(serviceUrl, new ManagedIdentityCredential())
}
