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
})
