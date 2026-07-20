import { MongoClient, Db, Collection, ObjectId } from "mongodb"
import { logger } from "@/lib/logger"

// MongoDB connection
const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb://localhost:27017"
const DB_NAME = process.env.DB_NAME || "house_of_veritas"

let client: MongoClient | null = null
let db: Db | null = null

export function isMongoConfigured(): boolean {
  return !!(process.env.MONGODB_URI || process.env.MONGO_URL)
}

export async function getDatabase(): Promise<Db> {
  if (db) return db

  try {
    client = new MongoClient(MONGO_URL)
    await client.connect()
    db = client.db(DB_NAME)
    logger.info(`MongoDB connected to ${DB_NAME}`)
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
  }
}

// Helper to convert MongoDB _id to string id
export function sanitizeDocument<T extends { _id?: ObjectId }>(
  doc: T
): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc
  return {
    ...rest,
    id: _id?.toString() || "",
  } as Omit<T, "_id"> & { id: string }
}

// Helper to sanitize multiple documents
export function sanitizeDocuments<T extends { _id?: ObjectId }>(
  docs: T[]
): (Omit<T, "_id"> & { id: string })[] {
  return docs.map(sanitizeDocument)
}
