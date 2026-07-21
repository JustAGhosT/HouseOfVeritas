import { beforeEach, describe, expect, it, vi } from "vitest"

const authHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
  "Content-Type": "application/json",
}

const listProjects = vi.fn()
const suggestProject = vi.fn()
const suggestProjectFromPhoto = vi.fn()

vi.mock("@/lib/repositories/project-repository", () => ({ listProjects }))
vi.mock("@/lib/ai/azure-foundry", () => ({ suggestProject, suggestProjectFromPhoto }))

describe("AI project suggestion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns an empty suggestion state when no projects exist", async () => {
    listProjects.mockResolvedValue([])
    const { POST } = await import("@/app/api/ai/suggest-project/route")

    const response = await POST(
      new Request("http://localhost/api/ai/suggest-project", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ taskTitle: "Fix gate" }),
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      suggested: null,
      options: [],
      aiPowered: false,
      message: "No projects configured",
    })
    expect(suggestProject).not.toHaveBeenCalled()
  })

  it("uses repository project names instead of hardcoded defaults", async () => {
    listProjects.mockResolvedValue([
      { id: "p1", name: "Gate Repair" },
      { id: "p2", name: "  Gate Repair  " },
      { id: "p3", name: "Workshop" },
    ])
    suggestProject.mockResolvedValue("Workshop")
    const { POST } = await import("@/app/api/ai/suggest-project/route")

    const response = await POST(
      new Request("http://localhost/api/ai/suggest-project", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ taskTitle: "Fix drill press" }),
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.options).toEqual(["Gate Repair", "Workshop"])
    expect(data.suggested).toBe("Workshop")
    expect(suggestProject).toHaveBeenCalledWith(expect.objectContaining({ options: ["Gate Repair", "Workshop"] }))
  })

  it("falls back to the first real project option when AI is unavailable", async () => {
    listProjects.mockResolvedValue([{ id: "p1", name: "Gate Repair" }, { id: "p2", name: "Workshop" }])
    suggestProject.mockResolvedValue(null)
    const { POST } = await import("@/app/api/ai/suggest-project/route")

    const response = await POST(
      new Request("http://localhost/api/ai/suggest-project", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ taskTitle: "Fix drill press" }),
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.options).toEqual(["Gate Repair", "Workshop"])
    expect(data.suggested).toBe("Gate Repair")
    expect(data.aiPowered).toBe(false)
  })

  it("uses repository project names for photo suggestions", async () => {
    listProjects.mockResolvedValue([{ id: "p1", name: "Garden" }])
    suggestProjectFromPhoto.mockResolvedValue({ name: "Garden", fromExisting: true })
    const { POST } = await import("@/app/api/ai/suggest-project-from-photo/route")

    const response = await POST(
      new Request("http://localhost/api/ai/suggest-project-from-photo", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ imageBase64: "abc123", imageMimeType: "image/png" }),
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.options).toEqual(["Garden"])
    expect(data.suggested).toEqual({ name: "Garden", fromExisting: true })
    expect(suggestProjectFromPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ existingProjectNames: ["Garden"], imageMimeType: "image/png" })
    )
  })
})
