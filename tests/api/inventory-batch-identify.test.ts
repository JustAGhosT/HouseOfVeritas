import { POST } from "@/app/api/inventory/batch-identify/route"
import { describe, expect, it } from "vitest"

const authHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
  "Content-Type": "application/json",
}

describe("POST /api/inventory/batch-identify", () => {
  it("returns preview-only manual suggestions when Sluice is not configured", async () => {
    const response = await POST(
      new Request("http://localhost/api/inventory/batch-identify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          images: [
            {
              uploadId: "file_123",
              photoUrl: "/api/uploads/file_123",
              originalName: "pool-chlorine.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.previewOnly).toBe(true)
    expect(data.aiPowered).toBe(false)
    expect(data.suggestions).toEqual([
      expect.objectContaining({
        uploadId: "file_123",
        photoUrl: "/api/uploads/file_123",
        label: "pool chlorine",
        category: "other",
        confidence: null,
      }),
    ])
  })

  it("rejects non-upload URLs", async () => {
    const response = await POST(
      new Request("http://localhost/api/inventory/batch-identify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          images: [{ uploadId: "file_123", photoUrl: "https://example.com/photo.jpg" }],
        }),
      })
    )

    expect(response.status).toBe(400)
  })
})
