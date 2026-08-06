import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"

export const leaveCompulsoryAudit = inngest.createFunction(
  { id: "leave-compulsory-audit", retries: 2 },
  { cron: "0 9 1 1,4,7,10 *" },
  async ({ step }) => {
    const employees = await getEstateRepository().employees.list()
    const employeeRole = ["Employee"]
    const toAudit = employees.filter((e) => employeeRole.includes(e.role))

    const findings: string[] = []

    for (const emp of toAudit) {
      const requests = await getEstateRepository().leaveRequests.list({
        employee: emp.id,
        status: "Approved",
      })

      const sickCount = requests.filter((r) => r.type === "Sick").length
      const annualDays = requests
        .filter((r) => r.type === "Annual")
        .reduce((sum, r) => {
          const start = new Date(r.startDate)
          const end = new Date(r.endDate)
          return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        }, 0)

      if (sickCount >= 5) {
        findings.push(`${emp.fullName}: ${sickCount} sick leave instances (pattern check)`)
      }
      if (annualDays === 0 && (emp.leaveBalance ?? 0) > 0) {
        findings.push(`${emp.fullName}: No annual leave taken, ${emp.leaveBalance} days remaining`)
      }
    }

    if (findings.length > 0) {
      await step.run("send-notification", async () => {
        await sendNotification({
          type: "system_alert",
          userId: getAdminNotificationRecipient(),
          title: "Leave Compliance Audit Report",
          message: findings.join("\n"),
          channels: ["in_app"],
          data: { findings, count: findings.length },
          priority: "medium",
        })
      })
    }

    return {
      employeesAudited: toAudit.length,
      findingsCount: findings.length,
    }
  }
)
