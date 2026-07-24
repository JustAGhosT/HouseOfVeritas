import { inngest } from "@/lib/inngest/client"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { runNotificationStep } from "@/lib/workflows/utils"
import type { StockOrderApprovedPayload } from "./schema"

async function findSupplierForItem(itemName: string): Promise<string | undefined> {
  const { repository } = await getInventoryRepository()
  const items = await repository.list()
  const lower = itemName.toLowerCase()
  const item = items.find(
    (i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase())
  )
  return item?.supplier
}

export const supplierOrderPlaced = inngest.createFunction(
  { id: "supplier-order-placed", retries: 2 },
  { event: "house-of-veritas/kiosk.stock_order.approved" },
  async ({ event, step }) => {
    const { requestId, itemName, quantity, employeeId, reviewedBy } =
      event.data as StockOrderApprovedPayload

    const supplier = await findSupplierForItem(itemName)

    await runNotificationStep(step, async () => {
      await sendNotification({
        type: "system_alert",
        userId: getAdminNotificationRecipient(),
        title: `Stock order approved – ready for supplier`,
        message: `${quantity}x ${itemName} (approved by ${reviewedBy}). ${supplier ? `Supplier: ${supplier}` : "No supplier on file"}`,
        channels: ["in_app"],
        data: { requestId, itemName, quantity, supplier, employeeId, reviewedBy },
        priority: "medium",
      })
    })

    return { notified: true, requestId, supplier }
  }
)
