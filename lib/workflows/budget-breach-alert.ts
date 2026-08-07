import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { formatCurrency } from "@/lib/workflows/utils"

export const budgetBreachAlert = inngest.createFunction(
  { id: "budget-breach-alert", retries: 2 },
  { cron: "0 10 1 * *" },
  async ({ step }) => {
    const budgets = await getEstateRepository().budgets.list({ status: "Active" })
    const expenses = await getEstateRepository().expenses.list({ status: "Approved" })

    const now = new Date()
    const currentPeriod = String(now.getFullYear())

    const breaches: { category: string; budget: number; spent: number }[] = []

    for (const b of budgets) {
      if (b.status !== "Active" || b.period !== currentPeriod) continue

      const categorySpent = expenses
        .filter((e) => e.category === b.category)
        .reduce((s, e) => s + e.amount, 0)

      if (categorySpent > b.amount) {
        breaches.push({
          category: b.category,
          budget: b.amount,
          spent: categorySpent,
        })
      }
    }

    if (breaches.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Budget Breach Alert",
          message: breaches
            .map(
              (x) =>
                `${x.category}: ${formatCurrency(x.spent)} spent (budget ${formatCurrency(x.budget)})`
            )
            .join("\n"),
          channels: ["in_app"],
          data: { breaches },
          priority: "high",
        })
      })
    }

    return { budgetsChecked: budgets.length, breachesCount: breaches.length }
  }
)
