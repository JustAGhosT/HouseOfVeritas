import { readFile, writeFile, mkdir } from "fs/promises"
import { dirname, join } from "path"
import type { Filter } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import type { ConcreteMixRecord } from "@/lib/concrete-mix-records"

const RECORDS_FILE = join(process.cwd(), "data", "concrete-mixes.json")
const RECORDS_COLLECTION = "concrete_mixes"

type ConcreteMixDocument = ConcreteMixRecord & { _id?: unknown }

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true" && !isMongoConfigured()) {
    throw new Error("Concrete mix datastore is not configured. Set MONGODB_URI for production.")
  }
}

async function readFileRecords(): Promise<ConcreteMixRecord[]> {
  try {
    const data = await readFile(RECORDS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeFileRecords(records: ConcreteMixRecord[]): Promise<void> {
  await mkdir(dirname(RECORDS_FILE), { recursive: true })
  await writeFile(RECORDS_FILE, JSON.stringify(records, null, 2), "utf-8")
}

export async function listConcreteMixRecords(): Promise<ConcreteMixRecord[]> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const records = await readFileRecords()
    return records.sort((left, right) => left.name.localeCompare(right.name))
  }

  const collection = await getCollection<ConcreteMixDocument>(RECORDS_COLLECTION)
  const records = await collection.find({}).sort({ name: 1 }).toArray()
  return records.map(withoutMongoId)
}

export async function findConcreteMixRecordById(id: string): Promise<ConcreteMixRecord | null> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const records = await readFileRecords()
    return records.find((record) => record.id === id) ?? null
  }

  const collection = await getCollection<ConcreteMixDocument>(RECORDS_COLLECTION)
  const record = await collection.findOne({ id } as Filter<ConcreteMixDocument>)
  return record ? withoutMongoId(record) : null
}

export async function createConcreteMixRecord(
  record: ConcreteMixRecord
): Promise<ConcreteMixRecord> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const records = await readFileRecords()
    records.push(record)
    await writeFileRecords(records)
    return record
  }

  const collection = await getCollection<ConcreteMixDocument>(RECORDS_COLLECTION)
  await collection.insertOne(record)
  return record
}

export async function replaceConcreteMixRecord(
  record: ConcreteMixRecord
): Promise<ConcreteMixRecord | null> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const records = await readFileRecords()
    const index = records.findIndex((entry) => entry.id === record.id)
    if (index === -1) return null
    records[index] = record
    await writeFileRecords(records)
    return record
  }

  const collection = await getCollection<ConcreteMixDocument>(RECORDS_COLLECTION)
  const document = withoutMongoId(record as ConcreteMixDocument)
  const result = await collection.replaceOne(
    { id: record.id } as Filter<ConcreteMixDocument>,
    document
  )
  return result.matchedCount > 0 ? document : null
}

export async function deleteConcreteMixRecord(id: string): Promise<boolean> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const records = await readFileRecords()
    const filtered = records.filter((record) => record.id !== id)
    if (filtered.length === records.length) return false
    await writeFileRecords(filtered)
    return true
  }

  const collection = await getCollection<ConcreteMixDocument>(RECORDS_COLLECTION)
  const result = await collection.deleteOne({ id } as Filter<ConcreteMixDocument>)
  return result.deletedCount === 1
}
