import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { toISODateString } from "@/lib/utils"
import { BASEROW_ID_TO_APP_ID } from "./constants"

export const kitchenLockerAudit = inngest.createFunction(
  { id: "kitchen-locker-audit", retries: 2 },
  { cron: "0 8 1,15 * *" },
  async ({ step }) => {
    const employees = await step.run("get-employees", () => getEstateRepository().employees.list())
    const toAssign = employees.filter((e) => e.role === "Employee" || e.role === "Resident")
    const assignee = toAssign[0]
    if (!assignee) return { created: 0 }

    const task = await step.run("create-task", () =>
      getEstateRepository().tasks.create({
        title: "Kitchen Locker/Food Space Audit",
        description: "Scheduled audit - check for unclean/unauthorized storage",
        assignedTo: assignee.id,
        priority: "Medium",
        status: "Not Started",
        dueDate: toISODateString(),
        project: "Kitchen",
      })
    )

    if (task) {
      const appId = BASEROW_ID_TO_APP_ID[assignee.id] ?? "hans"
      await step.run("send-notification", () =>
        sendNotification({
          type: "task_assigned",
          userId: appId,
          title: "Locker Audit Assigned",
          message: "Kitchen locker/food space audit due",
          channels: ["in_app"],
          data: { taskId: task.id },
          priority: "medium",
        })
      )
    }

    return { created: task ? 1 : 0 }
  }
)
