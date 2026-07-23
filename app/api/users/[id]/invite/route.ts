import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/rbac"
import { sendInvite } from "@/lib/invite"

export const POST = withRole("admin")(async (_request, context) => {
  const params = await context.params
  const id = params?.id
  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.AZURE_WEBAPP_URL ? `https://${process.env.AZURE_WEBAPP_URL}` : null) ||
    "http://localhost:3000"
  const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`

  const result = await sendInvite(id, url)
  if (!result.sent) {
    return NextResponse.json({ error: result.error || "Failed to send invite" }, { status: 500 })
  }
  return NextResponse.json({
    success: true,
    inviteLink: result.inviteLink,
    channels: result.channels,
  })
})
