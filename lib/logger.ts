export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

export type LogSink = (entry: LogEntry) => void

/**
 * Optional second destination for log entries, installed at startup by
 * `instrumentation.ts` when Azure Monitor is configured.
 *
 * The sink is injected rather than imported here on purpose: this module is
 * reachable from the Edge runtime, which cannot load the OpenTelemetry SDK, and
 * keeping the dependency in the Node-only instrumentation hook avoids pulling it
 * in where it cannot run.
 */
let sink: LogSink | null = null

export function setLogSink(next: LogSink | null): void {
  sink = next
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = (process.env.LOG_LEVEL as LogLevel) || "info"

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function emit(entry: LogEntry) {
  const output = JSON.stringify(entry)
  if (entry.level === "error") {
    console.error(output)
  } else if (entry.level === "warn") {
    console.warn(output)
  } else {
    console.log(output)
  }

  if (!sink) return
  try {
    sink(entry)
  } catch {
    // Telemetry is never allowed to break the code path that logged. The console
    // line above has already been written, so the entry is not lost.
  }
}

const BASE_META: Record<string, unknown> = {
  ...(process.env.WEBSITE_SITE_NAME && { service: process.env.WEBSITE_SITE_NAME }),
  ...(process.env.NODE_ENV && { env: process.env.NODE_ENV }),
}

function createLogFn(level: LogLevel) {
  return (message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return
    emit({
      ...BASE_META,
      ...meta,
      level,
      message,
      timestamp: new Date().toISOString(),
    })
  }
}

export const logger = {
  debug: createLogFn("debug"),
  info: createLogFn("info"),
  warn: createLogFn("warn"),
  error: createLogFn("error"),
}
