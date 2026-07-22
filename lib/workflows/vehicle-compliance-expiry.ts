import { inngest } from "@/lib/inngest/client"

export const vehicleComplianceExpiry = inngest.createFunction(
  { id: "vehicle-compliance-expiry", retries: 2 },
  { cron: "0 8 1 * *" },
  async () => {
    return { skipped: true, reason: "vehicles_coming_soon", tasksCreated: 0 }
  }
)
