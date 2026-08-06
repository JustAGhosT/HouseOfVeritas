import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"
import { BASEROW_ID_TO_APP_ID } from "./constants"

const PROBATION_MONTHS = 3

function monthsSince(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  return months
}

export const probationReminder = inngest.createFunction(
  { id: "probation-reminder", retries: 2 },
  { cron: "0 8 1 * *" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const now = new Date()
    const todayStr = toISODateString(now)
    const reminders: { name: string; employeeId: number; monthsSinceStart: number }[] = []

    for (const emp of employees) {
      if (["Owner", "Resident"].includes(emp.role)) continue
      const startDate = emp.employmentStartDate
      if (!startDate) continue
      if (emp.probationStatus === "Permanent" || emp.probationStatus === "Completed") continue

      const months = monthsSince(startDate)
      if (months >= PROBATION_MONTHS) {
        reminders.push({ name: emp.fullName, employeeId: emp.id, monthsSinceStart: months })
        const appUserId = BASEROW_ID_TO_APP_ID[emp.id] ?? "hans"
        await step.run(`notify-probation-${emp.id}`, async () => {
          await sendNotification({
            type: "system_alert",
            userId: appUserId,
            title: "Probation Review Due",
            message: `Your ${PROBATION_MONTHS}-month probation period is complete. Please schedule a review with Hans.`,
            channels: ["in_app"],
            data: { employeeId: emp.id, startDate, monthsSinceStart: months },
            priority: "medium",
          })
        })
      }
    }

    if (reminders.length > 0) {
      await step.run("send-summary", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: `Probation Review: ${reminders.length} employee(s) due`,
          message: reminders.map((r) => `${r.name} (${r.monthsSinceStart} months)`).join("; "),
          channels: ["in_app"],
          data: { count: reminders.length, employees: reminders },
          priority: "high",
        })
      })
    }

    return { employeesChecked: employees.length, remindersSent: reminders.length }
  }
)
