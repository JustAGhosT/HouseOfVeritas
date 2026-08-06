import { inngest } from "@/lib/inngest/client"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { sendNotification } from "@/lib/services/notification-service"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { toISODateString } from "@/lib/utils"
import { runNotificationStep } from "@/lib/workflows/utils"
import type { ProjectStartedPayload } from "./schema"

export const projectStarted = inngest.createFunction(
  { id: "project-started", retries: 2 },
  { event: "house-of-veritas/project.started" },
  async ({ event, step }) => {
    const { projectId, name, type } = event.data as ProjectStartedPayload

    await runNotificationStep(step, async () => {
      await sendNotification({
        type: "system_alert",
        userId: getAdminNotificationRecipient(),
        title: `Project started: ${name}`,
        message: `${type} project is now in progress. Kickoff tasks can be assigned.`,
        channels: ["in_app"],
        data: { projectId, name, type },
        priority: "medium",
      })
    })

    const task = await getEstateRepository().tasks.create({
      title: `Kickoff: ${name}`,
      description: `Project ${name} has started. Assign contractor, schedule site visit, confirm materials.`,
      dueDate: toISODateString(new Date(Date.now() + 7 * 86400000)),
      priority: "Medium",
      status: "Not Started",
      assignedTo: 2,
      project: name,
    })

    return { notified: true, projectId, kickoffTaskId: task?.id }
  }
)
