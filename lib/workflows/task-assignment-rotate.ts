import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { BASEROW_ID_TO_APP_ID } from "./constants"

export const taskAssignmentRotate = inngest.createFunction(
  { id: "task-assignment-rotate", retries: 2 },
  { cron: "0 6 * * 1" },
  async ({ step }) => {
    const allTasks = await getEstateRepository().tasks.list()
    const tasks = allTasks.filter((t) => t.status !== "Completed")
    const employees = await getEstateRepository().employees.list()
    const employeeRole = employees.filter((e) => e.role === "Employee")

    const assignCount: Record<number, number> = {}
    for (const e of employeeRole) assignCount[e.id] = 0

    for (const t of tasks) {
      if (t.assignedTo) assignCount[t.assignedTo] = (assignCount[t.assignedTo] ?? 0) + 1
    }

    const minCount = Math.min(...employeeRole.map((e) => assignCount[e.id] ?? 0))
    const overloaded = tasks.filter(
      (t) => t.assignedTo && (assignCount[t.assignedTo] ?? 0) > minCount + 2
    )

    if (overloaded.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Task Load Imbalance",
          message: `${overloaded.length} employee(s) have significantly more tasks - consider rotation`,
          channels: ["in_app"],
          data: { overloadedCount: overloaded.length },
          priority: "low",
        })
      })
    }

    return { tasksChecked: tasks.length, imbalanceAlerts: overloaded.length }
  }
)
