import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "@/app/api/tasks/route"

vi.mock("@/lib/workflows", () => ({ routeToInngest: vi.fn().mockResolvedValue(undefined) }))

const authHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
}

describe("GET /api/tasks", () => {
  it("returns 200 with tasks and summary", async () => {
    const request = new Request("http://localhost/api/tasks")
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("tasks")
    expect(data).toHaveProperty("summary")
    expect(Array.isArray(data.tasks)).toBe(true)
  })
})

describe("POST /api/tasks", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 400 when title is missing", async () => {
    const request = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No title" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("returns 200 when creating task", async () => {
    const request = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test task", priority: "Medium" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("task")
    expect(data.task).toHaveProperty("title", "Test task")
  })
})
