import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { toISODateString } from "@/lib/utils"
import { BASEROW_ID_TO_APP_ID } from "./constants"

export const incidentHazardWalk = inngest.createFunction(
  { id: "incident-hazard-walk", retries: 2 },
  { cron: "0 8 * * 1" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const assignees = employees.filter((e) => e.role === "Employee")
    const assignee = assignees[0]
    if (!assignee) return { created: 0 }

    const task = await getEstateRepository().tasks.create({
      title: "Scheduled Hazard Walk",
      description: "Proactive safety walk - detect and prevent incidents",
      assignedTo: assignee.id,
      priority: "Medium",
      status: "Not Started",
      dueDate: toISODateString(),
      project: "Safety",
    })

    if (task) {
      const appId = BASEROW_ID_TO_APP_ID[assignee.id] ?? "hans"
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "task_assigned",
          userId: appId,
          title: "Hazard Walk Assigned",
          message: "Weekly safety walk - complete and log findings",
          channels: ["in_app"],
          data: { taskId: task.id },
          priority: "medium",
        })
      })
    }

    return { created: task ? 1 : 0 }
  }
)
