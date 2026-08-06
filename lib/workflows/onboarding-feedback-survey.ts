import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import { BASEROW_ID_TO_APP_ID } from "./constants"

function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export const onboardingFeedbackSurvey = inngest.createFunction(
  { id: "onboarding-feedback-survey", retries: 2 },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const toSurvey: { emp: (typeof employees)[0]; day: number }[] = []

    for (const emp of employees) {
      const start = emp.employmentStartDate
      if (!start || emp.role !== "Employee") continue

      const days = daysSince(start)
      if (days === 30 || days === 90) {
        toSurvey.push({ emp, day: days })
      }
    }

    await step.run("send-surveys", async () => {
      for (const { emp, day } of toSurvey) {
        const appId = BASEROW_ID_TO_APP_ID[emp.id] ?? "hans"
        await sendNotification({
          type: "system_alert",
          userId: appId,
          title: `${day}-Day Onboarding Feedback`,
          message: `Please complete the confidential ${day}-day onboarding feedback survey.`,
          channels: ["in_app"],
          data: { employeeId: emp.id, day },
          priority: "medium",
        })
      }

      if (toSurvey.length > 0) {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Onboarding Feedback Due",
          message: `${toSurvey.length} employee(s) at ${toSurvey.map((x) => x.day).join("/")}-day mark - surveys sent`,
          channels: ["in_app"],
          data: { count: toSurvey.length },
          priority: "low",
        })
      }
    })

    return { employeesChecked: employees.length, surveysSent: toSurvey.length }
  }
)
