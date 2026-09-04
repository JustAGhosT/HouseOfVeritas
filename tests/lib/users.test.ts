import { afterEach, describe, expect, it, vi } from "vitest"

// createUserAsync branches on isPostgresConfigured(), which lib/db/postgres.ts
// derives from process.env at import time. Pin it to static (in-memory) mode
// so this file's behavior does not depend on whatever DATABASE_URL/
// AZURE_POSTGRES_* happen to be set in the ambient environment.
vi.mock("@/lib/db/postgres", () => ({
  isPostgresConfigured: () => false,
  query: vi.fn(),
  withClient: vi.fn(),
  ensureSchema: vi.fn(),
}))

import {
  USERS,
  createUserAsync,
  findUserByEmail,
  UserAlreadyExistsError,
  type CreatableUserRole,
} from "@/lib/users"

describe("canonical user identity mappings", () => {
  it("maps the verified OmniPost email to Lucky without changing access", () => {
    expect(findUserByEmail("OMNIPOSTHQ@GMAIL.COM")).toMatchObject({
      id: "lucky",
      email: "lucky@houseofv.com",
      oidcEmail: "omniposthq@gmail.com",
      role: "employee",
    })
  })

  it("does not retain Lucky's superseded email as an identity mapping", () => {
    expect(findUserByEmail("lucky@houseofv.com")).toBeUndefined()
  })

  it("keeps canonical email identity mappings unique", () => {
    const normalizedEmails = Object.values(USERS).map((user) =>
      (user.oidcEmail ?? user.email).toLowerCase()
    )

    expect(new Set(normalizedEmails).size).toBe(normalizedEmails.length)
  })
})

describe("createUserAsync (static mode)", () => {
  const createdIds: string[] = []

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      delete USERS[id]
    }
  })

  it("creates a new user row with expected fields and a defaulted oidcEmail", async () => {
    const user = await createUserAsync({
      email: "New.Operator@Example.com",
      name: "  New Operator  ",
      role: "operator",
    })
    createdIds.push(user.id)

    expect(user.id).toMatch(/^user-/)
    expect(user.email).toBe("new.operator@example.com")
    expect(user.oidcEmail).toBe("new.operator@example.com")
    expect(user.name).toBe("New Operator")
    expect(user.role).toBe("operator")
    expect(user.phone).toBe("")
    expect(user.specialty).toEqual([])
    // The new row is a distinct addition, not a mutation of any seed user.
    expect(USERS[user.id]).toBe(user)
    expect(USERS.irma.email).toBe("irma@houseofv.com")
  })

  it("throws UserAlreadyExistsError for an email that collides with an existing user", async () => {
    await expect(
      createUserAsync({ email: "irma@houseofv.com", name: "Impersonator", role: "resident" })
    ).rejects.toThrow(UserAlreadyExistsError)
  })

  it("does not mutate the existing user's row on collision (create is INSERT-only)", async () => {
    const before = { ...USERS.irma }
    const keyCountBefore = Object.keys(USERS).length

    await expect(
      createUserAsync({ email: "IRMA@houseofv.com", name: "Impersonator", role: "resident" })
    ).rejects.toThrow(UserAlreadyExistsError)

    expect(USERS.irma).toEqual(before)
    // No row was added on the collision path -- if the guard were removed and
    // this fell through to an insert, the key count would grow by one.
    expect(Object.keys(USERS)).toHaveLength(keyCountBefore)
  })

  it("restricts CreatableUserRole to non-admin roles (type-level check)", () => {
    // @ts-expect-error "admin" must never be assignable to CreatableUserRole —
    // minting a second admin identity is a separate, reviewed action and must
    // not be reachable through createUserAsync's input type.
    const adminRole: CreatableUserRole = "admin"
    // Referencing the value keeps this a real (if trivial) runtime assertion;
    // the actual guarantee is enforced by `tsc --noEmit` failing without the
    // `@ts-expect-error` above if CreatableUserRole ever widens to admit "admin".
    expect(adminRole).toBe("admin")
  })
})
