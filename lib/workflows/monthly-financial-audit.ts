import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"

export const monthlyFinancialAudit = inngest.createFunction(
  { id: "monthly-financial-audit", retries: 2 },
  { cron: "0 9 1 * *" },
  async ({ step }) => {
    const expenses = await getEstateRepository().expenses.list({ status: "Pending" })
    const loans = await getEstateRepository().loans.list({ status: "Active" })
    const pettyCash = await getEstateRepository().pettyCash.list({ status: "Pending" })

    const overdueLoans = loans.filter((l) => {
      if (!l.nextRepaymentDate) return false
      return new Date(l.nextRepaymentDate) < new Date()
    })

    const pendingExpenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
    const overdueLoanTotal = overdueLoans.reduce((s, l) => s + l.outstandingBalance, 0)
    const pendingPettyTotal = pettyCash.reduce((s, p) => s + p.amount, 0)

    const lines: string[] = []
    if (expenses.length > 0) {
      lines.push(`Pending expenses: ${expenses.length} (R${pendingExpenseTotal.toLocaleString()})`)
    }
    if (overdueLoans.length > 0) {
      lines.push(`Overdue loans: ${overdueLoans.length} (R${overdueLoanTotal.toLocaleString()})`)
    }
    if (pettyCash.length > 0) {
      lines.push(`Pending petty cash: ${pettyCash.length} (R${pendingPettyTotal.toLocaleString()})`)
    }

    const hasOpenItems = lines.length > 0
    if (hasOpenItems) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Monthly Financial Audit Report",
          message: lines.join("\n") || "No open items",
          channels: ["in_app"],
          data: {
            pendingExpenses: expenses.length,
            overdueLoans: overdueLoans.length,
            pendingPettyCash: pettyCash.length,
          },
          priority: "medium",
        })
      })
    }

    return {
      pendingExpenses: expenses.length,
      overdueLoans: overdueLoans.length,
      pendingPettyCash: pettyCash.length,
      reportSent: hasOpenItems,
    }
  }
)
