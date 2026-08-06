import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"

export const toolCalibrationReminder = inngest.createFunction(
  { id: "tool-calibration-reminder", retries: 2 },
  { cron: "0 8 1 * *" },
  async ({ step }) => {
    const assets = await getEstateRepository().assets.list({ type: "Tool" })
    if (assets.length === 0) return { reminders: 0 }

    const task = await getEstateRepository().tasks.create({
      title: "Monthly Tool Calibration Check",
      description: `Review calibration status for ${assets.length} tools`,
      priority: "Medium",
      status: "Not Started",
      dueDate: toISODateString(),
      project: "Workshop",
    })

    if (task) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "task_assigned",
          userId: getAdminNotificationRecipient(),
          title: "Tool Calibration Due",
          message: "Monthly calibration check for workshop tools",
          channels: ["in_app"],
          data: { taskId: task.id },
          priority: "medium",
        })
      })
    }

    return { reminders: task ? 1 : 0 }
  }
)
