import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/kitchen/route"
import { routeToInngest } from "@/lib/workflows"

vi.mock("@/lib/workflows", () => ({ routeToInngest: vi.fn().mockResolvedValue(undefined) }))

const authHeaders = {
  "x-user-id": "irma",
  "x-user-role": "employee",
  "x-user-email": "irma@houseofv.com",
}

describe("POST /api/kitchen", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 400 when type is missing", async () => {
    const request = new Request("http://localhost/api/kitchen", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No type" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("creates a meal quality review task and routes meal feedback", async () => {
    const request = new Request("http://localhost/api/kitchen", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "meal_feedback",
        mealName: "Rice, tuna, and polony",
        servedBy: "Irma",
        location: "Main Kitchen",
        severity: "high",
        description: "Meal was unplanned and below household standards.",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.type).toBe("meal_feedback")
    expect(data.task).toMatchObject({
      title: "Meal Quality Review: Rice, tuna, and polony",
      priority: "High",
      status: "Not Started",
      project: "Kitchen",
    })
    expect(data.task.description).toContain("Served by: Irma")
    expect(routeToInngest).toHaveBeenCalledWith({
      name: "house-of-veritas/kitchen.meal.feedback",
      data: expect.objectContaining({
        taskId: data.task.id,
        mealName: "Rice, tuna, and polony",
        servedBy: "Irma",
        location: "Main Kitchen",
        severity: "high",
      }),
    })
  })

  it("defaults invalid meal feedback severity to medium", async () => {
    const request = new Request("http://localhost/api/kitchen", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "meal_feedback",
        description: "Meal needs review.",
        severity: "critical",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.task.priority).toBe("Medium")
    expect(routeToInngest).toHaveBeenCalledWith({
      name: "house-of-veritas/kitchen.meal.feedback",
      data: expect.objectContaining({
        location: "Kitchen",
        severity: "medium",
      }),
    })
  })
})
