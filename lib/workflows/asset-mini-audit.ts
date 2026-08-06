import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { toISODateString } from "@/lib/utils"

export const assetMiniAudit = inngest.createFunction(
  { id: "asset-mini-audit", retries: 2 },
  { cron: "0 8 1,8,15,22 * *" },
  async ({ step }) => {
    const assets = await getEstateRepository().assets.list()
    const subset = assets.slice(0, Math.min(5, assets.length))
    if (subset.length === 0) return { audited: 0 }

    const task = await getEstateRepository().tasks.create({
      title: `Asset Mini-Audit: ${subset.map((a) => a.assetId).join(", ")}`,
      description: `Cycle count for assets: ${subset.map((a) => a.assetId).join(", ")}`,
      priority: "Medium",
      status: "Not Started",
      dueDate: toISODateString(),
      project: "Assets",
    })

    if (task) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "task_assigned",
          userId: getAdminNotificationRecipient(),
          title: "Asset Mini-Audit Due",
          message: `Cycle count for ${subset.length} assets`,
          channels: ["in_app"],
          data: { taskId: task.id },
          priority: "medium",
        })
      })
    }

    return { audited: subset.length }
  }
)
