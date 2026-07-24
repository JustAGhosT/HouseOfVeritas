import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { seedSampleRecipes } from "@/lib/repositories/recipe-repository"
import { logger } from "@/lib/logger"

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase()
    if (lowered === "true") return true
    if (lowered === "false") return false
  }
  return undefined
}

export const POST = withRole("admin")(
  async (request, context) => {
    try {
      const body = (await request.json().catch(() => ({}))) as { force?: boolean | string }
      const force = asBoolean(body?.force) ?? false
      const result = await seedSampleRecipes(context.userId, { force })
      return NextResponse.json({ seed: result })
    } catch (error) {
      logger.error("Failed to seed sample recipes", {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Failed to seed sample recipes" }, { status: 500 })
    }
  }
)
