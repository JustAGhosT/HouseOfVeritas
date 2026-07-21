import { MongoClient, Db, Collection, ObjectId } from "mongodb"
import { logger } from "@/lib/logger"

let client: MongoClient | null = null
let db: Db | null = null
let activeConnectionKey: string | null = null

function getMongoUrl(): string {
  return process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb://localhost:27017"
}

function getDatabaseName(): string {
  return process.env.DB_NAME || "house_of_veritas"
}

export function isMongoConfigured(): boolean {
  return !!(process.env.MONGODB_URI || process.env.MONGO_URL)
}

export async function getDatabase(): Promise<Db> {
  const mongoUrl = getMongoUrl()
  const databaseName = getDatabaseName()
  const connectionKey = `${mongoUrl}|${databaseName}`
  if (db && activeConnectionKey === connectionKey) return db

  if (client) {
    await client.close()
    client = null
    db = null
    activeConnectionKey = null
  }

  try {
    client = new MongoClient(mongoUrl)
    await client.connect()
    db = client.db(databaseName)
    activeConnectionKey = connectionKey
    logger.info(`MongoDB connected to ${databaseName}`)
    return db
  } catch (error) {
    logger.error("MongoDB connection error", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function getCollection<T extends object>(
  name: string
): Promise<Collection<T>> {
  const database = await getDatabase()
  return database.collection<T>(name)
}

// Close connection (for cleanup)
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
    activeConnectionKey = null
  }
}

export function withoutMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc
  return rest
}

// Helper to convert MongoDB _id to string id
export function sanitizeDocument<T extends { _id?: ObjectId }>(
  doc: T
): Omit<T, "_id"> & { id: string } {
  const rest = withoutMongoId(doc)
  return {
    ...rest,
    id: "id" in rest && typeof rest.id === "string" && rest.id ? rest.id : doc._id?.toString() || "",
  } as Omit<T, "_id"> & { id: string }
}

// Helper to sanitize multiple documents
export function sanitizeDocuments<T extends { _id?: ObjectId }>(
  docs: T[]
): (Omit<T, "_id"> & { id: string })[] {
  return docs.map(sanitizeDocument)
}
