import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { logger, setLogSink, type LogEntry } from "@/lib/logger"

describe("logger sink", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    setLogSink(null)
    vi.restoreAllMocks()
  })

  it("forwards entries to an installed sink with level, message and metadata", () => {
    const received: LogEntry[] = []
    setLogSink((entry) => received.push(entry))

    logger.error("MongoDB connection error", { error: "connection timed out" })

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      level: "error",
      message: "MongoDB connection error",
      error: "connection timed out",
    })
    expect(received[0].timestamp).toBeTruthy()
  })

  it("still writes to the console when a sink is installed", () => {
    setLogSink(() => {})

    logger.error("boom")

    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it("does not let a failing sink break the caller", () => {
    setLogSink(() => {
      throw new Error("exporter unavailable")
    })

    // Telemetry must never propagate into the path that logged.
    expect(() => logger.error("boom")).not.toThrow()
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it("stops forwarding once the sink is removed", () => {
    const received: LogEntry[] = []
    setLogSink((entry) => received.push(entry))
    logger.info("first")

    setLogSink(null)
    logger.info("second")

    expect(received.map((entry) => entry.message)).toEqual(["first"])
  })

  it("respects the level threshold before reaching the sink", () => {
    const received: LogEntry[] = []
    setLogSink((entry) => received.push(entry))

    // LOG_LEVEL defaults to "info", so debug is filtered out before emit.
    logger.debug("noisy")

    expect(received).toHaveLength(0)
  })
})
