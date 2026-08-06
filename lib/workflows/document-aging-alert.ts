import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { AGING_MONTHS } from "./constants"

export const documentAgingAlert = inngest.createFunction(
  { id: "document-aging-alert", retries: 2 },
  { cron: "0 8 1 * *" },
  async ({ step }) => {
    const docs = await getEstateRepository().documentExpiry.list()
    const now = new Date()

    const aging: { id: number; name?: string; lastReview?: string }[] = []

    for (const d of docs) {
      const lastReview = d.lastReview
      if (!lastReview) continue

      const last = new Date(lastReview)
      const monthsSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsSince >= AGING_MONTHS) {
        aging.push({
          id: d.id,
          name: d.docName,
          lastReview,
        })
      }
    }

    if (aging.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Aging Documents - Mandatory Review",
          message: `${aging.length} document(s) not reviewed in ${AGING_MONTHS}+ months`,
          channels: ["in_app"],
          data: { docIds: aging.map((a) => a.id) },
          priority: "medium",
        })
      })
    }

    return { docsChecked: docs.length, agingCount: aging.length }
  }
)
