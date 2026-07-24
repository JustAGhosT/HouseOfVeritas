import { getKioskStore } from "@/lib/db/kiosk-store"
import { inngest } from "@/lib/inngest/client"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getLowStockNotificationRecipient } from "@/lib/workflows/notification-recipients"

function hasPendingOrderForItem(
  pendingOrders: { data: Record<string, unknown> }[],
  item: { id: string; name: string }
): boolean {
  const itemIdLower = item.id.toLowerCase()
  const itemNameLower = item.name.toLowerCase().trim()
  return pendingOrders.some((o) => {
    const orderItemId = o.data?.itemId
    if (orderItemId != null && typeof orderItemId === "string") {
      return orderItemId.toLowerCase() === itemIdLower
    }
    const rawItemName = o.data?.itemName
    if (rawItemName == null || typeof rawItemName !== "string") {
      return false
    }
    const orderItemName = rawItemName.toLowerCase().trim()
    return orderItemName !== "" && orderItemName === itemNameLower
  })
}

export const reorderAutomation = inngest.createFunction(
  { id: "reorder-automation", retries: 2 },
  { cron: "0 10 * * *" },
  async ({ step }) => {
    const { repository } = await getInventoryRepository()
    const items = (await repository.list()).filter((i) => i.currentStock <= i.reorderPoint)
    if (items.length === 0) return { created: 0 }

    const PAGE_SIZE = 100
    const DAYS_LOOKBACK = 90
    const pendingOrders = await step.run("fetch-reorder-items", async () => {
      const { store } = await getKioskStore()
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - DAYS_LOOKBACK)
      const accumulated: { data: Record<string, unknown> }[] = []
      let offset = 0
      let page: { data: Record<string, unknown> }[]
      do {
        page = await store.find({
          type: "stock_order",
          status: "pending",
          timestamp: { $gte: cutoff.toISOString() },
          limit: PAGE_SIZE,
          skip: offset,
        })
        accumulated.push(...page)
        offset += PAGE_SIZE
      } while (page.length === PAGE_SIZE)
      return accumulated
    })

    const created: { itemName: string; quantity: number }[] = []

    for (const item of items) {
      if (hasPendingOrderForItem(pendingOrders, item)) continue

      const quantity: number = Math.max(
        item.reorderPoint - item.currentStock + 1,
        item.maxStock - item.currentStock,
        1
      )

      const result = await step.run(
        `insert-item-${item.id}`,
        async (): Promise<{ itemName: string; quantity: number } | null> => {
          const { store } = await getKioskStore()
          const pending = await store.find({
            type: "stock_order",
            status: "pending",
          })
          if (hasPendingOrderForItem(pending, item)) return null
          await store.insertOne({
            type: "stock_order",
            employeeId: "system",
            employeeName: "System (Reorder Automation)",
            data: {
              itemId: item.id,
              itemName: item.name,
              quantity,
              urgency: item.currentStock <= item.minStock ? "urgent" : "normal",
              notes: `Auto-created: low stock (${item.currentStock}/${item.reorderPoint})`,
            },
            timestamp: new Date().toISOString(),
            status: "pending",
          })
          return { itemName: item.name, quantity }
        }
      )

      if (result != null) created.push(result)
    }

    if (created.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getLowStockNotificationRecipient(),
          title: `Reorder automation: ${created.length} stock order(s) created`,
          message: created.map((c) => `${c.itemName} (qty ${c.quantity})`).join("; "),
          channels: ["in_app"],
          data: { created },
          priority: "medium",
        })
      })
    }

    return { created: created.length }
  }
)
