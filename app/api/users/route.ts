import { NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import { getAllUsersWithManagement } from "@/lib/user-management"
import { UserAlreadyExistsError, createUserAsync } from "@/lib/users"

export const GET = withRole("admin")(async () => {
  const users = await getAllUsersWithManagement()
  return NextResponse.json({ users, total: users.length })
})

// "admin" is intentionally not one of these — see createUserAsync's doc
// comment. Minting a second admin identity is a separate, explicitly-reviewed
// action, not something this general-purpose endpoint should be able to do.
const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["operator", "resident", "employee"]),
  phone: z.string().trim().max(30).optional(),
  description: z.string().trim().max(280).optional(),
  color: z.string().trim().min(1).max(30).optional(),
  icon: z.string().trim().min(1).max(8).optional(),
  specialty: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
})

export const POST = withRole("admin")(async (request, context) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }

  try {
    const input = createUserSchema.parse(body)
    const user = await createUserAsync(input)
    logger.info("User created via admin API", {
      createdBy: context.userId,
      newUserId: user.id,
      role: user.role,
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid user data", issues: error.issues.map((issue) => issue.path.join(".")) },
        { status: 400 }
      )
    }
    if (error instanceof UserAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    logger.error("User creation failed", {
      createdBy: context.userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
})
