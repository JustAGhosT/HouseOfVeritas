import { NextResponse } from "next/server"
import { isBaserowConfigured } from "@/lib/services/baserow"

/** Wraps data with Baserow connection status for consistent API responses */
export function withDataSource<T extends Record<string, unknown>>(data: T) {
  const dataSourceMessage = isBaserowConfigured()
    ? "Connected to Baserow"
    : "Baserow not configured"
  return NextResponse.json({
    ...data,
    configured: isBaserowConfigured(),
    message: (data.message as string) ?? dataSourceMessage,
  })
}
