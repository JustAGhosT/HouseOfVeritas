import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { getUserWithManagement, updateUserManagement } from "@/lib/user-management"

function optionalEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
}

export const GET = withRole("admin")(async (_request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })
  const user = await getUserWithManagement(id)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json({ user })
})

export const PATCH = withRole("admin")(async (request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })
  try {
    const body = await request.json()
    const { status, email, role, responsibilities, onboardingStatus, offboardingStatus } = body
    const updates: Record<string, unknown> = {}
    if (status != null) updates.status = status
    if (email != null) {
      const normalizedEmail = optionalEmail(email)
      if (!normalizedEmail) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 })
      }
      updates.email = normalizedEmail
    }
    if (role != null) updates.role = role
    if (responsibilities != null) updates.responsibilities = responsibilities
    if (onboardingStatus != null) updates.onboardingStatus = onboardingStatus
    if (offboardingStatus != null) updates.offboardingStatus = offboardingStatus
    const user = await updateUserManagement(
      id,
      updates as Parameters<typeof updateUserManagement>[1]
    )
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
})
