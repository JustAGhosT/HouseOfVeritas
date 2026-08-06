import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"

export const onboardingItProvision = inngest.createFunction(
  { id: "onboarding-it-provision", retries: 2 },
  { event: "house-of-veritas/onboarding.checklist.progressed" },
  async ({ event, step }) => {
    const data = event.data as { checklistId?: number; employeeId?: number }
    const checklistId = data?.checklistId
    const employeeId = data?.employeeId
    if (!checklistId && !employeeId) return { skipped: true }

    if (employeeId) {
      await getEstateRepository().employees.update(employeeId, {
        itProvisionedAt: toISODateString(),
      })
    }

    await step.run("send-notification", async () => {
      await sendNotification({
        type: "task_assigned",
        userId: getAdminNotificationRecipient(),
        title: "IT Provisioning Required",
        message: `Create accounts and equipment for new employee ${employeeId || "unknown"}`,
        channels: ["in_app"],
        data: { checklistId, employeeId },
        priority: "medium",
      })
    })

    return { notified: true }
  }
)
