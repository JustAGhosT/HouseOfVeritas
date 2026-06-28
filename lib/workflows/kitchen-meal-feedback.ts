import { inngest } from "@/lib/inngest/client"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"

export const kitchenMealFeedback = inngest.createFunction(
  { id: "kitchen-meal-feedback", retries: 2 },
  { event: "house-of-veritas/kitchen.meal.feedback" },
  async ({ event, step }) => {
    const data = event.data as {
      taskId?: number
      description?: string
      mealName?: string
      servedBy?: string
      location?: string
      severity?: "low" | "medium" | "high"
    }

    await step.run("send-notification", async () => {
      const mealLabel = data.mealName ? `: ${data.mealName}` : ""
      const servedBy = data.servedBy ? ` Served by ${data.servedBy}.` : ""
      await sendNotification({
        type: "system_alert",
        userId: getAdminNotificationRecipient(),
        title: `Meal Quality Feedback${mealLabel}`,
        message: `${data.location || "Kitchen"} received ${data.severity || "medium"} severity meal feedback.${servedBy} ${data.description || "Review required"}`,
        channels: ["in_app"],
        data: { taskId: data.taskId },
        priority: data.severity === "high" ? "urgent" : "medium",
      })
    })

    return { notified: true }
  }
)
