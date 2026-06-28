import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { findUserByIdAsync, safeUser } from "@/lib/users"
import { getUserWithManagement } from "@/lib/user-management"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.userId

  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const withMgmt = await getUserWithManagement(userId)
  if (withMgmt) {
    return NextResponse.json({ user: withMgmt })
  }

  const user = await findUserByIdAsync(userId)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      ...safeUser(user),
      onboardingStatus: user.id === "hans" ? "completed" : "pending",
      responsibilities: user.specialty || [],
      status: "active",
      offboardingStatus: "none",
      onboardingCompletedAt: null,
      offboardingInitiatedAt: null,
    },
  })
}
