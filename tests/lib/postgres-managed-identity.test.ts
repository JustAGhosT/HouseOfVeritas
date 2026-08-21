import { afterEach, describe, expect, it, vi } from "vitest"

const postgresMocks = vi.hoisted(() => ({
  pool: vi.fn((config: Record<string, unknown>) => config),
  poolOn: vi.fn(),
  setTypeParser: vi.fn(),
  getToken: vi.fn(),
  managedIdentityCredential: vi.fn(class ManagedIdentityCredential {}),
}))

vi.mock("pg", () => ({
  Pool: class Pool {
    constructor(config: Record<string, unknown>) {
      postgresMocks.pool(config)
    }
    on(...args: unknown[]) {
      postgresMocks.poolOn(...args)
    }
    async end() {}
  },
  types: { setTypeParser: postgresMocks.setTypeParser },
}))

vi.mock("@azure/identity", () => ({
  ManagedIdentityCredential: vi.fn(
    class ManagedIdentityCredential {
      getToken = postgresMocks.getToken
    }
  ),
}))

const ENVIRONMENT_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "AZURE_POSTGRES_AUTH_MODE",
  "AZURE_POSTGRES_HOST",
  "AZURE_POSTGRES_DATABASE",
  "AZURE_POSTGRES_USER",
] as const

afterEach(() => {
  for (const key of ENVIRONMENT_KEYS) delete process.env[key]
  vi.resetModules()
  vi.clearAllMocks()
})

describe("PostgreSQL managed identity", () => {
  it("builds an Entra-only pool whose password callback returns a short-lived token", async () => {
    process.env.AZURE_POSTGRES_AUTH_MODE = "entra-only"
    process.env.AZURE_POSTGRES_HOST = "nex-prod-hov-pg.postgres.database.azure.com"
    process.env.AZURE_POSTGRES_DATABASE = "houseofveritas"
    process.env.AZURE_POSTGRES_USER = "nex-prod-hov-app"
    postgresMocks.getToken.mockResolvedValue({ token: "short-lived-token" })

    const postgres = await import("@/lib/db/postgres")
    await postgres.getPool()

    expect(postgres.isPostgresConfigured()).toBe(true)
    const config = postgresMocks.pool.mock.calls[0][0] as Record<string, unknown> & {
      password: () => Promise<string>
    }
    expect(config).toMatchObject({
      host: "nex-prod-hov-pg.postgres.database.azure.com",
      database: "houseofveritas",
      user: "nex-prod-hov-app",
      ssl: { rejectUnauthorized: true },
    })
    await expect(config.password()).resolves.toBe("short-lived-token")
    expect(postgresMocks.getToken).toHaveBeenCalledWith(
      "https://ossrdbms-aad.database.windows.net/.default"
    )
  })

  it("fails closed when the Entra-only principal name is missing", async () => {
    process.env.AZURE_POSTGRES_AUTH_MODE = "entra-only"
    process.env.AZURE_POSTGRES_HOST = "nex-prod-hov-pg.postgres.database.azure.com"
    process.env.AZURE_POSTGRES_DATABASE = "houseofveritas"

    const postgres = await import("@/lib/db/postgres")

    await expect(postgres.getPool()).rejects.toThrow("AZURE_POSTGRES_USER")
    expect(postgresMocks.pool).not.toHaveBeenCalled()
  })

  it("preserves source DSN compatibility for rollback", async () => {
    process.env.DATABASE_URL = "postgresql://rollback.invalid/houseofveritas"

    const postgres = await import("@/lib/db/postgres")
    await postgres.getPool()

    expect(postgresMocks.pool.mock.calls[0][0]).toMatchObject({
      connectionString: "postgresql://rollback.invalid/houseofveritas",
    })
  })
})
