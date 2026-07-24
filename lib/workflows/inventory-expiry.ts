import { inngest } from "@/lib/inngest/client"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { daysUntil, getAlertLevel, buildSummaryMessage } from "@/lib/workflows/utils"

export const inventoryExpiryCheck = inngest.createFunction(
  { id: "inventory-expiry-check", retries: 2 },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const { repository } = await getInventoryRepository()
    const items = (await repository.list()).filter((i) => i.expiryDate)
    const alerts: Array<{
      item: { id: string; name: string; expiryDate: string }
      days: number
      level: string
    }> = []

    for (const item of items) {
      const days = daysUntil(item.expiryDate)
      if (days === null) continue
      const level = getAlertLevel(days)
      if (level !== "OK") {
        alerts.push({
          item: { id: item.id, name: item.name, expiryDate: item.expiryDate! },
          days,
          level,
        })
      }
    }

    await step.run("send-expiry-notifications", async () => {
      for (const alert of alerts) {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: `Stock Expiry ${alert.level}: ${alert.item.name}`,
          message:
            alert.days <= 0
              ? `${alert.item.name} has expired (${alert.item.expiryDate}). Remove or dispose.`
              : `${alert.item.name} expires in ${alert.days} days (${alert.item.expiryDate})`,
          channels: ["in_app"],
          data: { itemId: alert.item.id, level: alert.level, days: alert.days },
          priority: alert.level === "URGENT" ? "urgent" : "medium",
        })
      }

      if (alerts.length > 0) {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: `Stock Expiry Summary: ${alerts.length} items need attention`,
          message: buildSummaryMessage(alerts),
          channels: ["in_app"],
          data: { totalCount: alerts.length },
          priority: "medium",
        })
      }
    })

    return { checked: items.length, alertsSent: alerts.length }
  }
)
