export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      const azureMonitor = await import("@azure/monitor-opentelemetry")
      azureMonitor.useAzureMonitor()
    }

    const { logger } = await import("@/lib/logger")
    logger.info("Next.js server starting")
  }
}
