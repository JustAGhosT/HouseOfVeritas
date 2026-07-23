import { beforeEach, describe, expect, it, vi } from "vitest"

const getUserWithManagement = vi.fn()
const updateUserManagement = vi.fn()

vi.mock("@/lib/user-management", () => ({
  getUserWithManagement,
  updateUserManagement,
}))

const adminHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
  "Content-Type": "application/json",
}

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates a normalized user email", async () => {
    updateUserManagement.mockResolvedValue({
      id: "charl",
      email: "chapmancharl28@gmail.com",
    })
    const { PATCH } = await import("@/app/api/users/[id]/route")

    const response = await PATCH(
      new Request("http://localhost/api/users/charl", {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ email: " ChapmanCharl28@GMAIL.com " }),
      }),
      { params: Promise.resolve({ id: "charl" }) }
    )

    expect(response.status).toBe(200)
    expect(updateUserManagement).toHaveBeenCalledWith("charl", {
      email: "chapmancharl28@gmail.com",
    })
  })

  it("rejects malformed email updates", async () => {
    const { PATCH } = await import("@/app/api/users/[id]/route")

    const response = await PATCH(
      new Request("http://localhost/api/users/charl", {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      { params: Promise.resolve({ id: "charl" }) }
    )

    expect(response.status).toBe(400)
    expect(updateUserManagement).not.toHaveBeenCalled()
  })
})
