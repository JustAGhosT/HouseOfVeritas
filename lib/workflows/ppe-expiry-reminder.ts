import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { BASEROW_ID_TO_APP_ID, EXPIRY_WARNING_DAYS } from "./constants"
import { daysUntil } from "@/lib/workflows/utils"

export const ppeExpiryReminder = inngest.createFunction(
  { id: "ppe-expiry-reminder", retries: 2 },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const records = await getEstateRepository().ppe.list({ status: "Issued" })
    const expiring: { id: number; issuedTo: number; expiryDate: string }[] = []
    const expired: { id: number; issuedTo: number }[] = []

    for (const r of records) {
      if (!r.expiryDate) continue

      const days = daysUntil(r.expiryDate)
      if (days === null) continue

      if (days < 0) {
        expired.push({ id: r.id, issuedTo: r.issuedTo })
        await getEstateRepository().ppe.update(r.id, { status: "Expired" })
      } else if (days <= EXPIRY_WARNING_DAYS) {
        expiring.push({ id: r.id, issuedTo: r.issuedTo, expiryDate: r.expiryDate })
      }
    }

    await step.run("send-ppe-notifications", async () => {
      for (const e of expiring) {
        const appId = BASEROW_ID_TO_APP_ID[e.issuedTo] ?? getAdminNotificationRecipient()
        await sendNotification({
          type: "system_alert",
          userId: appId,
          title: "PPE Expiry Reminder",
          message: `PPE expires on ${e.expiryDate} - renew or return`,
          channels: ["in_app"],
          data: { ppeId: e.id },
          priority: "medium",
        })
      }

      if (expired.length > 0) {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "PPE Expired - Block Access",
          message: `${expired.length} PPE record(s) expired - block access until renewed`,
          channels: ["in_app"],
          data: { expiredIds: expired.map((e) => e.id) },
          priority: "high",
        })
      }
    })

    return { expiringCount: expiring.length, expiredCount: expired.length }
  }
)
