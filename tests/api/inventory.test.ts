import { describe, expect, it, vi } from "vitest"
import { GET, POST } from "@/app/api/inventory/route"

vi.mock("@/lib/workflows", () => ({ routeToInngest: vi.fn().mockResolvedValue(undefined) }))

const operatorHeaders = {
  "x-user-id": "charl",
  "x-user-role": "operator",
  "x-user-email": "charl@houseofv.com",
  "Content-Type": "application/json",
}

describe("POST /api/inventory", () => {
  it("creates a photo-labelled inventory item for an operator", async () => {
    const label = `Photo label ${Date.now()}`
    const request = new Request("http://localhost/api/inventory", {
      method: "POST",
      headers: operatorHeaders,
      body: JSON.stringify({
        name: label,
        label,
        category: "workshop_consumables",
        unit: "units",
        currentStock: 1,
        minStock: 1,
        maxStock: 1,
        reorderPoint: 1,
        location: "Workshop Store",
        photoUrl: "/api/uploads/file_test_photo",
        photoFileId: "file_test_photo",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.item).toMatchObject({
      name: label,
      label,
      photoUrl: "/api/uploads/file_test_photo",
      photoFileId: "file_test_photo",
      capturedBy: "charl",
    })
    expect(data.item.photoUploadedAt).toEqual(expect.any(String))
  })

  it("does not store unsafe photo URLs", async () => {
    const label = `Unsafe photo ${Date.now()}`
    const request = new Request("http://localhost/api/inventory", {
      method: "POST",
      headers: operatorHeaders,
      body: JSON.stringify({
        name: label,
        label,
        category: "workshop_consumables",
        unit: "units",
        location: "Workshop Store",
        photoUrl: "javascript:alert(1)",
        photoFileId: "file_unsafe",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.item.photoUrl).toBeUndefined()
    expect(data.item.capturedBy).toBeUndefined()
  })
})

describe("GET /api/inventory", () => {
  it("requires authentication", async () => {
    const response = await GET(new Request("http://localhost/api/inventory"))
    expect(response.status).toBe(401)
  })
})
