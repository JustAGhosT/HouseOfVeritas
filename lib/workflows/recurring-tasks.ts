import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"
import { BASEROW_ID_TO_APP_ID } from "./constants"

function getWeekStart(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  copy.setDate(diff)
  return copy
}

function shouldCreateThisWeek(recurrence: string | undefined, d: Date): boolean {
  if (!recurrence) return false
  if (recurrence === "Daily" || recurrence === "Weekly") return true
  if (recurrence === "Monthly") return d.getDate() <= 7
  if (recurrence === "Quarterly") {
    const m = d.getMonth()
    return [0, 3, 6, 9].includes(m) && d.getDate() <= 7
  }
  return false
}

export const recurringTasksCreate = inngest.createFunction(
  { id: "recurring-tasks-create", retries: 2 },
  { cron: "0 8 * * 1" },
  async ({ step }) => {
    const templates = await getEstateRepository().tasks.listRecurringTemplates()
    const now = new Date()
    const weekStart = getWeekStart(new Date(now))
    const created: { id: number; title: string }[] = []

    for (const t of templates) {
      if (!shouldCreateThisWeek(t.recurrence, now)) continue
      const assigneeId = t.assignedTo
      const dueDates: Date[] =
        t.recurrence === "Daily"
          ? Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000))
          : [new Date(weekStart.getTime() + 4 * 86400000)]

      const templateCreated: { id: number; title: string }[] = []
      for (const dueDate of dueDates) {
        const task = await getEstateRepository().tasks.create({
          title: `${t.title} - ${toISODateString(dueDate)}`,
          description: t.description ?? "",
          dueDate: toISODateString(dueDate),
          priority: t.priority ?? "Medium",
          status: "Not Started",
          assignedTo: assigneeId,
          project: t.project,
        })
        if (task) {
          created.push({ id: task.id, title: task.title })
          templateCreated.push({ id: task.id, title: task.title })
        }
      }
      if (templateCreated.length > 0 && assigneeId) {
        const appUserId = BASEROW_ID_TO_APP_ID[assigneeId] ?? "hans"
        await step.run(`notify-assignee-${t.id}-${assigneeId}`, async () => {
          await sendNotification({
            type: "task_assigned",
            userId: appUserId,
            title: "Weekly Tasks Assigned",
            message:
              templateCreated.length === 1
                ? `${templateCreated[0].title}`
                : `${t.title}: ${templateCreated.length} tasks created`,
            channels: ["in_app"],
            data: { taskIds: templateCreated.map((c) => c.id), assigneeId },
            priority: "medium",
          })
        })
      }
    }

    if (created.length > 0) {
      await step.run("send-summary", async () => {
        await sendNotification({
          type: "weekly_summary",
          userId: getAdminNotificationRecipient(),
          title: `Weekly Tasks Created: ${created.length} tasks`,
          message: created
            .slice(0, 5)
            .map((c) => c.title)
            .join("; "),
          channels: ["in_app"],
          data: { count: created.length },
          priority: "medium",
        })
      })
    }

    return { templatesChecked: templates.length, tasksCreated: created.length }
  }
)
