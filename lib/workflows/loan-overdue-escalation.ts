import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { BASEROW_ID_TO_APP_ID } from "./constants"
import { daysUntil, formatCurrency } from "@/lib/workflows/utils"

export const loanOverdueEscalation = inngest.createFunction(
  { id: "loan-overdue-escalation", retries: 2 },
  { cron: "0 10 * * *" },
  async ({ step }) => {
    const loans = await getEstateRepository().loans.list({ status: "Active" })

    const overdue: { loanId: number; employeeId: number; amount: number; dueDate: string }[] = []

    for (const loan of loans) {
      if (loan.outstandingBalance <= 0 || !loan.nextRepaymentDate) continue

      const days = daysUntil(loan.nextRepaymentDate)
      if (days !== null && days < 0) {
        overdue.push({
          loanId: loan.id,
          employeeId: loan.employee,
          amount: loan.outstandingBalance,
          dueDate: loan.nextRepaymentDate,
        })
      }
    }

    await step.run("send-overdue-notifications", async () => {
      for (const o of overdue) {
        const appId = BASEROW_ID_TO_APP_ID[o.employeeId] ?? getAdminNotificationRecipient()
        await sendNotification({
          type: "system_alert",
          userId: appId,
          title: "Overdue Loan Repayment",
          message: `Your repayment of ${formatCurrency(o.amount)} was due on ${o.dueDate}. Please resolve immediately.`,
          channels: ["in_app", "sms"],
          data: { loanId: o.loanId, amount: o.amount, dueDate: o.dueDate },
          priority: "urgent",
        })

        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Overdue Loan - Admin Action Required",
          message: `Loan #${o.loanId}: ${formatCurrency(o.amount)} overdue since ${o.dueDate}`,
          channels: ["in_app", "sms"],
          data: { loanId: o.loanId, employeeId: o.employeeId, amount: o.amount },
          priority: "urgent",
        })
      }
    })

    return { loansChecked: loans.length, overdueCount: overdue.length }
  }
)
