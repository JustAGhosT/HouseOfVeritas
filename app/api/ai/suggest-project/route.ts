import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"
import { suggestProject } from "@/lib/ai/azure-foundry"
import { listProjects } from "@/lib/repositories/project-repository"

async function loadProjectNames(): Promise<string[]> {
  const projects = await listProjects()
  return [...new Set(projects.map((project) => project.name.trim()).filter(Boolean))]
}

export const POST = withAuth(async (request: Request) => {
  try {
    const body = await request.json()
    const { taskTitle, taskDescription, expenseCategory } = body

    const options = await loadProjectNames()
    if (options.length === 0) {
      return NextResponse.json({
        suggested: null,
        options,
        aiPowered: false,
        message: "No projects configured",
      })
    }

    const suggested = await suggestProject({
      taskTitle: taskTitle || undefined,
      taskDescription: taskDescription || undefined,
      expenseCategory: expenseCategory || undefined,
      options,
    })

    return NextResponse.json({
      suggested: suggested || options[0],
      options,
      aiPowered: !!suggested,
    })
  } catch (err) {
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 })
  }
})
