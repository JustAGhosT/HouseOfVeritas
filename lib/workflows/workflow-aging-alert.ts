import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { STALE_DAYS } from "./constants"

export const workflowAgingAlert = inngest.createFunction(
  { id: "workflow-aging-alert", retries: 2 },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    const tasks = await getEstateRepository().tasks.list()
    const now = new Date()
    const cutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000)

    const stale = tasks.filter((t) => {
      if (t.status === "Completed") return false
      const updated = t.createdDate || t.dueDate
      if (!updated) return true
      return new Date(updated) < cutoff
    })

    if (stale.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Workflow Aging Alert",
          message: `${stale.length} task(s) not updated in ${STALE_DAYS}+ days - review for dead processes`,
          channels: ["in_app"],
          data: { taskIds: stale.map((t) => t.id) },
          priority: "low",
        })
      })
    }

    return { tasksChecked: tasks.length, staleCount: stale.length }
  }
)
