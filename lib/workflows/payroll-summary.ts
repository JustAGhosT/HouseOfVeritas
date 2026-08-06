import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { toISODateString } from "@/lib/utils"

function getMonthRange(d: Date): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: toISODateString(start), end: toISODateString(end) }
}

export const payrollSummary = inngest.createFunction(
  { id: "payroll-summary", retries: 2 },
  { cron: "0 8 1 * *" },
  async ({ step }) => {
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const { start, end } = getMonthRange(prevMonth)
    const employees = await getEstateRepository().employees.list()
    const employeeRole = ["Employee", "Owner"]
    const toReport = employees.filter((e) => employeeRole.includes(e.role))

    const summary: { name: string; totalHours: number; overtimeHours: number }[] = []

    for (const emp of toReport) {
      const { items } = await getEstateRepository().timeClock.listPaginated(1, 200, { employee: emp.id })
      const monthEntries = items.filter((e) => e.date >= start && e.date <= end && e.clockOut)
      const totalHours = monthEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0)
      const overtimeHours = monthEntries.reduce((sum, e) => sum + (e.overtimeHours ?? 0), 0)
      summary.push({
        name: emp.fullName,
        totalHours,
        overtimeHours,
      })
    }

    const totalRegular = summary.reduce((s, r) => s + r.totalHours - r.overtimeHours, 0)
    const totalOvertime = summary.reduce((s, r) => s + r.overtimeHours, 0)

    await step.run("send-notification", async () => {
      await sendNotification({
        type: "system_alert",
        userId: getAdminNotificationRecipient(),
        title: `Payroll Summary: ${prevMonth.toLocaleString("default", { month: "long" })} ${prevMonth.getFullYear()}`,
        message: `Total regular: ${totalRegular.toFixed(1)}h, overtime: ${totalOvertime.toFixed(1)}h. ${summary.length} employees.`,
        channels: ["in_app"],
        data: {
          month: start,
          summary,
          totalRegular,
          totalOvertime,
        },
        priority: "medium",
      })
    })

    return { employeesReported: summary.length, totalRegular, totalOvertime }
  }
)
