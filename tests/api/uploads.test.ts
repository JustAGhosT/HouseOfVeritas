import { GET as getUpload } from "@/app/api/uploads/[id]/route"
import { DELETE as deleteUpload, GET as listUploads, POST } from "@/app/api/uploads/route"
import { getProjectNamesForMember } from "@/lib/projects"
import { getTask } from "@/lib/services/baserow"
import { getUploadContentHash, getUploadMetadataById, inMemoryUploadStore } from "@/lib/uploads"
import { getRecipeById } from "@/lib/repositories/recipe-repository"
import { getRecipeGuidanceRepository } from "@/lib/repositories/recipe-guidance-repository"
import type { RecipeRecord } from "@/lib/recipes"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/projects", () => ({
  getProjectNamesForMember: vi.fn(),
}))

vi.mock("@/lib/services/baserow", () => ({
  getTask: vi.fn(),
}))

vi.mock("@/lib/repositories/recipe-repository", () => ({
  getRecipeById: vi.fn(),
}))

vi.mock("@/lib/repositories/recipe-guidance-repository", () => ({
  getRecipeGuidanceRepository: vi.fn(),
}))

const uploadRecipe: RecipeRecord = {
  id: "recipe-1",
  status: "published",
  ownerUserId: "hans",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Garden stew",
  titleAf: "Tuinbredie",
  image: {
    url: "https://images.example/stew.jpg",
    source: "Example",
    license: "CC BY 4.0",
    attributionText: "Example photographer",
    retrievedAt: "2026-07-31",
  },
  ingredients: [{ id: "ingredient-1", name: "Carrots" }],
  steps: [
    {
      id: "step-1",
      order: 1,
      instructionEn: "Simmer.",
      instructionAf: "Prut.",
    },
  ],
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
}

const uploadGuidanceRepository = {
  findLatestPublished: vi.fn(),
}

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
    vi.mocked(getRecipeById).mockResolvedValue(uploadRecipe)
    uploadGuidanceRepository.findLatestPublished.mockResolvedValue(null)
    vi.mocked(getRecipeGuidanceRepository).mockResolvedValue({
      repository: uploadGuidanceRepository,
      mode: "memory",
    } as never)
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
    formData.append("file", new File(["photo"], "inventory.jpg", { type: "image/jpeg" }))
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

    const unauthenticated = await getUpload(new Request(`http://localhost${upload.url}`), {
      params: Promise.resolve({ id: upload.id }),
    })
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
      new Request("http://localhost/api/uploads?resourceType=task-guidance&resourceId=42", {
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      })
    )
    expect(forbiddenList.status).toBe(403)

    const forbiddenDelete = await deleteUpload(
      new Request(`http://localhost/api/uploads?id=${upload.id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      })
    )
    expect(forbiddenDelete.status).toBe(403)

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
      new Request("http://localhost/api/uploads?resourceType=task-guidance&resourceId=42", {
        headers: authHeaders,
      })
    )
    expect(allowedList.status).toBe(200)
    expect((await allowedList.json()).files).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: upload.id })])
    )
  })

  it("keeps recipe-guidance uploads private to admins and their bound recipe", async () => {
    const adminHeaders = {
      "x-user-id": "hans",
      "x-user-role": "admin",
      "x-user-email": "hans@example.com",
    }
    const formData = new FormData()
    formData.append("file", new File(["recipe-photo"], "ingredients.jpg", { type: "image/jpeg" }))
    formData.append("category", "image")
    formData.append("resourceType", "recipe-guidance")
    formData.append("resourceId", "recipe-1")

    const uploadResponse = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: adminHeaders,
        body: formData,
      })
    )
    const upload = (await uploadResponse.json()).file

    expect(uploadResponse.status).toBe(200)
    expect(upload).toMatchObject({
      uploadedBy: "hans",
      category: "image",
      resourceType: "recipe-guidance",
      resourceId: "recipe-1",
    })
    const metadata = await getUploadMetadataById(upload.id)
    expect(metadata).not.toBeNull()
    await expect(getUploadContentHash(metadata!)).resolves.toMatch(/^sha256:[a-f0-9]{64}$/)

    const residentList = await listUploads(
      new Request("http://localhost/api/uploads?resourceType=recipe-guidance&resourceId=recipe-1", {
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      })
    )
    expect(residentList.status).toBe(403)

    const genericList = await listUploads(
      new Request("http://localhost/api/uploads", { headers: authHeaders })
    )
    expect((await genericList.json()).files).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: upload.id })])
    )

    const adminList = await listUploads(
      new Request("http://localhost/api/uploads?resourceType=recipe-guidance&resourceId=recipe-1", {
        headers: adminHeaders,
      })
    )
    expect(adminList.status).toBe(200)
    expect((await adminList.json()).files).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: upload.id })])
    )

    const residentRead = await getUpload(
      new Request(`http://localhost${upload.url}`, {
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      }),
      { params: Promise.resolve({ id: upload.id }) }
    )
    expect(residentRead.status).toBe(403)

    uploadGuidanceRepository.findLatestPublished.mockResolvedValue({
      recipeId: uploadRecipe.id,
      recipeRevisionId: `${uploadRecipe.id}@${uploadRecipe.updatedAt}`,
      ownerUserId: uploadRecipe.ownerUserId,
      audienceUserIds: uploadRecipe.audienceUserIds,
      mediaAssets: [
        {
          id: "approved-upload",
          status: "approved",
          storage: { type: "hov", storageId: upload.id },
        },
      ],
      sections: [
        {
          blocks: [{ type: "media_reference", mediaAssetId: "approved-upload" }],
        },
      ],
    })

    const audienceRead = await getUpload(
      new Request(`http://localhost${upload.url}`, {
        headers: {
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@example.com",
        },
      }),
      { params: Promise.resolve({ id: upload.id }) }
    )
    expect(audienceRead.status).toBe(200)

    const adminRead = await getUpload(
      new Request(`http://localhost${upload.url}`, { headers: adminHeaders }),
      { params: Promise.resolve({ id: upload.id }) }
    )
    expect(adminRead.status).toBe(200)
  })

  it("rejects recipe-guidance uploads for a missing recipe", async () => {
    vi.mocked(getRecipeById).mockResolvedValue(null)
    const formData = new FormData()
    formData.append("file", new File(["photo"], "missing.jpg", { type: "image/jpeg" }))
    formData.append("category", "image")
    formData.append("resourceType", "recipe-guidance")
    formData.append("resourceId", "missing-recipe")

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: {
          "x-user-id": "hans",
          "x-user-role": "admin",
          "x-user-email": "hans@example.com",
        },
        body: formData,
      })
    )

    expect(response.status).toBe(404)
    expect(inMemoryUploadStore.size).toBe(0)
  })
})
