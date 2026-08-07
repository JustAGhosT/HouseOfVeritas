import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { BASEROW_ID_TO_APP_ID, REMINDER_DAYS_AHEAD } from "./constants"
import { daysUntil, formatCurrency } from "@/lib/workflows/utils"

export const loanRepaymentReminder = inngest.createFunction(
  { id: "loan-repayment-reminder", retries: 2 },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const loans = await step.run("get-loans", () => getEstateRepository().loans.list({ status: "Active" }))

    const reminders: { loanId: number; employeeId: number; amount: number; dueDate: string }[] = []

    for (const loan of loans) {
      if (loan.outstandingBalance <= 0 || !loan.nextRepaymentDate) continue

      const days = daysUntil(loan.nextRepaymentDate)
      if (days === null || days < 0 || days > REMINDER_DAYS_AHEAD) continue

      reminders.push({
        loanId: loan.id,
        employeeId: loan.employee,
        amount: loan.outstandingBalance,
        dueDate: loan.nextRepaymentDate,
      })
    }

    await step.run("send-reminders", async () => {
      for (const r of reminders) {
        const appId = BASEROW_ID_TO_APP_ID[r.employeeId] ?? getAdminNotificationRecipient()
        await sendNotification({
          type: "system_alert",
          userId: appId,
          title: "Loan Repayment Due Soon",
          message: `Repayment of ${formatCurrency(r.amount)} due on ${r.dueDate}.`,
          channels: ["in_app"],
          data: { loanId: r.loanId, amount: r.amount, dueDate: r.dueDate },
          priority: "medium",
        })

        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Loan Repayment Reminder",
          message: `Loan #${r.loanId}: ${formatCurrency(r.amount)} due ${r.dueDate}`,
          channels: ["in_app"],
          data: { loanId: r.loanId, employeeId: r.employeeId },
          priority: "low",
        })
      }
      return reminders.length
    })

    return { loansChecked: loans.length, remindersSent: reminders.length }
  }
)
