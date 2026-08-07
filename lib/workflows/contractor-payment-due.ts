import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { formatCurrency } from "@/lib/workflows/utils"

export const contractorPaymentDue = inngest.createFunction(
  { id: "contractor-payment-due", retries: 2 },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    const contracts = await getEstateRepository().contractorContracts.list({ status: "Active" })
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const duePayments: {
      contractId: number
      project: string
      milestone: string
      amount: number
    }[] = []

    for (const c of contracts) {
      let milestones: string[] = []
      let amounts: number[] = []
      try {
        milestones = JSON.parse(c.milestones || "[]") as string[]
        amounts = JSON.parse(c.amounts || "[]") as number[]
      } catch {
        continue
      }

      for (let i = 0; i < milestones.length; i++) {
        const dueDate = new Date(milestones[i])
        dueDate.setHours(0, 0, 0, 0)
        const amount = amounts[i] ?? 0
        if (dueDate.getTime() === today.getTime() && amount > 0) {
          duePayments.push({
            contractId: c.id,
            project: c.project,
            milestone: milestones[i],
            amount,
          })
        }
      }
    }

    await step.run("send-notifications", async () => {
      for (const p of duePayments) {
        await sendNotification({
          type: "approval_required",
          userId: getAdminNotificationRecipient(),
          title: "Contractor Payment Due",
          message: `Contract ${p.contractId} (${p.project}): ${formatCurrency(p.amount)} due today`,
          channels: ["in_app"],
          data: { contractId: p.contractId, project: p.project, amount: p.amount },
          priority: "medium",
        })
      }
    })

    return { contractsChecked: contracts.length, paymentsDue: duePayments.length }
  }
)
