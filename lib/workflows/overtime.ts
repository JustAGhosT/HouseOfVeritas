import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { toISODateString } from "@/lib/utils"

const STANDARD_HOURS = 45

function getWeekRange(d: Date): { start: string; end: string } {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d)
  start.setDate(diff)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start: toISODateString(start), end: toISODateString(end) }
}

function parseHours(clockIn?: string, clockOut?: string, breakDurationMinutes?: number): number {
  if (!clockIn || !clockOut) return 0
  try {
    const [ih, im] = clockIn.split(":").map(Number)
    const [oh, om] = clockOut.split(":").map(Number)
    let mins = oh * 60 + om - (ih * 60 + im)
    if (mins < 0) mins += 24 * 60
    const breakMins = typeof breakDurationMinutes === "number" ? breakDurationMinutes : 0
    mins = Math.max(0, mins - breakMins)
    return mins / 60
  } catch {
    return 0
  }
}

export const overtimeCalculate = inngest.createFunction(
  { id: "overtime-calculate", retries: 2 },
  { cron: "0 23 * * 0" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const now = new Date()
    const { start, end } = getWeekRange(now)
    const reports: { name: string; totalHours: number; overtimeHours: number }[] = []

    for (const emp of employees) {
      if (["Owner", "Resident"].includes(emp.role)) continue
      const { items } = await getEstateRepository().timeClock.listPaginated(1, 100, {
        employee: emp.id,
      })
      const weekEntries = items.filter((e) => e.date >= start && e.date <= end && e.clockOut)
      const totalHours = weekEntries.reduce(
        (sum, e) => sum + parseHours(e.clockIn, e.clockOut, e.breakDuration),
        0
      )
      const overtimeHours = Math.max(0, totalHours - STANDARD_HOURS)
      if (overtimeHours > 0) {
        reports.push({
          name: emp.fullName,
          totalHours,
          overtimeHours,
        })
        for (const entry of weekEntries) {
          await getEstateRepository().timeClock.update(entry.id, { approvalStatus: "Pending" })
        }
      }
    }

    if (reports.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: `Weekly Overtime: ${reports.length} employees need approval`,
          message: reports.map((r) => `${r.name}: ${r.overtimeHours.toFixed(1)}h OT`).join("; "),
          channels: ["in_app"],
          data: { weekStart: start, weekEnd: end, count: reports.length },
          priority: "high",
        })
      })
    }

    return { employeesChecked: employees.length, overtimeReports: reports.length }
  }
)
