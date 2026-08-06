import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { BASEROW_ID_TO_APP_ID } from "./constants"

const ANNUAL_LEAVE_PER_MONTH = 1.25
const MAX_ANNUAL_LEAVE = 30

function calculateNewBalance(current: number): number {
  const newBalance = current + ANNUAL_LEAVE_PER_MONTH
  return Math.min(newBalance, MAX_ANNUAL_LEAVE)
}

export const leaveBalanceUpdate = inngest.createFunction(
  { id: "leave-balance-update", retries: 2 },
  { cron: "0 7 1 * *" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const employeeRole = ["Employee"]
    const toUpdate = employees.filter((e) => employeeRole.includes(e.role))
    const updates: { name: string; previous: number; accrued: number; newBalance: number }[] = []

    for (const emp of toUpdate) {
      const current = emp.leaveBalance ?? 0
      const newBalance = calculateNewBalance(current)
      const accrued = newBalance - current

      const updated = await getEstateRepository().employees.update(emp.id, { leaveBalance: newBalance })
      if (updated) {
        updates.push({
          name: emp.fullName,
          previous: current,
          accrued,
          newBalance,
        })
        const appUserId = BASEROW_ID_TO_APP_ID[emp.id] ?? "hans"
        await step.run(`notify-balance-${emp.id}`, async () => {
          await sendNotification({
            type: "leave_balance_updated",
            userId: appUserId,
            title: "Leave Balance Updated",
            message: `Your annual leave is now ${newBalance.toFixed(1)} days (+${accrued.toFixed(1)} this month).`,
            channels: ["in_app"],
            data: { employeeId: emp.id, newBalance, accrued },
            priority: "low",
          })
        })
      }
    }

    if (updates.length > 0) {
      await step.run("send-summary", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: `Leave Balance Update: ${updates.length} employees`,
          message: updates
            .map((u) => `${u.name}: ${u.newBalance.toFixed(1)} days (+${u.accrued.toFixed(1)})`)
            .join("; "),
          channels: ["in_app"],
          data: { count: updates.length, month: new Date().getMonth() + 1 },
          priority: "medium",
        })
      })
    }

    return { employeesProcessed: toUpdate.length, updated: updates.length }
  }
)
