/**
 * Schema ordering for the user-management module.
 *
 * Everything this module does to `users` is ALTER TABLE — it adds columns to a
 * table owned by `ensureSchema()` in lib/db/postgres. It used to assume some
 * other caller had already created that table. On a database where nothing had,
 * the first ALTER threw `42P01 relation "users" does not exist`.
 *
 * That was invisible for as long as Baserow was the backend, because
 * isPostgresConfigured() was false and none of this ran. It surfaced the moment
 * production moved to Postgres on 2026-08-07.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const postgres = vi.hoisted(() => ({
  ensureSchema: vi.fn(),
  isPostgresConfigured: vi.fn(() => true),
  query: vi.fn(),
  withClient: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => postgres)

describe("user-management schema bootstrap", () => {
  beforeEach(() => {
    vi.resetModules()
    postgres.ensureSchema.mockReset()
    postgres.isPostgresConfigured.mockReturnValue(true)
    postgres.query.mockReset()
    postgres.query.mockResolvedValue({ rows: [], rowCount: 0 })
    postgres.withClient.mockReset()
    postgres.withClient.mockResolvedValue(undefined)
  })

  it("creates the base schema before altering users", async () => {
    const { getAllUsersWithManagement } = await import("@/lib/user-management")
    await getAllUsersWithManagement()

    expect(postgres.ensureSchema).toHaveBeenCalled()

    // Ordering is the whole point: the ALTERs run inside withClient, and they
    // fail outright if the table does not exist yet.
    const ensuredAt = postgres.ensureSchema.mock.invocationCallOrder[0]
    const alteredAt = postgres.withClient.mock.invocationCallOrder[0]
    expect(ensuredAt).toBeLessThan(alteredAt)
  })

  it("does not touch Postgres at all when it is not configured", async () => {
    postgres.isPostgresConfigured.mockReturnValue(false)

    const { getAllUsersWithManagement } = await import("@/lib/user-management")
    await getAllUsersWithManagement()

    expect(postgres.ensureSchema).not.toHaveBeenCalled()
    expect(postgres.withClient).not.toHaveBeenCalled()
  })
})
