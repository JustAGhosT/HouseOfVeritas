import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST as analyzePhoto } from "@/app/api/guidance/analyze/route"
import { GET, POST as saveGuidance } from "@/app/api/guidance/route"
import { generateTaskGuidanceWithSluice } from "@/lib/integrations/sluice"
import {
  createAndBindGuidance,
  getActiveGuidanceForTask,
} from "@/lib/repositories/guidance-repository"
import { getProjectNamesForMember } from "@/lib/projects"
import { getTask } from "@/lib/services/baserow"

vi.mock("@/lib/integrations/sluice", () => ({
  generateTaskGuidanceWithSluice: vi.fn(),
}))

vi.mock("@/lib/repositories/guidance-repository", () => ({
  createAndBindGuidance: vi.fn(),
  getActiveGuidanceForTask: vi.fn(),
}))

vi.mock("@/lib/projects", () => ({
  getProjectNamesForMember: vi.fn(),
}))

vi.mock("@/lib/services/baserow", () => ({
  getTask: vi.fn(),
}))

const authHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@example.com",
}

const draft = {
  kind: "procedure" as const,
  locale: "af" as const,
  title: "Herstel die vensterbank",
  summary: "Maak die oppervlak gereed en herstel die pleister.",
  materials: ["Sement"],
  tools: ["Troffel"],
  safety: ["Dra oogbeskerming"],
  steps: [{ order: 1, title: "Berei voor", instruction: "Verwyder los materiaal." }],
}

describe("task guidance API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTask).mockResolvedValue({
      id: 42,
      title: "Repair window sill",
      assignedTo: 4,
      project: "Maintenance",
      priority: "Medium",
      status: "Not Started",
    })
    vi.mocked(getProjectNamesForMember).mockResolvedValue([])
  })

  it("returns a structured visual guidance draft", async () => {
    vi.mocked(generateTaskGuidanceWithSluice).mockResolvedValue(draft)

    const response = await analyzePhoto(
      new Request("http://localhost/api/guidance/analyze", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          taskId: "42",
          title: "Repair window sill",
          description: "Repair damaged plaster without blocking drainage.",
          imageBase64: "data:image/jpeg;base64,cGhvdG8tcGxhY2Vob2xkZXI=",
          imageMimeType: "image/jpeg",
          locale: "af",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data.draft.title).toBe("Herstel die vensterbank")
  })

  it("binds reviewed guidance using the authenticated resident", async () => {
    vi.mocked(createAndBindGuidance).mockResolvedValue({
      guidance: {
        ...draft,
        id: "guidance-1",
        version: 1,
        status: "published",
        steps: [{ ...draft.steps[0], id: "step-1" }],
        source: { type: "photo", imageUrl: "/api/uploads/file-1" },
        createdBy: "irma",
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:00:00.000Z",
      },
      binding: {
        taskId: "42",
        guidancePackId: "guidance-1",
        version: 1,
        active: true,
        createdBy: "irma",
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:00:00.000Z",
      },
    })

    const response = await saveGuidance(
      new Request("http://localhost/api/guidance", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          taskId: "42",
          draft,
          source: { type: "photo", imageUrl: "/api/uploads/file-1" },
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(createAndBindGuidance).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "42", createdBy: "irma" })
    )
  })

  it("returns no guidance as an explicit empty state", async () => {
    vi.mocked(getActiveGuidanceForTask).mockResolvedValue(null)

    const response = await GET(
      new Request("http://localhost/api/guidance?taskId=42", { headers: authHeaders })
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data.guidance).toBeNull()
  })

  it("does not expose guidance for a task outside the resident's assignment and projects", async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 99,
      title: "Private task",
      assignedTo: 1,
      project: "Private",
      priority: "High",
      status: "Not Started",
    })

    const response = await GET(
      new Request("http://localhost/api/guidance?taskId=99", { headers: authHeaders })
    )

    expect(response.status).toBe(403)
    expect(getActiveGuidanceForTask).not.toHaveBeenCalled()
  })

  it("does not bind guidance to a task outside the resident's assignment and projects", async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 99,
      title: "Private task",
      assignedTo: 1,
      project: "Private",
      priority: "High",
      status: "Not Started",
    })

    const response = await saveGuidance(
      new Request("http://localhost/api/guidance", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          taskId: "99",
          draft,
          source: { type: "photo", imageUrl: "/api/uploads/file-1" },
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(createAndBindGuidance).not.toHaveBeenCalled()
  })

  it("does not spend Sluice capacity for a task outside the resident's access", async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 99,
      title: "Private task",
      assignedTo: 1,
      project: "Private",
      priority: "High",
      status: "Not Started",
    })

    const response = await analyzePhoto(
      new Request("http://localhost/api/guidance/analyze", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          taskId: "99",
          title: "Private task",
          description: "Analyze a task that the resident cannot access.",
          imageBase64: "data:image/jpeg;base64,cGhvdG8tcGxhY2Vob2xkZXI=",
          imageMimeType: "image/jpeg",
          locale: "en",
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(generateTaskGuidanceWithSluice).not.toHaveBeenCalled()
  })

  it("allows guidance access through project membership", async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 99,
      title: "Project task",
      assignedTo: 1,
      project: "Maintenance",
      priority: "High",
      status: "Not Started",
    })
    vi.mocked(getProjectNamesForMember).mockResolvedValue(["Maintenance"])
    vi.mocked(getActiveGuidanceForTask).mockResolvedValue(null)

    const response = await GET(
      new Request("http://localhost/api/guidance?taskId=99", { headers: authHeaders })
    )

    expect(response.status).toBe(200)
    expect(getActiveGuidanceForTask).toHaveBeenCalledWith("99")
  })
})
