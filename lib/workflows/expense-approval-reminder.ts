import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"

const REMINDER_HOURS = 48

/** User ID to receive expense approval reminders. Set EXPENSE_APPROVER_ID env var to override. */
const EXPENSE_APPROVER_ID: string = process.env.EXPENSE_APPROVER_ID ?? "hans"

/**
 * Returns hours elapsed since the given date string.
 * @throws Error if dateStr cannot be parsed (callers using hoursSince with REMINDER_HOURS should catch/log data-quality issues)
 */
function hoursSince(dateStr: string): number {
  const start = new Date(dateStr)
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid date string in hoursSince: ${dateStr}`)
  }
  const now = new Date()
  return (now.getTime() - start.getTime()) / (1000 * 60 * 60)
}

export const expenseApprovalReminder = inngest.createFunction(
  { id: "expense-approval-reminder", retries: 2 },
  { cron: "TZ=Africa/Johannesburg 0 9 * * *" },
  async ({ step }) => {
    const expenses = await step.run("fetch_expenses", () => getEstateRepository().expenses.list({ status: "Pending" }))
    const pending = expenses.filter((e) => {
      const hours = hoursSince(e.date)
      return hours >= REMINDER_HOURS
    })

    if (pending.length > 0) {
      await step.run("send_notification", () =>
        sendNotification({
          type: "system_alert",
          userId: EXPENSE_APPROVER_ID,
          title: `Expense Approval Reminder: ${pending.length} pending > 48h`,
          message:
            pending
              .slice(0, 5)
              .map((e) => `${e.requesterName || "Unknown"}: R${e.amount} (${e.category})`)
              .join("; ") + (pending.length > 5 ? ` +${pending.length - 5} more` : ""),
          channels: ["in_app"],
          data: {
            count: pending.length,
            expenseIds: pending.map((e) => e.id),
          },
          priority: "high",
        })
      )
    }

    return { pendingChecked: expenses.length, remindersSent: pending.length > 0 ? 1 : 0 }
  }
)
