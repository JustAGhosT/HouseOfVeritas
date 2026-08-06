import { NextResponse } from "next/server"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { toISODateString } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { routeToInngest } from "@/lib/workflows"

export const POST = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request) => {
  try {
    const body = await request.json()
    const { type, description, location, mealName, servedBy, severity } = body

    if (!type || !description) {
      return NextResponse.json({ error: "Type and description are required" }, { status: 400 })
    }

    if (type === "cross_contamination") {
      const task = await getEstateRepository().tasks.create({
        title: `Cross-Contamination Report: ${location || "Kitchen"}`,
        description,
        priority: "High",
        status: "Not Started",
        dueDate: toISODateString(),
        project: "Kitchen",
      })

      if (task) {
        await routeToInngest({
          name: "house-of-veritas/kitchen.cross.contamination",
          data: {
            taskId: task.id,
            description,
            location: location || "Kitchen",
          },
        })
      }

      return withDataSource({ task, type: "cross_contamination" })
    }

    if (type === "meal_feedback") {
      const safeSeverity =
        severity === "low" || severity === "medium" || severity === "high" ? severity : "medium"
      const titleMeal = mealName ? `: ${mealName}` : ""
      const detailLines = [
        `Meal feedback${titleMeal}`,
        servedBy ? `Served by: ${servedBy}` : undefined,
        location ? `Location: ${location}` : undefined,
        `Severity: ${safeSeverity}`,
        "",
        description,
      ].filter(Boolean)

      const task = await getEstateRepository().tasks.create({
        title: `Meal Quality Review${titleMeal}`,
        description: detailLines.join("\n"),
        priority: safeSeverity === "high" ? "High" : safeSeverity === "low" ? "Low" : "Medium",
        status: "Not Started",
        dueDate: toISODateString(),
        project: "Kitchen",
      })

      if (task) {
        await routeToInngest({
          name: "house-of-veritas/kitchen.meal.feedback",
          data: {
            taskId: task.id,
            description,
            mealName,
            servedBy,
            location: location || "Kitchen",
            severity: safeSeverity,
          },
        })
      }

      return withDataSource({ task, type: "meal_feedback" })
    }

    return NextResponse.json({ error: "Unknown report type" }, { status: 400 })
  } catch (error) {
    logger.error("Error creating kitchen report", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create kitchen report" }, { status: 500 })
  }
})
