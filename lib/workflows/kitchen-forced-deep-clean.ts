import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"

export const kitchenForcedDeepClean = inngest.createFunction(
  { id: "kitchen-forced-deep-clean", retries: 2 },
  { cron: "0 7 1,15 * *" },
  async ({ step }) => {
    const today = toISODateString()
    const existing = await getEstateRepository().tasks.list()
    const recentDeepClean = existing.filter(
      (t) =>
        t.project === "Kitchen" &&
        t.title?.toLowerCase().includes("deep clean") &&
        t.status === "Completed" &&
        t.completedDate &&
        t.completedDate >= today.slice(0, 7)
    )

    if (recentDeepClean.length > 0) return { created: 0, reason: "Already completed this period" }

    const task = await getEstateRepository().tasks.create({
      title: "Mandatory Kitchen Deep Clean",
      description: "Scheduled forced deep clean - must be completed by deadline",
      priority: "High",
      status: "Not Started",
      dueDate: today,
      project: "Kitchen",
    })

    if (task) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Forced Deep Clean - Action Required",
          message: "Mandatory kitchen deep clean task created - assign and ensure completion",
          channels: ["in_app"],
          data: { taskId: task.id },
          priority: "high",
        })
      })
    }

    return { created: task ? 1 : 0 }
  }
)
