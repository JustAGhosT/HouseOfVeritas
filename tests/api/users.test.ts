import { beforeEach, describe, expect, it, vi } from "vitest"

const createUserAsync = vi.fn()

// Only override createUserAsync; keep the real UserAlreadyExistsError class
// (and everything else) so `error instanceof UserAlreadyExistsError` in the
// route continues to work against the same class the test imports.
vi.mock("@/lib/users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/users")>()
  return { ...actual, createUserAsync }
})

const adminHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
  "Content-Type": "application/json",
}

const operatorHeaders = {
  "x-user-id": "charl",
  "x-user-role": "operator",
  "x-user-email": "chapmancharl28@gmail.com",
  "Content-Type": "application/json",
}

function postUsersRequest(body: unknown, headers: Record<string, string> = adminHeaders) {
  return new Request("http://localhost/api/users", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

describe("POST /api/users", () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a mockResolvedValue/mockRejectedValue
    // from one test can never leak into the next — call history AND
    // implementation are both wiped between tests.
    vi.resetAllMocks()
  })

  it("returns 401 when there are no auth headers", async () => {
    const { POST } = await import("@/app/api/users/route")

    const response = await POST(
      postUsersRequest(
        { email: "new.operator@example.com", name: "New Operator", role: "operator" },
        { "Content-Type": "application/json" }
      )
    )

    expect(response.status).toBe(401)
    expect(createUserAsync).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller's role is not admin", async () => {
    const { POST } = await import("@/app/api/users/route")

    const response = await POST(
      postUsersRequest(
        { email: "new.operator@example.com", name: "New Operator", role: "operator" },
        operatorHeaders
      )
    )

    expect(response.status).toBe(403)
    expect(createUserAsync).not.toHaveBeenCalled()
  })

  it("returns 201 with the created user on success", async () => {
    const created = {
      id: "user-abc123",
      name: "New Operator",
      email: "new.operator@example.com",
      oidcEmail: "new.operator@example.com",
      phone: "",
      role: "operator",
      description: "",
      color: "gray",
      themeId: "sanctum",
      icon: "👤",
      specialty: [],
    }
    createUserAsync.mockResolvedValue(created)

    const { POST } = await import("@/app/api/users/route")
    const response = await POST(
      postUsersRequest({ email: "New.Operator@Example.com", name: "New Operator", role: "operator" })
    )

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data).toEqual({ user: created })
    expect(createUserAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.operator@example.com",
        name: "New Operator",
        role: "operator",
      })
    )
  })

  it("returns 400 with issues when email is missing", async () => {
    const { POST } = await import("@/app/api/users/route")

    const response = await POST(postUsersRequest({ name: "No Email", role: "operator" }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeTruthy()
    expect(data.issues).toContain("email")
    expect(createUserAsync).not.toHaveBeenCalled()
  })

  it("returns 400 with issues when email is not a valid address", async () => {
    const { POST } = await import("@/app/api/users/route")

    const response = await POST(
      postUsersRequest({ email: "not-an-email", name: "Bad Email", role: "operator" })
    )

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.issues).toContain("email")
    expect(createUserAsync).not.toHaveBeenCalled()
  })

  it("rejects role: admin — the schema deliberately excludes it", async () => {
    const { POST } = await import("@/app/api/users/route")

    const response = await POST(
      postUsersRequest({ email: "wannabe-admin@example.com", name: "Wannabe Admin", role: "admin" })
    )

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.issues).toContain("role")
    expect(createUserAsync).not.toHaveBeenCalled()
  })

  it("returns 409 when createUserAsync reports an email collision", async () => {
    const { UserAlreadyExistsError } = await import("@/lib/users")
    createUserAsync.mockRejectedValue(new UserAlreadyExistsError("dup@example.com"))

    const { POST } = await import("@/app/api/users/route")
    const response = await POST(
      postUsersRequest({ email: "dup@example.com", name: "Dup", role: "operator" })
    )

    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toContain("dup@example.com")
  })

  it("returns 500 on an unexpected error without leaking its message", async () => {
    createUserAsync.mockRejectedValue(new Error("connection to postgres lost"))

    const { POST } = await import("@/app/api/users/route")
    const response = await POST(
      postUsersRequest({ email: "x@example.com", name: "X", role: "operator" })
    )

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe("Failed to create user")
    expect(data.error).not.toContain("postgres")
  })
})
