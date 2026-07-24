import type { Collection } from "mongodb"
import { getCollection, isMongoConfigured } from "@/lib/db/mongodb"
import { getInventory, type InventoryItem } from "@/lib/inventory-store"

export interface InventoryRepository {
  list(): Promise<InventoryItem[]>
  findById(id: string): Promise<InventoryItem | undefined>
  findByName(name: string): Promise<InventoryItem | undefined>
  create(item: InventoryItem): Promise<InventoryItem>
  update(item: InventoryItem): Promise<InventoryItem>
  restockByName(itemName: string, quantity: number): Promise<InventoryItem | null>
}

type InventoryDocument = InventoryItem

function clone(item: InventoryItem): InventoryItem {
  return JSON.parse(JSON.stringify(item)) as InventoryItem
}

function toDocument(item: InventoryItem): InventoryDocument {
  return clone(item)
}

function fromDocument(document: InventoryDocument): InventoryItem {
  return clone(document)
}

function findMatchingItem(items: InventoryItem[], name: string): InventoryItem | undefined {
  const normalized = name.toLowerCase().trim()
  if (!normalized) return undefined
  return items.find(
    (item) =>
      item.name.toLowerCase().trim() === normalized ||
      item.name.toLowerCase().includes(normalized) ||
      normalized.includes(item.name.toLowerCase())
  )
}

const memoryRepository: InventoryRepository = {
  async list() {
    return getInventory().map(clone)
  },
  async findById(id) {
    const item = getInventory().find((candidate) => candidate.id === id)
    return item ? clone(item) : undefined
  },
  async findByName(name) {
    const item = findMatchingItem(getInventory(), name)
    return item ? clone(item) : undefined
  },
  async create(item) {
    getInventory().push(item)
    return clone(item)
  },
  async update(item) {
    const items = getInventory()
    const index = items.findIndex((candidate) => candidate.id === item.id)
    if (index === -1) throw new Error("Inventory item not found")
    items[index] = item
    return clone(item)
  },
  async restockByName(itemName, quantity) {
    if (quantity <= 0) return null
    const item = findMatchingItem(getInventory(), itemName)
    if (!item) return null
    item.currentStock += quantity
    item.totalValue = item.currentStock * item.unitCost
    item.lastRestocked = new Date().toISOString().slice(0, 10)
    return clone(item)
  },
}

async function createMongoRepository(): Promise<InventoryRepository> {
  const collection: Collection<InventoryDocument> = await getCollection<InventoryDocument>(
    "inventory_items"
  )
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ barcode: 1 }),
    collection.createIndex({ capturedBy: 1 }),
    collection.createIndex({ ownerId: 1 }),
    collection.createIndex({ responsibleUserId: 1 }),
    collection.createIndex({ linkedUserIds: 1 }),
  ])

  const repository: InventoryRepository = {
    async list() {
      const documents = await collection.find({}).sort({ name: 1 }).toArray()
      return documents.map(fromDocument)
    },
    async findById(id) {
      const document = await collection.findOne({ id })
      return document ? fromDocument(document) : undefined
    },
    async findByName(name) {
      const item = findMatchingItem(await repository.list(), name)
      return item
    },
    async create(item) {
      await collection.insertOne(toDocument(item))
      return clone(item)
    },
    async update(item) {
      const result = await collection.replaceOne({ id: item.id }, toDocument(item))
      if (result.matchedCount === 0) throw new Error("Inventory item not found")
      return clone(item)
    },
    async restockByName(itemName, quantity) {
      if (quantity <= 0) return null
      const item = await repository.findByName(itemName)
      if (!item) return null
      item.currentStock += quantity
      item.totalValue = item.currentStock * item.unitCost
      item.lastRestocked = new Date().toISOString().slice(0, 10)
      return repository.update(item)
    },
  }
  return repository
}

let cachedRepository: InventoryRepository | null = null
let cachedMode: "mongodb" | "memory" | null = null

export async function getInventoryRepository(): Promise<{
  repository: InventoryRepository
  mode: "mongodb" | "memory"
}> {
  if (cachedRepository && cachedMode) {
    return { repository: cachedRepository, mode: cachedMode }
  }

  const useMemory = process.env.E2E_TEST === "1" || process.env.CI === "true" || !isMongoConfigured()
  if (useMemory) {
    cachedRepository = memoryRepository
    cachedMode = "memory"
    return { repository: cachedRepository, mode: cachedMode }
  }

  cachedRepository = await createMongoRepository()
  cachedMode = "mongodb"
  return { repository: cachedRepository, mode: cachedMode }
}

export function resetInventoryRepositoryForTests() {
  cachedRepository = null
  cachedMode = null
}
