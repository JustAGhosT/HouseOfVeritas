import { readFile, writeFile, mkdir } from "fs/promises"
import { dirname, join } from "path"
import { getCollection, isMongoConfigured } from "@/lib/db/mongodb"
import type { ProjectStorageType, ScopeKind } from "@/lib/projects"

const SUGGESTIONS_FILE = join(process.cwd(), "data", "project-suggestions.json")
const SUGGESTIONS_COLLECTION = "project_suggestions"

export interface ProjectSuggestion {
  id: string
  name: string
  description?: string
  type: ProjectStorageType
  scopeKind?: ScopeKind
  parentId?: string
  suggestedBy: string
  suggestedAt: string
  status: "pending" | "approved" | "rejected"
  reviewedBy?: string
  reviewedAt?: string
}

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true" && !isMongoConfigured()) {
    throw new Error("Project suggestion datastore is not configured. Set MONGODB_URI for production.")
  }
}

async function readFileSuggestions(): Promise<ProjectSuggestion[]> {
  try {
    const data = await readFile(SUGGESTIONS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeFileSuggestions(suggestions: ProjectSuggestion[]): Promise<void> {
  await mkdir(dirname(SUGGESTIONS_FILE), { recursive: true })
  await writeFile(SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2), "utf-8")
}

export async function listProjectSuggestions(): Promise<ProjectSuggestion[]> {
  requireProductionStore()
  if (!isMongoConfigured()) return readFileSuggestions()

  const collection = await getCollection<ProjectSuggestion>(SUGGESTIONS_COLLECTION)
  return collection.find({}).sort({ suggestedAt: 1 }).toArray()
}

export async function saveProjectSuggestions(suggestions: ProjectSuggestion[]): Promise<void> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    await writeFileSuggestions(suggestions)
    return
  }

  const collection = await getCollection<ProjectSuggestion>(SUGGESTIONS_COLLECTION)
  await collection.deleteMany({})
  if (suggestions.length > 0) await collection.insertMany(suggestions)
}
