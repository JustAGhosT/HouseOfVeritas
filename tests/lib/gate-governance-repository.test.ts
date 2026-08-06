import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mongoMocks = vi.hoisted(() => ({
  configured: true,
  createIndex: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  getCollection: vi.fn(),
  insertOne: vi.fn(),
  toArray: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  getCollection: mongoMocks.getCollection,
  isMongoConfigured: () => mongoMocks.configured,
  withoutMongoId: <T extends { _id?: unknown }>(document: T) => {
    const { _id, ...rest } = document
    return rest
  },
}))

// These cases must run as NODE_ENV=production to reach the Mongo branch, and
// production RBAC deliberately refuses the `x-user-*` headers that test-mode
// routes accept. Authorization is covered by tests/api/gate-governance.test.ts
// and the E2E denial probes; stubbing it here isolates the error-to-status
// mapping that is actually under test.
vi.mock("@/lib/auth/rbac", () => ({
  withRole:
    () =>
    (handler: (request: Request, context: Record<string, unknown>) => Promise<Response>) =>
    (request: Request) =>
      handler(request, { userId: "admin-1", role: "admin", email: "admin@example.test" }),
}))

import { GET } from "@/app/api/governance/gates/route"
import { GATE_ZERO_ID, GATE_ZERO_PROTOCOL_VERSION } from "@/lib/governance/gate-definitions"
import {
  GateGovernanceStoreUnavailableError,
  getGateGovernanceRepository,
  resetGateGovernanceRepositoryForTests,
} from "@/lib/repositories/gate-governance-repository"

/**
 * Mongo signals "the cluster never answered" through the error name rather than a
 * distinct class hierarchy, so tests reproduce failures the same way the driver
 * reports them.
 */
function driverError(name: string, message = "cluster unreachable"): Error {
  const error = new Error(message)
  error.name = name
  return error
}

const adminRequest = () =>
  new Request("http://localhost/api/governance/gates", {
    headers: {
      "x-user-id": "admin-1",
      "x-user-role": "admin",
      "x-user-email": "admin@example.test",
    },
  })

describe("gate governance repository store availability", () => {
  beforeEach(() => {
    // Production is the only mode that resolves the Mongo branch; the default
    // test short-circuit returns the in-memory repository and would never
    // exercise the driver error mapping this suite covers.
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("E2E_TEST", "")
    vi.stubEnv("CI", "")
    mongoMocks.configured = true

    mongoMocks.toArray.mockReset().mockResolvedValue([])
    mongoMocks.find.mockReset().mockReturnValue({
      sort: () => ({ toArray: mongoMocks.toArray }),
    })
    mongoMocks.findOne.mockReset().mockResolvedValue(null)
    mongoMocks.insertOne.mockReset().mockResolvedValue({ acknowledged: true })
    mongoMocks.createIndex.mockReset().mockResolvedValue("index")
    mongoMocks.getCollection.mockReset().mockResolvedValue({
      createIndex: mongoMocks.createIndex,
      find: mongoMocks.find,
      findOne: mongoMocks.findOne,
      insertOne: mongoMocks.insertOne,
    })

    resetGateGovernanceRepositoryForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetGateGovernanceRepositoryForTests()
  })

  it.each([
    "MongoServerSelectionError",
    "MongoNetworkError",
    "MongoNetworkTimeoutError",
    "MongoTopologyClosedError",
    "MongoNotConnectedError",
  ])("treats a %s while connecting as an unavailable store", async (name) => {
    mongoMocks.getCollection.mockRejectedValue(driverError(name))

    await expect(getGateGovernanceRepository()).rejects.toBeInstanceOf(
      GateGovernanceStoreUnavailableError
    )
  })

  it("treats an index-creation connectivity failure as an unavailable store", async () => {
    mongoMocks.createIndex.mockRejectedValue(driverError("MongoNetworkError"))

    await expect(getGateGovernanceRepository()).rejects.toBeInstanceOf(
      GateGovernanceStoreUnavailableError
    )
  })

  it("treats a read connectivity failure as an unavailable store", async () => {
    mongoMocks.toArray.mockRejectedValue(driverError("MongoNetworkTimeoutError"))

    const { repository } = await getGateGovernanceRepository()

    await expect(repository.list(GATE_ZERO_ID, GATE_ZERO_PROTOCOL_VERSION)).rejects.toBeInstanceOf(
      GateGovernanceStoreUnavailableError
    )
  })

  it("leaves non-connectivity driver errors unmapped so they keep their own handling", async () => {
    const schemaError = driverError("MongoServerError", "unauthorized")
    mongoMocks.toArray.mockRejectedValue(schemaError)

    const { repository } = await getGateGovernanceRepository()

    await expect(repository.list(GATE_ZERO_ID, GATE_ZERO_PROTOCOL_VERSION)).rejects.toBe(schemaError)
  })

  it("fails closed with 503 rather than 500 when the configured cluster is unreachable", async () => {
    mongoMocks.getCollection.mockRejectedValue(driverError("MongoServerSelectionError"))

    const response = await GET(adminRequest())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Gate governance datastore is unavailable",
    })
  })

  it("still fails closed with 503 when Mongo is not configured at all", async () => {
    mongoMocks.configured = false

    const response = await GET(adminRequest())

    expect(response.status).toBe(503)
  })
})
