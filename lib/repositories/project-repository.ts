import { readFile, writeFile, mkdir } from "fs/promises"
import { dirname, join } from "path"
import type { Filter } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import type { Project } from "@/lib/projects"

const PROJECTS_FILE = join(process.cwd(), "data", "projects.json")
const PROJECTS_COLLECTION = "projects"

type ProjectDocument = Project & { _id?: unknown }

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true" && !isMongoConfigured()) {
    throw new Error("Project datastore is not configured. Set MONGODB_URI for production.")
  }
}

async function readFileProjects(): Promise<Project[]> {
  try {
    const data = await readFile(PROJECTS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeFileProjects(projects: Project[]): Promise<void> {
  await mkdir(dirname(PROJECTS_FILE), { recursive: true })
  await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8")
}

export async function listProjects(): Promise<Project[]> {
  requireProductionStore()
  if (!isMongoConfigured()) return readFileProjects()

  const collection = await getCollection<ProjectDocument>(PROJECTS_COLLECTION)
  const projects = await collection.find({}).sort({ createdAt: 1 }).toArray()
  return projects.map(withoutMongoId)
}

export async function findProjectById(id: string): Promise<Project | null> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const projects = await readFileProjects()
    return projects.find((project) => project.id === id) ?? null
  }

  const collection = await getCollection<ProjectDocument>(PROJECTS_COLLECTION)
  const project = await collection.findOne({ id } as Filter<ProjectDocument>)
  return project ? withoutMongoId(project) : null
}

export async function createProject(project: Project): Promise<Project> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const projects = await readFileProjects()
    projects.push(project)
    await writeFileProjects(projects)
    return project
  }

  const collection = await getCollection<ProjectDocument>(PROJECTS_COLLECTION)
  await collection.insertOne(project)
  return project
}

export async function replaceProject(project: Project): Promise<Project | null> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const projects = await readFileProjects()
    const index = projects.findIndex((item) => item.id === project.id)
    if (index === -1) return null
    projects[index] = project
    await writeFileProjects(projects)
    return project
  }

  const collection = await getCollection<ProjectDocument>(PROJECTS_COLLECTION)
  const document = withoutMongoId(project as ProjectDocument)
  const result = await collection.replaceOne({ id: project.id } as Filter<ProjectDocument>, document)
  return result.matchedCount > 0 ? document : null
}

export async function deleteProject(id: string): Promise<boolean> {
  requireProductionStore()
  if (!isMongoConfigured()) {
    const projects = await readFileProjects()
    const filtered = projects.filter((project) => project.id !== id)
    if (filtered.length === projects.length) return false
    await writeFileProjects(filtered)
    return true
  }

  const collection = await getCollection<ProjectDocument>(PROJECTS_COLLECTION)
  const result = await collection.deleteOne({ id } as Filter<ProjectDocument>)
  return result.deletedCount === 1
}

export async function getProjectNamesForMemberFromStore(userId: string): Promise<string[]> {
  const projects = await listProjects()
  return projects.filter((project) => project.members?.some((member) => member.userId === userId)).map((project) => project.name)
}
