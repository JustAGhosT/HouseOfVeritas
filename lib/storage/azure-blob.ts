import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob"
import { ManagedIdentityCredential } from "@azure/identity"

export interface AzureBlobConfiguration {
  connectionString?: string
  accountName?: string
  accountKey?: string
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
