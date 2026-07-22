import { inngest } from "@/lib/inngest/client"

export const vehicleMileageCheck = inngest.createFunction(
  { id: "vehicle-mileage-check", retries: 2 },
  { cron: "0 9 * * *" },
  async () => {
    return { skipped: true, reason: "vehicles_coming_soon", tasksCreated: 0 }
  }
)
