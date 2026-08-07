import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { BASEROW_ID_TO_APP_ID } from "./constants"

export const improvementPrompt = inngest.createFunction(
  { id: "improvement-prompt", retries: 2 },
  { cron: "0 9 1 * *" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const toPrompt = employees.filter((e) => e.role === "Employee" || e.role === "Resident")

    await step.run("send-prompts", async () => {
      for (const emp of toPrompt) {
        const appId = BASEROW_ID_TO_APP_ID[emp.id] ?? "hans"
        await sendNotification({
          type: "system_alert",
          userId: appId,
          title: "Workflow Feedback",
          message: "Which workflow slowed you down this month? Share feedback for improvement.",
          channels: ["in_app"],
          data: { type: "improvement_prompt" },
          priority: "low",
        })
      }
    })

    return { prompted: toPrompt.length }
  }
)
