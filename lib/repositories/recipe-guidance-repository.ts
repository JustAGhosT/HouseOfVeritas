import { randomUUID } from "crypto"
import { mkdir, readFile, rename, writeFile } from "fs/promises"
import { dirname, join } from "path"
import type { Collection, ObjectId } from "mongodb"
import { getCollection, isMongoConfigured, withoutMongoId } from "@/lib/db/mongodb"
import { parseRecipeGuidanceDocument, type RecipeGuidanceDocument } from "@/lib/recipe-guidance"

export const RECIPE_GUIDANCE_COLLECTION = "recipe_guidance_documents"

const RECIPE_GUIDANCE_FILE = join(process.cwd(), "data", "recipe-guidance-documents.json")

type RecipeGuidanceMongoDocument = RecipeGuidanceDocument & { _id?: ObjectId }
export type RecipeGuidanceRepositoryMode = "memory" | "file" | "mongodb"

export class RecipeGuidanceConflictError extends Error {}
export class RecipeGuidanceIntegrityError extends Error {}
export class RecipeGuidanceStoreUnavailableError extends Error {}

export interface RecipeGuidanceRepository {
  listByRecipeId(recipeId: string): Promise<RecipeGuidanceDocument[]>
  findById(id: string): Promise<RecipeGuidanceDocument | null>
  findLatestPublished(recipeId: string): Promise<RecipeGuidanceDocument | null>
  create(document: RecipeGuidanceDocument): Promise<RecipeGuidanceDocument>
  replace(
    document: RecipeGuidanceDocument,
    expectedUpdatedAt: string
  ): Promise<RecipeGuidanceDocument>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function parseStoredDocument(input: unknown): RecipeGuidanceDocument {
  const document = parseRecipeGuidanceDocument(input)
  if (!document) {
    throw new RecipeGuidanceIntegrityError("Stored recipe guidance is invalid")
  }
  return document
}

function parseStoredDocuments(input: unknown): RecipeGuidanceDocument[] {
  if (!Array.isArray(input)) {
    throw new RecipeGuidanceIntegrityError("Recipe guidance store must contain a list")
  }
  return input.map(parseStoredDocument)
}

function validateWrite(document: RecipeGuidanceDocument): RecipeGuidanceDocument {
  const parsed = parseRecipeGuidanceDocument(document)
  if (!parsed) {
    throw new RecipeGuidanceIntegrityError("Recipe guidance write is invalid")
  }
  return parsed
}

function sortVersions(documents: RecipeGuidanceDocument[]): RecipeGuidanceDocument[] {
  return [...documents].sort((left, right) => right.version - left.version)
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

function archivalContent(document: RecipeGuidanceDocument): string {
  const { status, updatedAt, ...content } = document
  return JSON.stringify(content)
}

function assertNewDraft(document: RecipeGuidanceDocument): void {
  if (document.status !== "draft") {
    throw new RecipeGuidanceConflictError("New recipe guidance versions must begin as drafts")
  }
}

function assertReplacementAllowed(
  current: RecipeGuidanceDocument,
  next: RecipeGuidanceDocument,
  expectedUpdatedAt: string
): void {
  if (current.updatedAt !== expectedUpdatedAt) {
    throw new RecipeGuidanceConflictError("Recipe guidance changed before this update")
  }
  if (new Date(next.updatedAt).getTime() <= new Date(current.updatedAt).getTime()) {
    throw new RecipeGuidanceConflictError(
      "Recipe guidance updatedAt must advance on every replacement"
    )
  }
  if (
    current.id !== next.id ||
    current.recipeId !== next.recipeId ||
    current.recipeRevisionId !== next.recipeRevisionId ||
    JSON.stringify(current.recipeIngredientIds) !== JSON.stringify(next.recipeIngredientIds) ||
    JSON.stringify(current.recipeStepIds) !== JSON.stringify(next.recipeStepIds) ||
    current.version !== next.version ||
    current.createdAt !== next.createdAt ||
    current.createdBy !== next.createdBy
  ) {
    throw new RecipeGuidanceConflictError("Immutable recipe guidance identity changed")
  }
  if (current.status === "archived") {
    throw new RecipeGuidanceConflictError(
      "Published and archived recipe guidance versions are immutable"
    )
  }
  if (current.status === "published") {
    if (next.status !== "archived" || archivalContent(current) !== archivalContent(next)) {
      throw new RecipeGuidanceConflictError(
        "Published recipe guidance content is immutable and may only be archived"
      )
    }
    return
  }
  if (current.status === "in_review" && next.status === "draft") {
    throw new RecipeGuidanceConflictError("In-review guidance cannot return to draft")
  }
  if (current.status === "draft" && next.status === "published") {
    throw new RecipeGuidanceConflictError("Recipe guidance must enter review before publication")
  }
  if (next.status === "archived") {
    throw new RecipeGuidanceConflictError("Only published recipe guidance can be archived")
  }
}

function createMemoryRepository(
  getDocuments: () => RecipeGuidanceDocument[]
): RecipeGuidanceRepository {
  return {
    async listByRecipeId(recipeId) {
      return sortVersions(getDocuments().filter((item) => item.recipeId === recipeId)).map(clone)
    },
    async findById(id) {
      const document = getDocuments().find((item) => item.id === id)
      return document ? clone(document) : null
    },
    async findLatestPublished(recipeId) {
      const document = sortVersions(
        getDocuments().filter((item) => item.recipeId === recipeId && item.status === "published")
      )[0]
      return document ? clone(document) : null
    },
    async create(input) {
      const document = validateWrite(input)
      assertNewDraft(document)
      const duplicate = getDocuments().some(
        (item) =>
          item.id === document.id ||
          (item.recipeId === document.recipeId && item.version === document.version)
      )
      if (duplicate) throw new RecipeGuidanceConflictError("Recipe guidance version already exists")
      getDocuments().push(clone(document))
      return clone(document)
    },
    async replace(input, expectedUpdatedAt) {
      const document = validateWrite(input)
      const index = getDocuments().findIndex((item) => item.id === document.id)
      if (index === -1) throw new RecipeGuidanceConflictError("Recipe guidance was not found")
      assertReplacementAllowed(getDocuments()[index], document, expectedUpdatedAt)
      getDocuments()[index] = clone(document)
      return clone(document)
    },
  }
}

async function readFileDocuments(): Promise<RecipeGuidanceDocument[]> {
  try {
    return parseStoredDocuments(JSON.parse(await readFile(RECIPE_GUIDANCE_FILE, "utf-8")))
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return []
    }
    if (error instanceof RecipeGuidanceIntegrityError) throw error
    throw new RecipeGuidanceIntegrityError("Recipe guidance demo store could not be read")
  }
}

async function writeFileDocuments(documents: RecipeGuidanceDocument[]): Promise<void> {
  await mkdir(dirname(RECIPE_GUIDANCE_FILE), { recursive: true })
  const temporaryFile = `${RECIPE_GUIDANCE_FILE}.${randomUUID()}.tmp`
  await writeFile(temporaryFile, JSON.stringify(documents, null, 2), "utf-8")
  await rename(temporaryFile, RECIPE_GUIDANCE_FILE)
}

let fileMutationQueue: Promise<void> = Promise.resolve()

function serializeFileMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const operation = fileMutationQueue.then(mutation, mutation)
  fileMutationQueue = operation.then(
    () => undefined,
    () => undefined
  )
  return operation
}

function createFileRepository(): RecipeGuidanceRepository {
  return {
    async listByRecipeId(recipeId) {
      return sortVersions((await readFileDocuments()).filter((item) => item.recipeId === recipeId))
    },
    async findById(id) {
      return (await readFileDocuments()).find((item) => item.id === id) ?? null
    },
    async findLatestPublished(recipeId) {
      return (
        sortVersions(
          (await readFileDocuments()).filter(
            (item) => item.recipeId === recipeId && item.status === "published"
          )
        )[0] ?? null
      )
    },
    async create(input) {
      return serializeFileMutation(async () => {
        const document = validateWrite(input)
        assertNewDraft(document)
        const documents = await readFileDocuments()
        const duplicate = documents.some(
          (item) =>
            item.id === document.id ||
            (item.recipeId === document.recipeId && item.version === document.version)
        )
        if (duplicate) {
          throw new RecipeGuidanceConflictError("Recipe guidance version already exists")
        }
        documents.push(document)
        await writeFileDocuments(documents)
        return clone(document)
      })
    },
    async replace(input, expectedUpdatedAt) {
      return serializeFileMutation(async () => {
        const document = validateWrite(input)
        const documents = await readFileDocuments()
        const index = documents.findIndex((item) => item.id === document.id)
        if (index === -1) throw new RecipeGuidanceConflictError("Recipe guidance was not found")
        assertReplacementAllowed(documents[index], document, expectedUpdatedAt)
        documents[index] = document
        await writeFileDocuments(documents)
        return clone(document)
      })
    },
  }
}

async function createMongoRepository(): Promise<RecipeGuidanceRepository> {
  const collection: Collection<RecipeGuidanceMongoDocument> =
    await getCollection<RecipeGuidanceMongoDocument>(RECIPE_GUIDANCE_COLLECTION)
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ recipeId: 1, version: 1 }, { unique: true }),
    collection.createIndex({ recipeId: 1, status: 1, version: -1 }),
  ])

  return {
    async listByRecipeId(recipeId) {
      const documents = await collection.find({ recipeId }).sort({ version: -1 }).toArray()
      return documents.map((item) => parseStoredDocument(withoutMongoId(item)))
    },
    async findById(id) {
      const document = await collection.findOne({ id })
      return document ? parseStoredDocument(withoutMongoId(document)) : null
    },
    async findLatestPublished(recipeId) {
      const document = await collection.findOne(
        { recipeId, status: "published" },
        { sort: { version: -1 } }
      )
      return document ? parseStoredDocument(withoutMongoId(document)) : null
    },
    async create(input) {
      const document = validateWrite(input)
      assertNewDraft(document)
      try {
        await collection.insertOne(document)
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new RecipeGuidanceConflictError("Recipe guidance version already exists")
        }
        throw error
      }
      return clone(document)
    },
    async replace(input, expectedUpdatedAt) {
      const document = validateWrite(input)
      const current = await collection.findOne({ id: document.id })
      if (!current) throw new RecipeGuidanceConflictError("Recipe guidance was not found")
      assertReplacementAllowed(
        parseStoredDocument(withoutMongoId(current)),
        document,
        expectedUpdatedAt
      )
      const result = await collection.replaceOne(
        { id: document.id, updatedAt: expectedUpdatedAt },
        document
      )
      if (result.matchedCount === 0) {
        throw new RecipeGuidanceConflictError("Recipe guidance changed before this update")
      }
      return clone(document)
    },
  }
}

let memoryDocuments: RecipeGuidanceDocument[] = []
let cachedRepository: RecipeGuidanceRepository | null = null
let cachedMode: RecipeGuidanceRepositoryMode | null = null

export async function getRecipeGuidanceRepository(): Promise<{
  repository: RecipeGuidanceRepository
  mode: RecipeGuidanceRepositoryMode
}> {
  if (cachedRepository && cachedMode) return { repository: cachedRepository, mode: cachedMode }

  const isTestMode =
    process.env.NODE_ENV === "test" || process.env.E2E_TEST === "1" || process.env.CI === "true"
  if (isTestMode) {
    cachedRepository = createMemoryRepository(() => memoryDocuments)
    cachedMode = "memory"
    return { repository: cachedRepository, mode: cachedMode }
  }

  if (isMongoConfigured()) {
    cachedRepository = await createMongoRepository()
    cachedMode = "mongodb"
    return { repository: cachedRepository, mode: cachedMode }
  }

  if (process.env.ALLOW_DEMO_DATA === "true") {
    cachedRepository = createFileRepository()
    cachedMode = "file"
    return { repository: cachedRepository, mode: cachedMode }
  }

  throw new RecipeGuidanceStoreUnavailableError(
    "Recipe guidance datastore is not configured. Set MONGODB_URI or explicitly enable demo data."
  )
}

export function resetRecipeGuidanceRepositoryForTests(): void {
  memoryDocuments = []
  fileMutationQueue = Promise.resolve()
  cachedRepository = null
  cachedMode = null
}
