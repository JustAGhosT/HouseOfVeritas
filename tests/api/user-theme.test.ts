import { beforeEach, describe, expect, it, vi } from "vitest"

const updateUserProfileAsync = vi.fn()
const getUserWithManagement = vi.fn()

vi.mock("@/lib/users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/users")>()
  return { ...actual, updateUserProfileAsync }
})

vi.mock("@/lib/user-management", () => ({ getUserWithManagement }))

const authHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "user@example.com",
  "Content-Type": "application/json",
}

describe("PATCH /api/users/me theme", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateUserProfileAsync.mockResolvedValue({ id: "hans", themeId: "garden" })
    getUserWithManagement.mockResolvedValue({
      id: "hans",
      name: "Hans",
      email: "user@example.com",
      role: "admin",
      responsibilities: [],
      themeId: "garden",
    })
  })

  it("persists a valid theme for the authenticated user", async () => {
    const { PATCH } = await import("@/app/api/users/me/route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ themeId: "garden" }),
      })
    )

    expect(response.status).toBe(200)
    expect(updateUserProfileAsync).toHaveBeenCalledWith("hans", { themeId: "garden" })
    await expect(response.json()).resolves.toMatchObject({ user: { themeId: "garden" } })
  })

  it("rejects unknown themes before writing", async () => {
    const { PATCH } = await import("@/app/api/users/me/route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ themeId: "admin-red" }),
      })
    )

    expect(response.status).toBe(400)
    expect(updateUserProfileAsync).not.toHaveBeenCalled()
  })
})
