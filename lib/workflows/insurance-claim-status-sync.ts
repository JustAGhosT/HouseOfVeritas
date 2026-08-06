import { inngest } from "@/lib/inngest/client"
import { getClaimStatus } from "@/lib/integrations/insurance"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"

export const insuranceClaimStatusSync = inngest.createFunction(
  { id: "insurance-claim-status-sync", retries: 2 },
  { cron: "0 11 * * 1" },
  async ({ step }) => {
    const claims = await getEstateRepository().insuranceClaims.list({ status: "Submitted" })
    const claimsUnderReview = await getEstateRepository().insuranceClaims.list({ status: "Under Review" })
    const toSync = [...claims, ...claimsUnderReview]

    let updated = 0
    for (const c of toSync) {
      if (!c.claimId) continue

      const status = await getClaimStatus(c.claimId)
      if (!status) continue

      const newStatus =
        status.status === "Approved"
          ? "Approved"
          : status.status === "Denied"
            ? "Denied"
            : status.status === "Under Review"
              ? "Under Review"
              : c.status

      if (newStatus !== c.status) {
        await getEstateRepository().insuranceClaims.update(c.id, { status: newStatus })
        updated++

        if (newStatus === "Approved" || newStatus === "Denied") {
          await step.run(`notify-claim-${c.claimId}`, async () => {
            await sendNotification({
              type: "system_alert",
              userId: getAdminNotificationRecipient(),
              title: `Insurance Claim ${newStatus}`,
              message: `Claim ${c.claimId}: ${newStatus}`,
              channels: ["in_app"],
              data: { claimId: c.claimId, status: newStatus },
              priority: "medium",
            })
          })
        }
      }
    }

    return { claimsSynced: toSync.length, updated }
  }
)
