import { GET as getUpload } from "@/app/api/uploads/[id]/route"
import { GET as listUploads, POST } from "@/app/api/uploads/route"
import { getProjectNamesForMember } from "@/lib/projects"
import { getTask } from "@/lib/services/baserow"
import { inMemoryUploadStore } from "@/lib/uploads"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/projects", () => ({
  getProjectNamesForMember: vi.fn(),
}))

vi.mock("@/lib/services/baserow", () => ({
  getTask: vi.fn(),
}))

const authHeaders = {
  "x-user-id": "charl",
  "x-user-role": "operator",
  "x-user-email": "charl@example.com",
}

describe("POST /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inMemoryUploadStore.clear()
    vi.mocked(getProjectNamesForMember).mockResolvedValue([])
    vi.mocked(getTask).mockResolvedValue({
      id: 42,
      title: "Operator task",
      assignedTo: 2,
      priority: "Medium",
      status: "Not Started",
    })
  })

  it("rejects a task-guidance upload when the user cannot access the task", async () => {
    vi.mocked(getTask).mockResolvedValue({
      id: 42,
      title: "Private task",
      assignedTo: 1,
      project: "Private",
      priority: "Medium",
      status: "Not Started",
    })

    const formData = new FormData()
    formData.append("file", new File(["photo"], "guidance.jpg", { type: "image/jpeg" }))
    formData.append("category", "image")
    formData.append("resourceType", "task-guidance")
    formData.append("resourceId", "42")

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
        body: formData,
      })
    )

    expect(response.status).toBe(403)
    expect(inMemoryUploadStore.size).toBe(0)
  })

  it("uses the authenticated user as uploader instead of a form userId", async () => {
    const formData = new FormData()
    formData.append(
      "file",
      new File(["photo"], "inventory.jpg", { type: "image/jpeg" })
    )
    formData.append("userId", "hans")
    formData.append("category", "image")
    formData.append("resourceType", "inventory")

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.file.uploadedBy).toBe("charl")
    expect(body.file.resourceType).toBe("inventory")
    expect(body.file.url).toMatch(/^\/api\/uploads\/file_/)
  })

  it("requires task access to retrieve a task-guidance photo", async () => {
    const formData = new FormData()
    formData.append("file", new File(["photo"], "guidance.jpg", { type: "image/jpeg" }))
    formData.append("category", "image")
    formData.append("resourceType", "task-guidance")
    formData.append("resourceId", "42")

    const uploadResponse = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      })
    )
    const upload = (await uploadResponse.json()).file

    const unauthenticated = await getUpload(
      new Request(`http://localhost${upload.url}`),
      { params: Promise.resolve({ id: upload.id }) }
    )
    expect(unauthenticated.status).toBe(401)

    const forbidden = await getUpload(
      new Request(`http://localhost${upload.url}`, {
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      }),
      { params: Promise.resolve({ id: upload.id }) }
    )
    expect(forbidden.status).toBe(403)

    const forbiddenList = await listUploads(
      new Request(
        "http://localhost/api/uploads?resourceType=task-guidance&resourceId=42",
        {
          headers: {
            "x-user-id": "irma",
            "x-user-role": "resident",
            "x-user-email": "irma@example.com",
          },
        }
      )
    )
    expect(forbiddenList.status).toBe(403)

    const genericList = await listUploads(
      new Request("http://localhost/api/uploads", {
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      })
    )
    expect((await genericList.json()).files).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: upload.id })])
    )

    const allowed = await getUpload(
      new Request(`http://localhost${upload.url}`, { headers: authHeaders }),
      { params: Promise.resolve({ id: upload.id }) }
    )
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get("content-type")).toBe("image/jpeg")

    const allowedList = await listUploads(
      new Request(
        "http://localhost/api/uploads?resourceType=task-guidance&resourceId=42",
        { headers: authHeaders }
      )
    )
    expect(allowedList.status).toBe(200)
    expect((await allowedList.json()).files).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: upload.id })])
    )
  })
})
