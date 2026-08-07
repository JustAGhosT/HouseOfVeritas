import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"

const LOCKOUT_DAYS = 7

export const assetLateReturnLockout = inngest.createFunction(
  { id: "asset-late-return-lockout", retries: 2 },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const assets = await getEstateRepository().assets.list()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdue: { id: number; assetId: string; checkedOutBy?: number }[] = []

    for (const a of assets) {
      if (!a.checkedOutBy || !a.expectedReturnDate) continue
      if (a.lateReturnLockoutUntil) continue

      const due = new Date(a.expectedReturnDate)
      due.setHours(0, 0, 0, 0)
      if (due < today) {
        overdue.push({
          id: a.id,
          assetId: a.assetId,
          checkedOutBy: a.checkedOutBy,
        })
      }
    }

    const lockoutUntil = new Date()
    lockoutUntil.setDate(lockoutUntil.getDate() + LOCKOUT_DAYS)
    const lockoutStr = toISODateString(lockoutUntil)

    await step.run("send-lockout-notifications", async () => {
      for (const o of overdue) {
        await getEstateRepository().assets.update(o.id, { lateReturnLockoutUntil: lockoutStr })
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Asset Late Return - Lockout Applied",
          message: `Asset ${o.assetId} overdue - checkout locked until ${lockoutStr}`,
          channels: ["in_app"],
          data: { assetId: o.id, lockoutUntil: lockoutStr },
          priority: "high",
        })
      }
    })

    return { overdueCount: overdue.length }
  }
)
