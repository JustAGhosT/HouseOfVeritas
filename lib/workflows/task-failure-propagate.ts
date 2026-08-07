import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"

export const taskFailurePropagate = inngest.createFunction(
  { id: "task-failure-propagate", retries: 2 },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    const allTasks = await getEstateRepository().tasks.list()
    const tasks = allTasks.filter((t) => t.status !== "Completed")
    const overdue = tasks.filter((t) => {
      if (!t.dueDate) return false
      return new Date(t.dueDate) < new Date()
    })

    const criticalOverdue = overdue.filter((t) => t.priority === "High" || t.priority === "Urgent")

    if (criticalOverdue.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Critical Task Failure - Blocking Risk",
          message: `${criticalOverdue.length} critical/urgent task(s) overdue - may block dependent workflows`,
          channels: ["in_app"],
          data: {
            taskIds: criticalOverdue.map((t) => t.id),
            count: criticalOverdue.length,
          },
          priority: "urgent",
        })
      })
    }

    return { overdueCount: overdue.length, criticalOverdue: criticalOverdue.length }
  }
)
