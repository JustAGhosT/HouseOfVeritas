import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mongoMocks = vi.hoisted(() => {
  const connectBehaviors: Array<() => Promise<void>> = []
  const instances: MockMongoClient[] = []

  class MockMongoClient {
    readonly connect = vi.fn(async () => {
      const behavior = connectBehaviors.shift()
      if (behavior) await behavior()
      return this
    })

    readonly close = vi.fn(async () => undefined)
    readonly db = vi.fn((databaseName: string) => ({ databaseName }))

    constructor(readonly url: string) {
      instances.push(this)
    }
  }

  return { connectBehaviors, instances, MockMongoClient }
})

vi.mock("mongodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongodb")>()
  return { ...actual, MongoClient: mongoMocks.MockMongoClient }
})

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

function createDeferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe("MongoDB connection lifecycle", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("MONGODB_URI", "mongodb://example.test:27017")
    vi.stubEnv("DB_NAME", "house_of_veritas")
    mongoMocks.connectBehaviors.length = 0
    mongoMocks.instances.length = 0
  })

  afterEach(async () => {
    const { closeConnection } = await import("@/lib/db/mongodb")
    await closeConnection()
    vi.unstubAllEnvs()
  })

  it("shares one in-flight connection across concurrent callers", async () => {
    const gate = createDeferred()
    mongoMocks.connectBehaviors.push(() => gate.promise)
    const { getDatabase } = await import("@/lib/db/mongodb")

    const first = getDatabase()
    const second = getDatabase()

    expect(mongoMocks.instances).toHaveLength(1)
    expect(mongoMocks.instances[0].connect).toHaveBeenCalledTimes(1)
    expect(mongoMocks.instances[0].close).not.toHaveBeenCalled()

    gate.resolve()
    const [firstDatabase, secondDatabase] = await Promise.all([first, second])

    expect(firstDatabase).toBe(secondDatabase)
    expect(mongoMocks.instances).toHaveLength(1)
    expect(mongoMocks.instances[0].close).not.toHaveBeenCalled()
  })

  it("clears a failed attempt so a later request can reconnect", async () => {
    mongoMocks.connectBehaviors.push(async () => {
      throw new Error("connection failed")
    })
    const { getDatabase } = await import("@/lib/db/mongodb")

    const first = getDatabase()
    const second = getDatabase()
    const results = await Promise.allSettled([first, second])

    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"])
    expect(mongoMocks.instances).toHaveLength(1)
    expect(mongoMocks.instances[0].close).toHaveBeenCalledTimes(1)

    const database = await getDatabase()

    expect(database).toEqual({ databaseName: "house_of_veritas" })
    expect(mongoMocks.instances).toHaveLength(2)
  })

  it("replaces an established client when the connection settings change", async () => {
    const { getDatabase } = await import("@/lib/db/mongodb")
    await getDatabase()

    vi.stubEnv("DB_NAME", "house_of_veritas_archive")
    const database = await getDatabase()

    expect(database).toEqual({ databaseName: "house_of_veritas_archive" })
    expect(mongoMocks.instances).toHaveLength(2)
    expect(mongoMocks.instances[0].close).toHaveBeenCalledTimes(1)
    expect(mongoMocks.instances[1].db).toHaveBeenCalledWith("house_of_veritas_archive")
  })
})
