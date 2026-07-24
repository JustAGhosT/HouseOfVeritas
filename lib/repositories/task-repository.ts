import { randomBytes } from "crypto"
import type { Collection, Filter, ObjectId } from "mongodb"
import { getCollection } from "@/lib/db/mongodb"
import type { Task } from "@/lib/services/baserow"

export interface TaskFilters {
  assignedTo?: number
  assignedToName?: string
  status?: string
}

export interface TaskRepository {
  list(filters?: TaskFilters): Promise<Task[]>
  create(task: Omit<Task, "id">): Promise<Task>
  update(id: number, updates: Partial<Task>): Promise<Task | null>
}

type TaskDocument = Task & { _id?: ObjectId }

const memoryTasks: Task[] = []

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function matchesFilters(task: Task, filters?: TaskFilters): boolean {
  if (!filters) return true
  if (filters.assignedTo !== undefined && task.assignedTo !== filters.assignedTo) return false
  if (
    filters.assignedTo === undefined &&
    filters.assignedToName &&
    (task.assignedToName ?? "").toLowerCase() !== filters.assignedToName.toLowerCase()
  ) {
    return false
  }
  return !filters.status || task.status === filters.status
}

function createTaskId(): number {
  return randomBytes(6).readUIntBE(0, 6)
}

const memoryRepository: TaskRepository = {
  async list(filters) {
    return memoryTasks.filter((task) => matchesFilters(task, filters)).map(clone)
  },
  async create(task) {
    const created: Task = {
      ...clone(task),
      id: createTaskId(),
      createdDate: task.createdDate ?? new Date().toISOString(),
    }
    memoryTasks.push(created)
    return clone(created)
  },
  async update(id, updates) {
    const index = memoryTasks.findIndex((task) => task.id === id)
    if (index === -1) return null
    memoryTasks[index] = { ...memoryTasks[index], ...clone(updates), id }
    return clone(memoryTasks[index])
  },
}

async function createMongoRepository(): Promise<TaskRepository> {
  const collection: Collection<TaskDocument> = await getCollection<TaskDocument>("tasks")
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ assignedTo: 1 }),
    collection.createIndex({ assignedToName: 1 }),
    collection.createIndex({ status: 1 }),
    collection.createIndex({ createdDate: -1, id: -1 }),
  ])

  return {
    async list(filters) {
      const query: Filter<TaskDocument> = {}
      if (filters?.assignedTo !== undefined) query.assignedTo = filters.assignedTo
      if (filters?.status) query.status = filters.status as Task["status"]

      let documents = await collection.find(query).sort({ createdDate: -1, id: -1 }).toArray()
      if (filters?.assignedTo === undefined && filters?.assignedToName) {
        const assignedToName = filters.assignedToName.toLowerCase()
        documents = documents.filter(
          (task) => (task.assignedToName ?? "").toLowerCase() === assignedToName
        )
      }
      return documents.map(({ _id: _ignored, ...task }) => clone(task))
    },
    async create(task) {
      const created: Task = {
        ...clone(task),
        id: createTaskId(),
        createdDate: task.createdDate ?? new Date().toISOString(),
      }
      await collection.insertOne(created)
      return clone(created)
    },
    async update(id, updates) {
      const result = await collection.findOneAndUpdate(
        { id },
        { $set: clone(updates) },
        { returnDocument: "after" }
      )
      const document = result.value
      if (!document) return null
      const { _id: _ignored, ...task } = document
      return clone(task)
    },
  }
}

let cachedMongoRepository: TaskRepository | null = null

export async function getTaskRepository(mode: "mongodb" | "memory"): Promise<TaskRepository> {
  if (mode === "memory") return memoryRepository
  cachedMongoRepository ??= await createMongoRepository()
  return cachedMongoRepository
}

export function resetTaskRepositoryForTests(): void {
  memoryTasks.splice(0, memoryTasks.length)
  cachedMongoRepository = null
}
