import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"
import { getUserWithManagement } from "@/lib/user-management"
import { updateUserProfileAsync } from "@/lib/users"
import { isUserThemeId, type UserThemeId } from "@/lib/user-themes"

export const GET = withAuth(async (_request, context) => {
  const user = await getUserWithManagement(context.userId)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json({ user })
})

export const PATCH = withAuth(async (request, context) => {
  try {
    const body = await request.json()
    const { name, phone, photoUrl, themeId } = body

    if (themeId !== undefined && !isUserThemeId(themeId)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 })
    }

    const updates: { name?: string; phone?: string; photoUrl?: string; themeId?: UserThemeId } = {}
    if (typeof name === "string" && name.trim()) updates.name = name.trim()
    if (typeof phone === "string") updates.phone = phone.trim()
    if (typeof photoUrl === "string") updates.photoUrl = photoUrl.trim() || undefined
    if (isUserThemeId(themeId)) updates.themeId = themeId

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 })
    }

    const updated = await updateUserProfileAsync(context.userId, updates)
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const user = await getUserWithManagement(context.userId)
    return NextResponse.json({ user: user ?? updated })
  } catch (err) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
})
