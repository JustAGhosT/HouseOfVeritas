// Type-only, so it is erased at compile time and never pulls lib/logger into a
// runtime that cannot load it.
import type { LogLevel } from "@/lib/logger"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      const azureMonitor = await import("@azure/monitor-opentelemetry")
      azureMonitor.useAzureMonitor()
      await bridgeLoggerToAzureMonitor()
    }

    const { logger } = await import("@/lib/logger")
    logger.info("Next.js server starting")
  }
}

/**
 * Route `lib/logger` output into Azure Monitor.
 *
 * `useAzureMonitor()` auto-instruments requests and dependencies but does not
 * capture plain `console` calls, so every `logger.*` line was reaching stdout and
 * nothing else — the App Insights `traces` and `exceptions` tables stayed empty
 * while `requests` and `dependencies` filled up. That made server-side failures
 * invisible in production, including the MongoDB connection errors needed to
 * diagnose the Gate governance datastore.
 *
 * Emitting through the OpenTelemetry logs API sends entries to whichever provider
 * `useAzureMonitor()` registered. This must run after it, and only in the Node
 * runtime, since the SDK cannot load on the Edge runtime.
 */
async function bridgeLoggerToAzureMonitor() {
  const { logs, SeverityNumber } = await import("@opentelemetry/api-logs")
  const { setLogSink } = await import("@/lib/logger")

  const severityByLevel: Record<LogLevel, number> = {
    debug: SeverityNumber.DEBUG,
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  }

  const otelLogger = logs.getLogger("house-of-veritas")

  setLogSink(({ level, message, timestamp, ...attributes }) => {
    otelLogger.emit({
      severityNumber: severityByLevel[level],
      severityText: level.toUpperCase(),
      body: message,
      // `timestamp` is dropped from the attributes because the log record carries
      // its own; the rest of the structured metadata is preserved for querying.
      attributes: attributes as Record<string, string | number | boolean>,
    })
  })
}
