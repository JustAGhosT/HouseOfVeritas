import { readFile, writeFile, mkdir } from "fs/promises"
import { dirname, join } from "path"
import type { Filter } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import type { Task } from "@/lib/domain/estate-types"

export type JobAreaKind = "room" | "area" | "component" | "zone"

export interface JobArea {
  id: string
  projectId: string
  name: string
  kind: JobAreaKind
  notes?: string
  createdAt: string
  updatedAt: string
}

export type JobAllocationType = "material" | "labour"

export interface JobAllocation {
  id: string
  projectId: string
  type: JobAllocationType
  name: string
  areaId?: string
  quantity?: number
  unit?: string
  hours?: number
  rateCents?: number
  costCents?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface JobTaskMetadata {
  taskId: number
  projectId: string
  areaId?: string
  groupName?: string
  createdAt: string
  updatedAt: string
}

type JobAreaDocument = JobArea & { _id?: unknown }
type JobAllocationDocument = JobAllocation & { _id?: unknown }
type JobTaskMetadataDocument = JobTaskMetadata & { _id?: unknown }

export interface GroupedJobTask extends Task {
  areaId?: string
  groupName?: string
}

const DATA_DIR = join(process.cwd(), "data")
const AREAS_FILE = join(DATA_DIR, "job-areas.json")
const ALLOCATIONS_FILE = join(DATA_DIR, "job-allocations.json")
const TASK_METADATA_FILE = join(DATA_DIR, "job-task-groups.json")

const AREAS_COLLECTION = "job_areas"
const ALLOCATIONS_COLLECTION = "job_allocations"
const TASK_METADATA_COLLECTION = "job_task_metadata"

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true" && !isMongoConfigured()) {
    throw new Error("Job workspace datastore is not configured. Set MONGODB_URI for production.")
  }
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const data = await readFile(path, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeJsonArray<T>(path: string, items: T[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(items, null, 2), "utf-8")
}

export async function listJobAreas(projectId: string): Promise<JobArea[]> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const areas = await readJsonArray<JobArea>(AREAS_FILE)
    return areas.filter((area) => area.projectId === projectId)
  }

  const collection = await getCollection<JobAreaDocument>(AREAS_COLLECTION)
  const areas = await collection.find({ projectId } as Filter<JobAreaDocument>).sort({ createdAt: 1 }).toArray()
  return areas.map(withoutMongoId)
}

export async function createJobArea(area: JobArea): Promise<JobArea> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const areas = await readJsonArray<JobArea>(AREAS_FILE)
    areas.push(area)
    await writeJsonArray(AREAS_FILE, areas)
    return area
  }

  const collection = await getCollection<JobAreaDocument>(AREAS_COLLECTION)
  await collection.insertOne(area)
  return area
}

export async function listJobAllocations(projectId: string, type?: JobAllocationType): Promise<JobAllocation[]> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const allocations = await readJsonArray<JobAllocation>(ALLOCATIONS_FILE)
    return allocations.filter((allocation) => allocation.projectId === projectId && (!type || allocation.type === type))
  }

  const query: Filter<JobAllocationDocument> = type ? { projectId, type } : { projectId }
  const collection = await getCollection<JobAllocationDocument>(ALLOCATIONS_COLLECTION)
  const allocations = await collection.find(query).sort({ createdAt: 1 }).toArray()
  return allocations.map(withoutMongoId)
}

export async function createJobAllocation(allocation: JobAllocation): Promise<JobAllocation> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const allocations = await readJsonArray<JobAllocation>(ALLOCATIONS_FILE)
    allocations.push(allocation)
    await writeJsonArray(ALLOCATIONS_FILE, allocations)
    return allocation
  }

  const collection = await getCollection<JobAllocationDocument>(ALLOCATIONS_COLLECTION)
  await collection.insertOne(allocation)
  return allocation
}

export async function listJobTaskMetadata(projectId: string): Promise<JobTaskMetadata[]> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const metadata = await readJsonArray<JobTaskMetadata>(TASK_METADATA_FILE)
    return metadata.filter((item) => item.projectId === projectId)
  }

  const collection = await getCollection<JobTaskMetadataDocument>(TASK_METADATA_COLLECTION)
  const metadata = await collection.find({ projectId } as Filter<JobTaskMetadataDocument>).sort({ createdAt: 1 }).toArray()
  return metadata.map(withoutMongoId)
}

export async function createJobTaskMetadata(metadata: JobTaskMetadata): Promise<JobTaskMetadata> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const items = await readJsonArray<JobTaskMetadata>(TASK_METADATA_FILE)
    items.push(metadata)
    await writeJsonArray(TASK_METADATA_FILE, items)
    return metadata
  }

  const collection = await getCollection<JobTaskMetadataDocument>(TASK_METADATA_COLLECTION)
  await collection.insertOne(metadata)
  return metadata
}
