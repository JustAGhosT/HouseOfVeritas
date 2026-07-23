import { describe, expect, it, vi } from "vitest"
import { GET, POST } from "@/app/api/inventory/route"

vi.mock("@/lib/workflows", () => ({ routeToInngest: vi.fn().mockResolvedValue(undefined) }))

const operatorHeaders = {
  "x-user-id": "charl",
  "x-user-role": "operator",
  "x-user-email": "charl@houseofv.com",
  "Content-Type": "application/json",
}

const residentHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
  "Content-Type": "application/json",
}

describe("POST /api/inventory", () => {
  it("keeps typed inventory add available for operators", async () => {
    const name = `Typed item ${Date.now()}`
    const request = new Request("http://localhost/api/inventory", {
      method: "POST",
      headers: operatorHeaders,
      body: JSON.stringify({
        name,
        category: "workshop_consumables",
        unit: "boxes",
        currentStock: 12,
        minStock: 2,
        maxStock: 24,
        reorderPoint: 4,
        location: "Workshop Store",
        supplier: "Builders Warehouse",
        unitCost: 15,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.item).toMatchObject({
      name,
      category: "workshop_consumables",
      unit: "boxes",
      currentStock: 12,
      minStock: 2,
      maxStock: 24,
      reorderPoint: 4,
      location: "Workshop Store",
      supplier: "Builders Warehouse",
      unitCost: 15,
      totalValue: 180,
    })
    expect(data.item.photoUrl).toBeUndefined()
    expect(data.item.capturedBy).toBeUndefined()
  })

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

  it("allows residents to create photo capture items only", async () => {
    const label = `Resident photo ${Date.now()}`
    const request = new Request("http://localhost/api/inventory", {
      method: "POST",
      headers: residentHeaders,
      body: JSON.stringify({
        name: label,
        label,
        category: "household",
        unit: "units",
        currentStock: 99,
        minStock: 10,
        maxStock: 200,
        reorderPoint: 25,
        location: "House",
        unitCost: 500,
        photoUrl: "/api/uploads/file_resident_photo",
        photoFileId: "file_resident_photo",
        imageBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.item).toMatchObject({
      name: label,
      photoUrl: "/api/uploads/file_resident_photo",
      capturedBy: "irma",
      currentStock: 1,
      minStock: 1,
      maxStock: 1,
      reorderPoint: 1,
      unitCost: 0,
      totalValue: 0,
      imageBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    })
  })

  it("rejects resident inventory creates without a photo", async () => {
    const request = new Request("http://localhost/api/inventory", {
      method: "POST",
      headers: residentHeaders,
      body: JSON.stringify({
        name: "No photo",
        category: "household",
        unit: "units",
        location: "House",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it("rejects resident stock mutations", async () => {
    const request = new Request("http://localhost/api/inventory", {
      method: "POST",
      headers: residentHeaders,
      body: JSON.stringify({
        action: "consume",
        itemId: "inv_001",
        quantity: 1,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})

describe("GET /api/inventory", () => {
  it("requires authentication", async () => {
    const response = await GET(new Request("http://localhost/api/inventory"))
    expect(response.status).toBe(401)
  })

  it("exposes only resident-linked inventory to residents", async () => {
    const label = `Resident scoped ${Date.now()}`
    await POST(
      new Request("http://localhost/api/inventory", {
        method: "POST",
        headers: residentHeaders,
        body: JSON.stringify({
          name: label,
          label,
          category: "household",
          unit: "units",
          location: "House",
          photoUrl: "/api/uploads/file_resident_scoped",
          photoFileId: "file_resident_scoped",
        }),
      })
    )

    const response = await GET(
      new Request("http://localhost/api/inventory", {
        headers: residentHeaders,
      })
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.items.length).toBeGreaterThan(0)
    expect(data.items.every((item: { capturedBy?: string }) => item.capturedBy === "irma")).toBe(
      true
    )
    expect(data.items.some((item: { name: string }) => item.name === label)).toBe(true)
  })
})
