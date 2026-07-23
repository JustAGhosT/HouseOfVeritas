import { POST } from "@/app/api/inventory/batch-identify/route"
import { mkdir, rm, writeFile } from "fs/promises"
import { afterEach, describe, expect, it, vi } from "vitest"

const authHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
  "Content-Type": "application/json",
}

describe("POST /api/inventory/batch-identify", () => {
  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    await rm("/tmp/hov-uploads/file_sluice_payload.jpg", { force: true })
  })

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

  it("sends service-readable image bytes to configured Sluice", async () => {
    await mkdir("/tmp/hov-uploads", { recursive: true })
    await writeFile("/tmp/hov-uploads/file_sluice_payload.jpg", "image-bytes")
    vi.stubEnv("SLUICE_API_URL", "https://sluice.example")
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              uploadId: "file_sluice_payload",
              photoUrl: "/api/uploads/file_sluice_payload",
              label: "Detected item",
              category: "other",
              confidence: 0.8,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const response = await POST(
      new Request("http://localhost/api/inventory/batch-identify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          images: [
            {
              uploadId: "file_sluice_payload",
              photoUrl: "/api/uploads/file_sluice_payload",
              originalName: "shelf.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.images[0]).toMatchObject({
      uploadId: "file_sluice_payload",
      photoUrl: "/api/uploads/file_sluice_payload",
      imageUrl: "/api/uploads/file_sluice_payload",
      imageBase64: Buffer.from("image-bytes").toString("base64"),
      dataUrl: `data:image/jpeg;base64,${Buffer.from("image-bytes").toString("base64")}`,
    })
  })
})
