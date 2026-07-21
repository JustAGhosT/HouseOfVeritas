import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"
import { suggestProjectFromPhoto } from "@/lib/ai/azure-foundry"
import { listProjects } from "@/lib/repositories/project-repository"

async function loadProjectNames(): Promise<string[]> {
  const projects = await listProjects()
  return [...new Set(projects.map((project) => project.name.trim()).filter(Boolean))]
}

export const POST = withAuth(async (request: Request) => {
  try {
    const body = await request.json()
    const { imageBase64, imageMimeType } = body

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 })
    }

    const options = await loadProjectNames()
    const suggested = await suggestProjectFromPhoto({
      imageBase64,
      imageMimeType: imageMimeType || "image/jpeg",
      existingProjectNames: options,
      allowNew: true,
    })

    if (!suggested) {
      return NextResponse.json({
        suggested: null,
        options,
        aiPowered: false,
        message: "AI not configured or failed",
      })
    }

    return NextResponse.json({
      suggested,
      options,
      aiPowered: true,
    })
  } catch (err) {
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 })
  }
})
