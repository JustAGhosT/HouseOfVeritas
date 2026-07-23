import { afterEach, describe, expect, it, vi } from "vitest"
import { logger } from "@/lib/logger"
import { sendNotification } from "@/lib/services/notification-service"
import { findUserByIdAsync } from "@/lib/users"

vi.mock("@/lib/users", () => ({
  findUserByIdAsync: vi.fn(),
}))

describe("sendNotification", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("routes email notifications to the current user email", async () => {
    vi.mocked(findUserByIdAsync).mockResolvedValue({
      id: "charl",
      name: "Charl",
      email: "edited-charl@example.com",
      phone: "",
      role: "operator",
      description: "",
      color: "blue",
      icon: "user",
      specialty: [],
    })
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined)

    await sendNotification({
      type: "system_alert",
      userId: "charl",
      title: "Invite",
      message: "Link",
      channels: ["email"],
    })

    expect(info).toHaveBeenCalledWith(
      "Email simulated (ACS_CONNECTION_STRING not set)",
      expect.objectContaining({ to: "edited-charl@example.com", subject: "Invite" })
    )
  })
})
