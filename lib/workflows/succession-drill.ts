import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { toISODateString } from "@/lib/utils"

const STAND_IN_ADMIN = "charl"

function getQuarterStart(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) + 1
  return new Date(d.getFullYear(), (q - 1) * 3, 1)
}

export const successionDrill = inngest.createFunction(
  { id: "succession-drill", retries: 2 },
  { cron: "0 9 15 1,4,7,10 *" },
  async ({ step }) => {
    const now = new Date()
    const quarterStart = getQuarterStart(now)
    const drillDate = new Date(quarterStart)
    drillDate.setDate(drillDate.getDate() + 14)

    const task = await getEstateRepository().tasks.create({
      title: `Succession Protocol Rehearsal - Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
      description: `Stand-in admin (${STAND_IN_ADMIN}) to assume admin duties for a day. Verify handover documents and contact lists are usable.`,
      dueDate: toISODateString(drillDate),
      priority: "High",
      status: "Not Started",
      project: "Governance",
    })

    await step.run("send-notifications", async () => {
      await sendNotification({
        type: "system_alert",
        userId: getAdminNotificationRecipient(),
        title: "Succession Drill Scheduled",
        message: `Quarterly succession protocol rehearsal. ${STAND_IN_ADMIN} will stand in as admin. Verify handover docs.`,
        channels: ["in_app"],
        data: { drillDate: toISODateString(drillDate), taskId: task?.id, standIn: STAND_IN_ADMIN },
        priority: "medium",
      })

      await sendNotification({
        type: "system_alert",
        userId: STAND_IN_ADMIN,
        title: "Succession Drill: You are the stand-in admin",
        message: `You will assume admin duties for the rehearsal. Review handover documents before the drill date.`,
        channels: ["in_app"],
        data: { drillDate: toISODateString(drillDate), taskId: task?.id },
        priority: "medium",
      })
    })

    return { taskCreated: !!task }
  }
)
