import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"
import { BASEROW_ID_TO_APP_ID } from "./constants"

export const taskHandoverAbsence = inngest.createFunction(
  { id: "task-handover-absence", retries: 2 },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const today = toISODateString()
    const leaveRequests = await getEstateRepository().leaveRequests.list({ status: "Approved" })
    const onLeave = new Set(
      leaveRequests.filter((r) => r.startDate <= today && r.endDate >= today).map((r) => r.employee)
    )

    if (onLeave.size === 0) return { onLeave: 0, handovers: 0 }

    const allTasks = await getEstateRepository().tasks.list()
    const tasks = allTasks.filter((t) => t.status !== "Completed")
    const tasksToHandover = tasks.filter((t) => t.assignedTo && onLeave.has(t.assignedTo))

    await step.run("send-handover-notifications", async () => {
      for (const task of tasksToHandover) {
        const assigneeId = task.assignedTo!
        await sendNotification({
          type: "task_assigned",
          userId: getAdminNotificationRecipient(),
          title: "Task Handover - Employee on Leave",
          message: `Task "${task.title}" assigned to employee on leave - needs reassignment`,
          channels: ["in_app"],
          data: { taskId: task.id, assigneeId },
          priority: "high",
        })
      }
    })

    return { onLeave: onLeave.size, handovers: tasksToHandover.length }
  }
)
