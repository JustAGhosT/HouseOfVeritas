import { inngest } from "@/lib/inngest/client"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { sendNotification } from "@/lib/services/notification-service"
import { getAdminNotificationRecipient } from "@/lib/workflows/notification-recipients"
import type { DocuSealSubmissionPayload } from "./schema"

export const docusealSubmissionCompleted = inngest.createFunction(
  { id: "docuseal-submission-completed", retries: 2 },
  { event: "house-of-veritas/docuseal.submission.completed" },
  async ({ event, step }) => {
    const payload = event.data as DocuSealSubmissionPayload
    const actions: string[] = []

    if (payload.templateName.includes("Employment Contract")) {
      const employees = await getEstateRepository().employees.list()
      for (const email of payload.submitterEmails) {
        if (!email) continue
        const emp = employees.find((e) => e.email?.toLowerCase() === email.toLowerCase())
        if (emp) {
          const updated = await getEstateRepository().employees.update(emp.id, {
            contractRef: payload.documentUrl,
            probationStatus: "Completed",
          })
          if (updated) {
            actions.push(`Updated employee ${email} contract status`)
          }
        }
      }
    }

    const docRows = await getEstateRepository().documentExpiry.list()
    const docRecord = docRows.find(
      (r) => r.docName?.toLowerCase() === payload.templateName.toLowerCase()
    )
    if (docRecord) {
      const lastReview = payload.completedAt.slice(0, 10)
      const updated = await getEstateRepository().documentExpiry.update(docRecord.id, {
        docuSealRef: payload.documentUrl,
        lastReview,
        status: "Active",
      })
      if (updated) {
        actions.push(`Updated document expiry: ${payload.templateName}`)
      }
    }

    await step.run("send-notification", async () => {
      await sendNotification({
        type: "system_alert",
        userId: getAdminNotificationRecipient(),
        title: `Document Signed: ${payload.templateName}`,
        message: `Submission ${payload.submissionId} completed. Signers: ${payload.submitterEmails.join(", ")}`,
        channels: ["in_app"],
        data: {
          submissionId: payload.submissionId,
          documentUrl: payload.documentUrl,
          actions,
        },
        priority: "medium",
      })
    })

    return { success: actions.length > 0, actions }
  }
)
