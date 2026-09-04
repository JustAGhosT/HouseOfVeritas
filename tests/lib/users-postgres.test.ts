import { beforeEach, describe, expect, it, vi } from "vitest"

const postgres = vi.hoisted(() => ({
  ensureSchema: vi.fn(),
  isPostgresConfigured: vi.fn(() => true),
  query: vi.fn(),
  withClient: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => postgres)

describe("PostgreSQL OIDC identity mappings", () => {
  beforeEach(() => {
    vi.resetModules()
    postgres.ensureSchema.mockReset()
    postgres.isPostgresConfigured.mockReturnValue(true)
    postgres.query.mockReset()
    postgres.withClient.mockReset()
  })

  it("backfills and resolves Lucky's separate OIDC email", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("LOWER(id) <> LOWER($2)")) return { rows: [], rowCount: 0 }
      if (text.includes("UPDATE users")) return { rows: [], rowCount: 1 }
      if (text.includes("CREATE UNIQUE INDEX")) return { rows: [], rowCount: 0 }
      if (text.includes("SELECT 1 FROM users LIMIT 1")) return { rows: [{}], rowCount: 1 }
      if (text.includes("LOWER(COALESCE(oidc_email, email))")) {
        return {
          rows: [
            {
              id: "lucky",
              name: "Lucky",
              email: "lucky@houseofv.com",
              oidc_email: "omniposthq@gmail.com",
              phone: "+27794142410",
              role: "employee",
              description: "Tasks, expenses, time tracking, vehicles coming soon",
              color: "green",
              theme_id: "garden",
              icon: "🌿",
              specialty: ["Gardening", "Painting", "Manual Labour"],
            },
          ],
          rowCount: 1,
        }
      }
      throw new Error(`Unexpected query: ${text}`)
    })

    const { findUserByEmailAsync } = await import("@/lib/users")
    const user = await findUserByEmailAsync("OMNIPOSTHQ@GMAIL.COM")

    expect(postgres.ensureSchema).toHaveBeenCalledOnce()
    expect(postgres.query).toHaveBeenCalledWith(expect.stringContaining("LOWER(id) <> LOWER($2)"), [
      "omniposthq@gmail.com",
      "lucky",
    ])
    expect(postgres.query).toHaveBeenCalledWith(expect.stringContaining("SET oidc_email = $1"), [
      "omniposthq@gmail.com",
      "lucky",
    ])
    expect(postgres.query).toHaveBeenCalledWith(
      expect.stringContaining("LOWER(COALESCE(oidc_email, email))"),
      ["OMNIPOSTHQ@GMAIL.COM"]
    )
    expect(user).toMatchObject({
      id: "lucky",
      email: "lucky@houseofv.com",
      oidcEmail: "omniposthq@gmail.com",
      role: "employee",
    })
  })

  it("rejects a canonical mapping that conflicts across identity columns", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("LOWER(id) <> LOWER($2)")) {
        return { rows: [{ id: "oidc-existing" }], rowCount: 1 }
      }
      throw new Error(`Unexpected query: ${text}`)
    })

    const { findUserByEmailAsync } = await import("@/lib/users")

    await expect(findUserByEmailAsync("omniposthq@gmail.com")).rejects.toThrow(
      "OIDC identity mapping conflicts with an existing user"
    )
    expect(postgres.query).not.toHaveBeenCalledWith(
      expect.stringContaining("SET oidc_email = $1"),
      expect.anything()
    )
  })

  it("allows an occupied canonical address when an existing explicit mapping is preserved", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("LOWER(id) <> LOWER($2)")) {
        expect(text).toContain("SELECT 1 FROM users target")
        expect(text).toContain("target.oidc_email IS NULL")
        return { rows: [], rowCount: 0 }
      }
      if (text.includes("UPDATE users")) return { rows: [], rowCount: 0 }
      if (text.includes("CREATE UNIQUE INDEX")) return { rows: [], rowCount: 0 }
      if (text.includes("SELECT 1 FROM users LIMIT 1")) return { rows: [{}], rowCount: 1 }
      if (text.includes("LOWER(COALESCE(oidc_email, email))")) {
        return {
          rows: [
            {
              id: "lucky",
              name: "Lucky",
              email: "lucky@houseofv.com",
              oidc_email: "existing-lucky-login@example.com",
              phone: "+27794142410",
              role: "employee",
              description: "Tasks, expenses, time tracking, vehicles coming soon",
              color: "green",
              theme_id: "garden",
              icon: "🌿",
              specialty: ["Gardening", "Painting", "Manual Labour"],
            },
          ],
          rowCount: 1,
        }
      }
      throw new Error(`Unexpected query: ${text}`)
    })

    const { findUserByEmailAsync } = await import("@/lib/users")
    const user = await findUserByEmailAsync("existing-lucky-login@example.com")

    expect(user).toMatchObject({
      id: "lucky",
      oidcEmail: "existing-lucky-login@example.com",
    })
  })

  it("rejects auto-provisioning when a reserved contact address prevents persistence", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("LOWER(id) <> LOWER($2)")) return { rows: [], rowCount: 0 }
      if (text.includes("UPDATE users")) return { rows: [], rowCount: 1 }
      if (text.includes("CREATE UNIQUE INDEX")) return { rows: [], rowCount: 0 }
      if (text.includes("SELECT 1 FROM users LIMIT 1")) return { rows: [{}], rowCount: 1 }
      if (text.includes("LOWER(COALESCE(oidc_email, email))")) {
        return { rows: [], rowCount: 0 }
      }
      if (text.includes("INSERT INTO users")) return { rows: [], rowCount: 0 }
      throw new Error(`Unexpected query: ${text}`)
    })

    const { findOrCreateOidcUserAsync } = await import("@/lib/users")

    await expect(findOrCreateOidcUserAsync("lucky@houseofv.com", "Lucky")).rejects.toThrow(
      "OIDC user could not be persisted without an identity conflict"
    )
  })

  it("seeds only explicit OIDC mappings so implicit identities follow contact-email edits", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    postgres.withClient.mockImplementation(async (callback) => callback({ query: clientQuery }))
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("LOWER(id) <> LOWER($2)")) return { rows: [], rowCount: 0 }
      if (text.includes("UPDATE users")) return { rows: [], rowCount: 1 }
      if (text.includes("CREATE UNIQUE INDEX")) return { rows: [], rowCount: 0 }
      if (text.includes("SELECT 1 FROM users LIMIT 1")) return { rows: [], rowCount: 0 }
      throw new Error(`Unexpected query: ${text}`)
    })

    const { seedUsersIfEmpty } = await import("@/lib/users")
    await seedUsersIfEmpty()

    const seededRows = clientQuery.mock.calls.map(([, values]) => values)
    expect(seededRows.find((values) => values[0] === "hans")?.[3]).toBeNull()
    expect(seededRows.find((values) => values[0] === "lucky")?.[3]).toBe("omniposthq@gmail.com")
  })
})

describe("createUserAsync (Postgres mode)", () => {
  beforeEach(() => {
    vi.resetModules()
    postgres.ensureSchema.mockReset()
    postgres.isPostgresConfigured.mockReturnValue(true)
    postgres.query.mockReset()
    postgres.withClient.mockReset()
  })

  function mockSchemaAndSeedQueries(onInsert: (values: unknown[]) => { rows: unknown[]; rowCount: number }) {
    postgres.query.mockImplementation(async (text: string, values?: unknown[]) => {
      if (text.includes("LOWER(id) <> LOWER($2)")) return { rows: [], rowCount: 0 }
      if (text.includes("UPDATE users")) return { rows: [], rowCount: 1 }
      if (text.includes("CREATE UNIQUE INDEX")) return { rows: [], rowCount: 0 }
      if (text.includes("SELECT 1 FROM users LIMIT 1")) return { rows: [{}], rowCount: 1 }
      if (text.includes("INSERT INTO users")) return onInsert(values ?? [])
      throw new Error(`Unexpected query: ${text}`)
    })
  }

  it("creates a new user via a single INSERT (never an UPDATE), with oidc_email defaulted to the normalized email", async () => {
    mockSchemaAndSeedQueries(() => ({ rows: [], rowCount: 1 }))

    const users = await import("@/lib/users")
    // Pre-warm schema/seed bookkeeping — this alone issues Lucky's legitimate
    // backfill UPDATE (see the OIDC mapping tests above) — so the window
    // below captures only createUserAsync's own statements.
    await users.seedUsersIfEmpty()
    postgres.query.mockClear()

    const user = await users.createUserAsync({
      email: "New.Operator@Example.com",
      name: "New Operator",
      role: "operator",
    })

    expect(user.email).toBe("new.operator@example.com")
    expect(user.oidcEmail).toBe("new.operator@example.com")
    expect(user.role).toBe("operator")

    const calls = postgres.query.mock.calls
    const insertCalls = calls.filter(([text]) => text.includes("INSERT INTO users"))
    expect(insertCalls).toHaveLength(1)
    const [insertText, insertValues] = insertCalls[0]
    expect(insertText).not.toMatch(/ON CONFLICT[\s\S]*DO UPDATE/i)
    // $4 in the INSERT's column list is oidc_email — defaulted to the
    // normalized contact email at the SQL level, not left null/undefined.
    expect(insertValues[3]).toBe("new.operator@example.com")

    // Deliberately INSERT-only: no UPDATE statement (bare or upsert-style)
    // targets the new row. Mutating an existing row to add an identity would
    // silently evict its old one (see createUserAsync's doc comment).
    expect(calls.filter(([text]) => /UPDATE/i.test(text))).toHaveLength(0)
  })

  it("throws UserAlreadyExistsError on a unique-violation without retrying as an UPDATE", async () => {
    mockSchemaAndSeedQueries(() => {
      throw Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
      })
    })

    const users = await import("@/lib/users")
    await users.seedUsersIfEmpty()
    postgres.query.mockClear()

    await expect(
      users.createUserAsync({ email: "lucky@houseofv.com", name: "Duplicate", role: "employee" })
    ).rejects.toThrow(users.UserAlreadyExistsError)

    const calls = postgres.query.mock.calls
    expect(calls.filter(([text]) => text.includes("INSERT INTO users"))).toHaveLength(1)
    // A collision is reported back as a conflict, never silently resolved by
    // falling back to an UPDATE of the pre-existing row.
    expect(calls.filter(([text]) => /UPDATE/i.test(text))).toHaveLength(0)
  })
})
