import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"

const REPEAT_WINDOW_DAYS = 60
const ESCALATION_THRESHOLD = 3

function parseIncidentIds(s: string | undefined): number[] {
  if (!s) return []
  try {
    const parsed = JSON.parse(s) as number[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const incidentRepeatLinkage = inngest.createFunction(
  { id: "incident-repeat-linkage", retries: 2 },
  { cron: "0 10 * * *" },
  async ({ step }) => {
    const incidents = await getEstateRepository().incidents.list()
    const now = new Date()
    const cutoff = new Date(now.getTime() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const byType: Record<string, { id: number; dateTime: string }[]> = {}
    for (const i of incidents) {
      const dt = new Date(i.dateTime)
      if (dt < cutoff) continue
      const type = i.type || "Unknown"
      if (!byType[type]) byType[type] = []
      byType[type].push({ id: i.id, dateTime: i.dateTime })
    }

    let escalated = 0
    for (const [, group] of Object.entries(byType)) {
      if (group.length < ESCALATION_THRESHOLD) continue

      const ids = group.map((g) => g.id).sort((a, b) => a - b)
      const idsStr = JSON.stringify(ids)

      for (const g of group) {
        const existing = incidents.find((i) => i.id === g.id)
        const currentIds = parseIncidentIds(existing?.relatedIncidentIds)
        const allIds = [...new Set([...currentIds, ...ids])].sort((a, b) => a - b)
        if (JSON.stringify(allIds) !== (existing?.relatedIncidentIds || "")) {
          await getEstateRepository().incidents.update(g.id, {
            relatedIncidentIds: JSON.stringify(allIds),
          })
        }
      }

      await step.run(`notify-repeat-${idsStr}`, async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Repeat Incident - Policy Review Required",
          message: `${group.length} similar incidents in ${REPEAT_WINDOW_DAYS} days - formal policy review or intervention needed`,
          channels: ["in_app", "sms"],
          data: { incidentIds: ids, count: group.length },
          priority: "urgent",
        })
      })
      escalated++
    }

    return { incidentsChecked: incidents.length, typeGroups: Object.keys(byType).length, escalated }
  }
)
