import { readFile, writeFile, mkdir } from "fs/promises"
import { dirname, join } from "path"
import type { Filter } from "mongodb"
import { getCollection, isMongoConfigured } from "@/lib/db/mongodb"
import type { Project } from "@/lib/projects"

const PROJECTS_FILE = join(process.cwd(), "data", "projects.json")
const PROJECTS_COLLECTION = "projects"

type ProjectDocument = Project

function requireProductionStore(): void {
  if (process.env.NODE_ENV === "production" && !isMongoConfigured()) {
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

function toProject(doc: ProjectDocument): Project {
  return doc
}

export async function listProjects(): Promise<Project[]> {
  requireProductionStore()
  if (!isMongoConfigured()) return readFileProjects()

  const collection = await getCollection<ProjectDocument>(PROJECTS_COLLECTION)
  const docs = await collection.find({}).sort({ createdAt: 1 }).toArray()
  return docs.map(toProject)
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

export async function getProjectNamesForMemberFromStore(userId: string): Promise<string[]> {
  const projects = await listProjects()
  return projects.filter((project) => project.members?.some((member) => member.userId === userId)).map((project) => project.name)
}

