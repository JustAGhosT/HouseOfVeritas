import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/documents/route"
import { GET as getTemplates } from "@/app/api/documents/templates/route"

describe("GET /api/documents", () => {
  it("returns 200 with empty documents array when demo data is disabled", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(0)
  })
})

describe("GET /api/documents/templates", () => {
  it("returns 200 with templates array", async () => {
    const response = await getTemplates()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("templates")
    expect(Array.isArray(data.templates)).toBe(true)
  })
})
