import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import type { ObjectId } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import type {
  GuidanceDraft,
  GuidancePack,
  GuidanceSource,
  TaskGuidanceBinding,
} from "@/lib/guidance"

const GUIDANCE_FILE = join(process.cwd(), "data", "task-guidance.json")
const BINDINGS_FILE = join(process.cwd(), "data", "task-guidance-bindings.json")
const GUIDANCE_COLLECTION = "task_guidance"
const BINDINGS_COLLECTION = "task_guidance_bindings"

type GuidanceDocument = GuidancePack & { _id?: ObjectId }
type BindingDocument = TaskGuidanceBinding & { _id?: ObjectId }

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true" && !isMongoConfigured()) {
    throw new Error("Task guidance datastore is not configured. Set MONGODB_URI for production.")
  }
}

function isUsingFileStore(): boolean {
  return process.env.E2E_TEST === "1" || process.env.CI === "true" || !isMongoConfigured()
}

async function readJsonList<T>(filePath: string): Promise<T[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf-8"))
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

async function writeJsonList<T>(filePath: string, data: T[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
}

async function getBinding(taskId: string): Promise<TaskGuidanceBinding | null> {
  if (isUsingFileStore()) {
    const bindings = await readJsonList<TaskGuidanceBinding>(BINDINGS_FILE)
    return bindings.find((binding) => binding.taskId === taskId && binding.active) ?? null
  }

  const collection = await getCollection<BindingDocument>(BINDINGS_COLLECTION)
  const binding = await collection.findOne({ taskId, active: true })
  return binding ? withoutMongoId(binding) : null
}

async function getGuidance(guidancePackId: string): Promise<GuidancePack | null> {
  if (isUsingFileStore()) {
    const packs = await readJsonList<GuidancePack>(GUIDANCE_FILE)
    return packs.find((pack) => pack.id === guidancePackId) ?? null
  }

  const collection = await getCollection<GuidanceDocument>(GUIDANCE_COLLECTION)
  const pack = await collection.findOne({ id: guidancePackId })
  return pack ? withoutMongoId(pack) : null
}

export async function getActiveGuidanceForTask(taskId: string): Promise<GuidancePack | null> {
  requireProductionStore()
  const binding = await getBinding(taskId)
  return binding ? getGuidance(binding.guidancePackId) : null
}

export async function createAndBindGuidance(params: {
  taskId: string
  draft: GuidanceDraft
  source: GuidanceSource
  createdBy: string
}): Promise<{ guidance: GuidancePack; binding: TaskGuidanceBinding }> {
  requireProductionStore()
  const existing = await getBinding(params.taskId)
  const now = new Date().toISOString()
  const version = (existing?.version ?? 0) + 1
  const guidance: GuidancePack = {
    ...params.draft,
    id: `guidance-${randomUUID()}`,
    version,
    status: "published",
    steps: params.draft.steps.map((step) => ({
      ...step,
      id: `guidance-step-${randomUUID()}`,
    })),
    source: params.source,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  }
  const binding: TaskGuidanceBinding = {
    taskId: params.taskId,
    guidancePackId: guidance.id,
    version,
    active: true,
    createdBy: params.createdBy,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (isUsingFileStore()) {
    const packs = await readJsonList<GuidancePack>(GUIDANCE_FILE)
    const bindings = await readJsonList<TaskGuidanceBinding>(BINDINGS_FILE)
    packs.push(guidance)
    const bindingIndex = bindings.findIndex((item) => item.taskId === params.taskId)
    if (bindingIndex === -1) bindings.push(binding)
    else bindings[bindingIndex] = binding
    await Promise.all([writeJsonList(GUIDANCE_FILE, packs), writeJsonList(BINDINGS_FILE, bindings)])
    return { guidance, binding }
  }

  const guidanceCollection = await getCollection<GuidanceDocument>(GUIDANCE_COLLECTION)
  const bindingCollection = await getCollection<BindingDocument>(BINDINGS_COLLECTION)
  await guidanceCollection.insertOne(guidance)
  await bindingCollection.replaceOne({ taskId: params.taskId }, binding, { upsert: true })
  return { guidance, binding }
}
